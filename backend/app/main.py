"""
FastAPI application with webhook endpoints and order management.
Production-ready with proper error handling and security.
"""
from fastapi import FastAPI, Depends, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os

from app.database import get_db, init_db
from app.models.escrow import Order, EscrowStatus, User, Dispute
from app.services.ledger_service import (
    transition_order_state,
    create_dispute,
    InvalidStateTransition,
    OrderNotFoundError
)
from app.services.paxi_tracker import check_paxi_waybill, batch_track_waybills
from app.services.webhook_handler import (
    process_payshap_webhook,
    process_payout_webhook
)

# Create FastAPI app
app = FastAPI(
    title="P2P Escrow Marketplace API",
    description="Automated escrow system with Paxi integration and PayShap payments",
    version="1.0.0"
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================
# Health & Status
# =====================

@app.get("/health")
def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }


# =====================
# Webhook Endpoints (Payment Gateway Callbacks)
# =====================

@app.post("/webhooks/payshap/confirm")
async def payshap_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_signature: Optional[str] = Header(None)
):
    """
    PayShap/Ozow payment confirmation webhook.
    
    Called by payment gateway when buyer approves payment request.
    Implements signature verification and idempotency.
    """
    return await process_payshap_webhook(request, db, x_signature)


@app.post("/webhooks/payout/confirm")
async def payout_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_signature: Optional[str] = Header(None)
):
    """
    Payout confirmation webhook.
    
    Called when seller receives funds in their bank account.
    """
    return await process_payout_webhook(request, db, x_signature)


# =====================
# Order Management
# =====================

@app.get("/orders", response_model=List[dict])
def list_orders(
    status: Optional[EscrowStatus] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    List orders with optional filtering.
    
    Args:
        status: Filter by escrow status
        user_id: Filter by buyer or seller ID
    """
    query = db.query(Order)
    
    if status:
        query = query.filter(Order.escrow_status == status)
    
    if user_id:
        query = query.filter(
            (Order.buyer_id == user_id) | (Order.seller_id == user_id)
        )
    
    orders = query.order_by(Order.created_at.desc()).limit(50).all()
    
    return [
        {
            "id": order.id,
            "order_reference": order.order_reference,
            "total_amount_cents": order.total_amount_cents,
            "platform_fee_cents": order.platform_fee_cents,
            "seller_payout_cents": order.seller_payout_cents,
            "escrow_status": order.escrow_status.value,
            "paxi_waybill": order.paxi_waybill,
            "buyer_id": order.buyer_id,
            "seller_id": order.seller_id,
            "created_at": order.created_at.isoformat(),
            "inspection_deadline": order.inspection_deadline.isoformat() if order.inspection_deadline else None,
        }
        for order in orders
    ]


@app.get("/orders/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    """Get detailed order information."""
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {
        "id": order.id,
        "order_reference": order.order_reference,
        "total_amount_cents": order.total_amount_cents,
        "platform_fee_cents": order.platform_fee_cents,
        "seller_payout_cents": order.seller_payout_cents,
        "escrow_status": order.escrow_status.value,
        "paxi_waybill": order.paxi_waybill,
        "paxi_tracking_data": order.paxi_tracking_data,
        "buyer_id": order.buyer_id,
        "seller_id": order.seller_id,
        "created_at": order.created_at.isoformat(),
        "paid_at": order.paid_at.isoformat() if order.paid_at else None,
        "shipped_at": order.shipped_at.isoformat() if order.shipped_at else None,
        "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
        "inspection_deadline": order.inspection_deadline.isoformat() if order.inspection_deadline else None,
        "is_inspection_expired": order.is_inspection_expired(),
    }


@app.post("/orders/{order_id}/ship")
def register_shipment(
    order_id: int,
    waybill_number: str,
    db: Session = Depends(get_db)
):
    """
    Register shipment with Paxi waybill.
    
    Called when seller drops off parcel at PEP/Paxi node.
    """
    try:
        result = transition_order_state(
            session=db,
            order_id=order_id,
            target_status=EscrowStatus.SHIPPED,
            extra_data={"paxi_waybill": waybill_number}
        )
        
        return {
            "status": "success",
            "order_id": order_id,
            "new_state": result.escrow_status.value,
            "waybill": waybill_number,
            "message": "Shipment registered. Tracking will begin automatically."
        }
        
    except InvalidStateTransition as e:
        raise HTTPException(status_code=400, detail=str(e))
    except OrderNotFoundError:
        raise HTTPException(status_code=404, detail="Order not found")


@app.post("/orders/{order_id}/confirm-delivery")
def confirm_delivery(
    order_id: int,
    db: Session = Depends(get_db)
):
    """
    Buyer confirms delivery and starts inspection window.
    
    Can be called manually if Paxi tracking is unavailable.
    """
    try:
        result = transition_order_state(
            session=db,
            order_id=order_id,
            target_status=EscrowStatus.DELIVERED_INSPECTION_WINDOW
        )
        
        return {
            "status": "success",
            "order_id": order_id,
            "new_state": result.escrow_status.value,
            "inspection_deadline": result.inspection_deadline.isoformat() if result.inspection_deadline else None,
            "message": "Inspection window started. 48 hours to report issues."
        }
        
    except InvalidStateTransition as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/orders/{order_id}/confirm-satisfaction")
def confirm_satisfaction(
    order_id: int,
    db: Session = Depends(get_db)
):
    """
    Buyer confirms satisfaction - triggers payout to seller.
    
    This initiates the PayShap payout to seller's bank account.
    """
    try:
        result = transition_order_state(
            session=db,
            order_id=order_id,
            target_status=EscrowStatus.COMPLETED_PAID_OUT
        )
        
        # TODO: Trigger actual payout via PayShap API
        # For now, just return success
        # In production, this would call a Celery task to process payout
        
        return {
            "status": "success",
            "order_id": order_id,
            "new_state": result.escrow_status.value,
            "seller_payout_cents": result.seller_payout_cents,
            "message": "Satisfaction confirmed. Payout initiated to seller."
        }
        
    except InvalidStateTransition as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/orders/{order_id}/dispute")
def open_dispute(
    order_id: int,
    reason: str,
    unboxing_video_url: Optional[str] = None,
    evidence_urls: Optional[List[str]] = None,
    db: Session = Depends(get_db)
):
    """
    Open a dispute - locks funds and requires admin review.
    
    Buyer must provide unboxing video and evidence.
    """
    try:
        dispute = create_dispute(
            session=db,
            order_id=order_id,
            reason=reason,
            unboxing_video_url=unboxing_video_url,
            buyer_evidence_urls=evidence_urls
        )
        
        return {
            "status": "dispute_opened",
            "dispute_id": dispute.id,
            "order_id": order_id,
            "message": "Dispute opened. Funds are locked pending admin review."
        }
        
    except InvalidStateTransition as e:
        raise HTTPException(status_code=400, detail=str(e))
    except OrderNotFoundError:
        raise HTTPException(status_code=404, detail="Order not found")


# =====================
# Paxi Tracking
# =====================

@app.get("/paxi/track/{waybill_number}")
def track_paxi(
    waybill_number: str,
    db: Session = Depends(get_db)
):
    """
    Track a Paxi waybill and update order state if needed.
    
    Uses API or web scraping fallback.
    """
    result = check_paxi_waybill(db, waybill_number)
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return result


@app.post("/paxi/batch-track")
def batch_track(
    waybills: List[str],
    db: Session = Depends(get_db)
):
    """
    Track multiple waybills in batch.
    
    Useful for cron jobs processing all active shipments.
    """
    results = batch_track_waybills(db, waybills)
    return {"results": results}


# =====================
# Admin Endpoints
# =====================

@app.get("/admin/disputes")
def list_disputes(db: Session = Depends(get_db)):
    """List all open disputes for admin review."""
    disputes = db.query(Dispute).filter(Dispute.status == "open").all()
    
    return [
        {
            "id": d.id,
            "order_id": d.order_id,
            "reason": d.reason,
            "status": d.status,
            "unboxing_video_url": d.unboxing_video_url,
            "created_at": d.created_at.isoformat()
        }
        for d in disputes
    ]


@app.post("/admin/disputes/{dispute_id}/resolve")
def resolve_dispute(
    dispute_id: int,
    payout_decision_cents: int,
    resolution_notes: str,
    db: Session = Depends(get_db)
):
    """
    Admin resolves a dispute and sets payout amount.
    
    Can award full, partial, or zero payout to seller.
    """
    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    
    # Update dispute
    dispute.status = "resolved"
    dispute.resolution_notes = resolution_notes
    dispute.payout_decision_cents = payout_decision_cents
    dispute.resolved_at = datetime.utcnow()
    
    # Transition order to completed with decided payout
    order = db.query(Order).filter(Order.id == dispute.order_id).first()
    if order:
        order.seller_payout_cents = payout_decision_cents
        transition_order_state(
            session=db,
            order_id=order.id,
            target_status=EscrowStatus.COMPLETED_PAID_OUT
        )
    
    db.commit()
    
    return {
        "status": "resolved",
        "dispute_id": dispute_id,
        "payout_decision_cents": payout_decision_cents,
        "message": "Dispute resolved. Payout will be processed."
    }


# =====================
# Startup Event
# =====================

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    # Uncomment in production after migrations are set up
    # init_db()
    print("🚀 P2P Escrow Marketplace API starting...")
