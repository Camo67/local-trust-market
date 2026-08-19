"""
Webhook handler with HMAC signature verification and idempotency guards.
Securely processes payment gateway callbacks (PayShap/Ozow/PayFast).
"""
import hmac
import hashlib
import json
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import FastAPI, Request, HTTPException, Header, Depends
from sqlalchemy.orm import Session

from app.models.escrow import EscrowStatus, PaymentTransaction
from app.services.ledger_service import (
    transition_order_state,
    record_payment_transaction,
    check_webhook_processed,
    mark_webhook_processed,
    DuplicateTransactionError,
    InvalidStateTransition
)
from app.database import get_db


# Configuration - load from environment in production
WEBHOOK_SECRET = "your_shared_webhook_secret"  # Replace with os.getenv("WEBHOOK_SECRET")


def verify_hmac_signature(
    payload: bytes,
    signature: str,
    secret: str,
    algorithm: str = "sha256"
) -> bool:
    """
    Verify HMAC signature on webhook payload.
    
    Args:
        payload: Raw request body bytes
        signature: Signature from X-Signature header
        secret: Shared webhook secret
        algorithm: Hash algorithm (default: sha256)
        
    Returns:
        True if signature is valid, False otherwise
    """
    if not signature:
        return False
    
    computed_sig = hmac.new(
        secret.encode(),
        payload,
        getattr(hashlib, algorithm)
    ).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(computed_sig, signature)


async def process_payshap_webhook(
    request: Request,
    session: Session,
    x_signature: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process PayShap/Ozow payment confirmation webhook.
    
    Implements:
    1. HMAC signature verification
    2. Idempotency check (prevent double-processing)
    3. Secure state transition
    
    Args:
        request: FastAPI request object
        session: Database session
        x_signature: Signature from X-Signature header
        
    Returns:
        Response dict with status
        
    Raises:
        HTTPException: If verification fails
    """
    # Read raw body for signature verification
    raw_body = await request.body()
    
    # Step 1: Verify HMAC signature
    if not verify_hmac_signature(raw_body, x_signature or "", WEBHOOK_SECRET):
        raise HTTPException(
            status_code=401,
            detail="Invalid signature - possible replay attack or tampering"
        )
    
    # Parse payload
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    # Extract critical fields
    order_ref = payload.get("reference") or payload.get("order_id")
    transaction_id = payload.get("transaction_id") or payload.get("id")
    status = payload.get("status", "").lower()
    amount_cents = payload.get("amount_cents") or int(payload.get("amount", 0) * 100)
    
    if not order_ref or not transaction_id:
        raise HTTPException(
            status_code=400,
            detail="Missing required fields: reference/order_id and transaction_id"
        )
    
    # Step 2: Idempotency guard - check if already processed
    if check_webhook_processed(session, transaction_id, "payshap"):
        return {
            "status": "already_processed",
            "transaction_id": transaction_id,
            "message": "Webhook previously processed successfully"
        }
    
    # Find the order by reference
    from app.models.escrow import Order
    order = session.query(Order).filter(
        (Order.order_reference == order_ref) | (Order.id == int(order_ref) if order_ref.isdigit() else False)
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=404,
            detail=f"Order not found for reference: {order_ref}"
        )
    
    # Step 3: Process based on payment status
    if status in ["success", "completed", "paid"]:
        try:
            # Record the transaction (with idempotency check)
            record_payment_transaction(
                session=session,
                order_id=order.id,
                transaction_id=transaction_id,
                gateway="payshap",
                amount_cents=amount_cents,
                status="success",
                webhook_payload=json.dumps(payload)
            )
            
            # Transition order to HELD_IN_ESCROW
            transition_order_state(
                session=session,
                order_id=order.id,
                target_status=EscrowStatus.HELD_IN_ESCROW
            )
            
            # Mark webhook as processed
            mark_webhook_processed(
                session=session,
                transaction_id=transaction_id,
                gateway="payshap",
                signature=x_signature,
                payload=json.dumps(payload)
            )
            
            return {
                "status": "success",
                "order_id": order.id,
                "transaction_id": transaction_id,
                "new_state": EscrowStatus.HELD_IN_ESCROW.value
            }
            
        except DuplicateTransactionError as e:
            # Already processed - return success
            return {
                "status": "already_processed",
                "message": str(e)
            }
            
        except InvalidStateTransition as e:
            # State conflict - log but don't fail
            return {
                "status": "state_conflict",
                "message": str(e),
                "current_state": order.escrow_status.value
            }
    
    elif status in ["failed", "cancelled", "declined"]:
        # Record failed transaction
        record_payment_transaction(
            session=session,
            order_id=order.id,
            transaction_id=transaction_id,
            gateway="payshap",
            amount_cents=amount_cents,
            status="failed",
            webhook_payload=json.dumps(payload)
        )
        
        mark_webhook_processed(
            session=session,
            transaction_id=transaction_id,
            gateway="payshap",
            signature=x_signature,
            payload=json.dumps(payload)
        )
        
        return {
            "status": "payment_failed",
            "order_id": order.id,
            "transaction_id": transaction_id
        }
    
    else:
        # Unknown status - log for manual review
        return {
            "status": "unknown_status",
            "payload_status": status,
            "order_id": order.id
        }


async def process_payout_webhook(
    request: Request,
    session: Session,
    x_signature: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process payout confirmation webhook (when seller receives funds).
    
    Similar security model to payment webhook but handles outgoing transfers.
    """
    raw_body = await request.body()
    
    # Verify signature
    if not verify_hmac_signature(raw_body, x_signature or "", WEBHOOK_SECRET):
        raise HTTPException(
            status_code=401,
            detail="Invalid signature"
        )
    
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    transaction_id = payload.get("payout_id") or payload.get("transaction_id")
    order_ref = payload.get("order_reference")
    status = payload.get("status", "").lower()
    
    if not transaction_id:
        raise HTTPException(status_code=400, detail="Missing transaction_id")
    
    # Idempotency check
    if check_webhook_processed(session, transaction_id, "payout"):
        return {"status": "already_processed"}
    
    # Find order
    from app.models.escrow import Order
    order = None
    if order_ref:
        order = session.query(Order).filter(Order.order_reference == order_ref).first()
    
    if status in ["success", "completed", "paid"]:
        # Mark order as fully completed
        if order and order.escrow_status == EscrowStatus.DELIVERED_INSPECTION_WINDOW:
            transition_order_state(
                session=session,
                order_id=order.id,
                target_status=EscrowStatus.COMPLETED_PAID_OUT
            )
        
        mark_webhook_processed(
            session=session,
            transaction_id=transaction_id,
            gateway="payout",
            signature=x_signature,
            payload=json.dumps(payload)
        )
        
        return {
            "status": "success",
            "order_id": order.id if order else None,
            "transaction_id": transaction_id
        }
    
    return {"status": "pending_or_failed", "payload": payload}
