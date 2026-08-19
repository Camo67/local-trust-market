"""
Ledger service with concurrency guarding and strict state transitions.
Prevents race conditions in escrow operations.
"""
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from typing import Optional

from app.models.escrow import Order, EscrowStatus, PaymentTransaction, Dispute, WebhookLog


class InvalidStateTransition(Exception):
    """Raised when an invalid state transition is attempted."""
    pass


class OrderNotFoundError(Exception):
    """Raised when an order is not found."""
    pass


class DuplicateTransactionError(Exception):
    """Raised when a duplicate transaction is detected."""
    pass


# Strict state machine definition
VALID_TRANSITIONS = {
    EscrowStatus.PENDING_PAYMENT: [EscrowStatus.HELD_IN_ESCROW, EscrowStatus.REFUNDED],
    EscrowStatus.HELD_IN_ESCROW: [EscrowStatus.SHIPPED, EscrowStatus.REFUNDED],
    EscrowStatus.SHIPPED: [EscrowStatus.DELIVERED_INSPECTION_WINDOW, EscrowStatus.DISPUTE_LOCKED],
    EscrowStatus.DELIVERED_INSPECTION_WINDOW: [EscrowStatus.COMPLETED_PAID_OUT, EscrowStatus.DISPUTE_LOCKED],
    EscrowStatus.DISPUTE_LOCKED: [EscrowStatus.COMPLETED_PAID_OUT, EscrowStatus.REFUNDED],
    EscrowStatus.COMPLETED_PAID_OUT: [],  # Terminal state
    EscrowStatus.REFUNDED: [],  # Terminal state
}


def transition_order_state(
    session: Session, 
    order_id: int, 
    target_status: EscrowStatus,
    extra_data: Optional[dict] = None
) -> Order:
    """
    Safely lock the order row and execute a verified state transition.
    
    Uses SELECT FOR UPDATE to prevent race conditions where multiple
    processes might try to transition the same order simultaneously.
    
    Args:
        session: SQLAlchemy database session
        order_id: The order ID to transition
        target_status: The target escrow status
        extra_data: Optional dict with additional fields to update
        
    Returns:
        The updated Order object
        
    Raises:
        OrderNotFoundError: If the order doesn't exist
        InvalidStateTransition: If the transition violates the state machine
    """
    # Lock the row for update - this blocks other transactions until commit
    order = session.query(Order).filter(Order.id == order_id).with_for_update().first()
    
    if not order:
        raise OrderNotFoundError(f"Order {order_id} not found")
    
    current_status = order.escrow_status
    
    # Validate state transition
    allowed_transitions = VALID_TRANSITIONS.get(current_status, [])
    if target_status not in allowed_transitions:
        raise InvalidStateTransition(
            f"Cannot transition from {current_status.value} to {target_status.value}. "
            f"Allowed: {[s.value for s in allowed_transitions]}"
        )
    
    # Apply the transition
    order.escrow_status = target_status
    order.updated_at = datetime.utcnow()
    
    # Set timestamps for specific transitions
    if target_status == EscrowStatus.HELD_IN_ESCROW:
        order.paid_at = datetime.utcnow()
    elif target_status == EscrowStatus.SHIPPED:
        order.shipped_at = datetime.utcnow()
    elif target_status == EscrowStatus.DELIVERED_INSPECTION_WINDOW:
        order.delivered_at = datetime.utcnow()
        order.start_inspection_window(hours=48)
    elif target_status == EscrowStatus.COMPLETED_PAID_OUT:
        order.completed_at = datetime.utcnow()
    
    # Apply any extra data updates
    if extra_data:
        for key, value in extra_data.items():
            if hasattr(order, key):
                setattr(order, key, value)
    
    session.commit()
    session.refresh(order)
    
    return order


def record_payment_transaction(
    session: Session,
    order_id: int,
    transaction_id: str,
    gateway: str,
    amount_cents: int,
    status: str = "success",
    webhook_payload: Optional[str] = None
) -> PaymentTransaction:
    """
    Record a payment transaction with idempotency check.
    
    Prevents double-processing of the same gateway transaction.
    
    Args:
        session: SQLAlchemy database session
        order_id: The associated order ID
        transaction_id: Unique transaction ID from the payment gateway
        gateway: Gateway name (e.g., 'ozow', 'payshap')
        amount_cents: Transaction amount in cents
        status: Transaction status
        webhook_payload: Raw webhook payload for audit
        
    Returns:
        The created PaymentTransaction object
        
    Raises:
        DuplicateTransactionError: If this transaction was already processed
    """
    # Check if transaction already exists (idempotency)
    existing = session.query(PaymentTransaction).filter(
        PaymentTransaction.transaction_id == transaction_id
    ).first()
    
    if existing:
        raise DuplicateTransactionError(
            f"Transaction {transaction_id} already processed at {existing.processed_at}"
        )
    
    # Create new transaction record
    transaction = PaymentTransaction(
        order_id=order_id,
        transaction_id=transaction_id,
        gateway=gateway,
        amount_cents=amount_cents,
        status=status,
        webhook_payload=webhook_payload,
        processed_at=datetime.utcnow() if status == "success" else None
    )
    
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    
    return transaction


def check_webhook_processed(
    session: Session,
    transaction_id: str,
    gateway: str
) -> bool:
    """
    Check if a webhook has already been processed (idempotency guard).
    
    Args:
        session: SQLAlchemy database session
        transaction_id: Unique transaction ID
        gateway: Gateway name
        
    Returns:
        True if already processed, False otherwise
    """
    log = session.query(WebhookLog).filter(
        WebhookLog.transaction_id == transaction_id,
        WebhookLog.gateway == gateway
    ).first()
    
    return log is not None and log.processed


def mark_webhook_processed(
    session: Session,
    transaction_id: str,
    gateway: str,
    signature: Optional[str] = None,
    payload: Optional[str] = None
) -> WebhookLog:
    """
    Mark a webhook as processed for idempotency tracking.
    
    Args:
        session: SQLAlchemy database session
        transaction_id: Unique transaction ID
        gateway: Gateway name
        signature: Webhook signature for verification
        payload: Raw webhook payload
        
    Returns:
        The created WebhookLog object
    """
    log = WebhookLog(
        transaction_id=transaction_id,
        gateway=gateway,
        signature=signature,
        payload=payload or "{}",
        processed=True
    )
    
    session.add(log)
    session.commit()
    session.refresh(log)
    
    return log


def create_dispute(
    session: Session,
    order_id: int,
    reason: str,
    unboxing_video_url: Optional[str] = None,
    buyer_evidence_urls: Optional[list] = None
) -> Dispute:
    """
    Create a dispute and lock the order state.
    
    Args:
        session: SQLAlchemy database session
        order_id: The order ID to dispute
        reason: Dispute reason
        unboxing_video_url: URL to unboxing video evidence
        buyer_evidence_urls: List of evidence URLs
        
    Returns:
        The created Dispute object
    """
    import json
    
    # First, lock the order and transition to DISPUTE_LOCKED
    # This will fail if order is not in a valid state for dispute
    transition_order_state(
        session=session,
        order_id=order_id,
        target_status=EscrowStatus.DISPUTE_LOCKED
    )
    
    # Create the dispute record
    dispute = Dispute(
        order_id=order_id,
        reason=reason,
        unboxing_video_url=unboxing_video_url,
        buyer_evidence_urls=json.dumps(buyer_evidence_urls) if buyer_evidence_urls else None,
        status="open"
    )
    
    session.add(dispute)
    session.commit()
    session.refresh(dispute)
    
    return dispute
