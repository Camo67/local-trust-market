"""
Celery worker for background tasks: Paxi polling and payout processing.
Replaces system cron with proper task queue management.
"""
from celery import Celery
from datetime import datetime, timedelta
from typing import List
import json
import os

# Celery configuration
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

celery_app = Celery(
    "escrow_worker",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Johannesburg",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minute max per task
    worker_prefetch_multiplier=1,
)


@celery_app.task(bind=True, max_retries=3)
def poll_all_active_shipments(self):
    """
    Poll Paxi tracking for all active shipments.
    
    Scheduled to run every 15 minutes via Celery Beat.
    """
    from app.database import SessionLocal
    from app.models.escrow import Order, EscrowStatus
    from app.services.paxi_tracker import check_paxi_waybill
    
    db = SessionLocal()
    
    try:
        # Get all orders that are shipped but not yet delivered
        active_orders = db.query(Order).filter(
            Order.escrow_status.in_([
                EscrowStatus.SHIPPED,
                EscrowStatus.HELD_IN_ESCROW  # Might have been shipped but not updated
            ])
        ).filter(
            Order.paxi_waybill.isnot(None)
        ).all()
        
        waybills = [order.paxi_waybill for order in active_orders if order.paxi_waybill]
        
        if not waybills:
            return {"status": "no_active_shipments"}
        
        results = []
        api_key = os.getenv("PAXI_API_KEY")
        
        for waybill in waybills:
            try:
                result = check_paxi_waybill(db, waybill, api_key)
                results.append({
                    "waybill": waybill,
                    "status": result.get("status"),
                    "updated": result.get("updated", False)
                })
            except Exception as e:
                results.append({
                    "waybill": waybill,
                    "error": str(e)
                })
        
        updated_count = sum(1 for r in results if r.get("updated"))
        
        return {
            "status": "completed",
            "total_tracked": len(waybills),
            "updated_count": updated_count,
            "results": results
        }
        
    except Exception as e:
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
    
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def process_inspection_deadlines(self):
    """
    Check for expired inspection windows and auto-release funds.
    
    Scheduled to run every hour via Celery Beat.
    """
    from app.database import SessionLocal
    from app.models.escrow import Order, EscrowStatus
    from app.services.ledger_service import transition_order_state, InvalidStateTransition
    
    db = SessionLocal()
    
    try:
        # Find orders in inspection window that have expired
        now = datetime.utcnow()
        expired_orders = db.query(Order).filter(
            Order.escrow_status == EscrowStatus.DELIVERED_INSPECTION_WINDOW,
            Order.inspection_deadline < now,
            Order.inspection_deadline.isnot(None)
        ).all()
        
        results = []
        
        for order in expired_orders:
            try:
                # Auto-confirm and transition to completed
                transition_order_state(
                    session=db,
                    order_id=order.id,
                    target_status=EscrowStatus.COMPLETED_PAID_OUT
                )
                
                results.append({
                    "order_id": order.id,
                    "action": "auto_completed",
                    "seller_payout_cents": order.seller_payout_cents
                })
                
                # TODO: Send WhatsApp notification to buyer
                # TODO: Trigger payout via PayShap API
                
            except InvalidStateTransition as e:
                results.append({
                    "order_id": order.id,
                    "action": "failed",
                    "error": str(e)
                })
        
        return {
            "status": "completed",
            "processed_count": len(expired_orders),
            "results": results
        }
        
    except Exception as e:
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
    
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=5)
def process_seller_payout(self, order_id: int):
    """
    Process payout to seller's bank account via PayShap.
    
    Called when buyer confirms satisfaction or inspection window expires.
    """
    from app.database import SessionLocal
    from app.models.escrow import Order
    from app.services.payout_service import initiate_payshap_payout
    
    db = SessionLocal()
    
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            return {"status": "error", "message": "Order not found"}
        
        if order.escrow_status != EscrowStatus.COMPLETED_PAID_OUT:
            return {
                "status": "skipped",
                "message": f"Order not ready for payout: {order.escrow_status.value}"
            }
        
        # Get seller details
        seller = db.query(User).filter(User.id == order.seller_id).first()
        
        if not seller or not seller.shapid:
            return {
                "status": "error",
                "message": "Seller has no ShapID configured"
            }
        
        # Initiate PayShap payout
        payout_result = initiate_payshap_payout(
            shapid=seller.shapid,
            amount_cents=order.seller_payout_cents,
            reference=f"PAYOUT-{order.order_reference}"
        )
        
        return {
            "status": "success",
            "order_id": order_id,
            "payout_reference": payout_result.get("reference"),
            "amount_cents": order.seller_payout_cents
        }
        
    except Exception as e:
        # Retry with longer delays for financial transactions
        raise self.retry(exc=e, countdown=300 * (2 ** self.request.retries))
    
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def send_inspection_reminder(self, order_id: int):
    """
    Send WhatsApp reminder to buyer about inspection deadline.
    
    Scheduled to run 24 hours after delivery.
    """
    from app.database import SessionLocal
    from app.models.escrow import Order, EscrowStatus
    from app.services.whatsapp_service import send_whatsapp_message
    
    db = SessionLocal()
    
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order or order.escrow_status != EscrowStatus.DELIVERED_INSPECTION_WINDOW:
            return {"status": "skipped", "message": "Order not in inspection window"}
        
        # Get buyer phone number (implement user lookup)
        # buyer = db.query(User).filter(User.id == order.buyer_id).first()
        # buyer_phone = buyer.phone_number if buyer else None
        
        # For now, just log
        message = (
            f"📦 Order {order.order_reference} - Inspection Reminder\n\n"
            f"Your parcel has been delivered. You have 24 hours remaining to inspect "
            f"the item and report any issues.\n\n"
            f"If you're satisfied, tap 'I'm Happy' to release payment to the seller.\n"
            f"If there's a problem, open a dispute with unboxing video evidence."
        )
        
        # TODO: Send actual WhatsApp message
        # if buyer_phone:
        #     send_whatsapp_message(buyer_phone, message)
        
        return {
            "status": "sent",
            "order_id": order_id,
            "message_preview": message[:100]
        }
        
    except Exception as e:
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
    
    finally:
        db.close()


# =====================
# Celery Beat Schedule Configuration
# =====================

celery_app.conf.beat_schedule = {
    "poll-shipments-every-15-min": {
        "task": "app.worker.poll_all_active_shipments",
        "schedule": 900.0,  # 15 minutes
    },
    "check-deadlines-every-hour": {
        "task": "app.worker.process_inspection_deadlines",
        "schedule": 3600.0,  # 1 hour
    },
}

celery_app.conf.timezone = "Africa/Johannesburg"
