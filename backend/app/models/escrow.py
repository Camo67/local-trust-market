"""
Database models for the P2P Escrow Marketplace.
Implements strict state machine for escrow transitions.
"""
from datetime import datetime, timedelta
from enum import Enum
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum as SQLEnum, Boolean, Text
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class EscrowStatus(str, Enum):
    """Strict state machine for escrow lifecycle."""
    PENDING_PAYMENT = "pending_payment"
    HELD_IN_ESCROW = "held_in_escrow"
    SHIPPED = "shipped"
    DELIVERED_INSPECTION_WINDOW = "delivered_inspection_window"
    COMPLETED_PAID_OUT = "completed_paid_out"
    REFUNDED = "refunded"
    DISPUTE_LOCKED = "dispute_locked"


class Order(Base):
    """
    Core order model with escrow state tracking.
    All financial amounts stored in cents (ZAR) to avoid floating point issues.
    """
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_reference = Column(String(50), unique=True, nullable=False, index=True)
    
    # Financial fields (in cents)
    total_amount_cents = Column(Integer, nullable=False)
    platform_fee_cents = Column(Integer, nullable=False)  # e.g., 5-10% of total
    seller_payout_cents = Column(Integer, nullable=False)  # total - platform_fee
    
    # Escrow state
    escrow_status = Column(SQLEnum(EscrowStatus), default=EscrowStatus.PENDING_PAYMENT, nullable=False)
    
    # Paxi logistics
    paxi_waybill = Column(String(50), unique=True, nullable=True)
    paxi_tracking_data = Column(Text, nullable=True)  # JSON string of tracking events
    
    # Inspection window
    inspection_deadline = Column(DateTime, nullable=True)
    inspection_video_url = Column(String(500), nullable=True)  # For disputes
    
    # Parties
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    paid_at = Column(DateTime, nullable=True)
    shipped_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    buyer = relationship("User", foreign_keys=[buyer_id], back_populates="buyer_orders")
    seller = relationship("User", foreign_keys=[seller_id], back_populates="seller_orders")
    payment_transactions = relationship("PaymentTransaction", back_populates="order", cascade="all, delete-orphan")
    dispute = relationship("Dispute", back_populates="order", uselist=False, cascade="all, delete-orphan")

    def start_inspection_window(self, hours: int = 48):
        """Start the 48-hour inspection window after delivery."""
        self.inspection_deadline = datetime.utcnow() + timedelta(hours=hours)
    
    def is_inspection_expired(self) -> bool:
        """Check if inspection window has expired."""
        if not self.inspection_deadline:
            return False
        return datetime.utcnow() > self.inspection_deadline


class User(Base):
    """User model for buyers and sellers."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone_number = Column(String(20), nullable=True)  # For ShapID
    shapid = Column(String(100), nullable=True)  # e.g., 0821234567@capitec
    
    # Banking details for payouts
    bank_name = Column(String(50), nullable=True)
    account_number_encrypted = Column(String(500), nullable=True)
    branch_code = Column(String(10), nullable=True)
    
    # Verification
    is_verified = Column(Boolean, default=False)
    id_document_url = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    buyer_orders = relationship("Order", foreign_keys="Order.buyer_id", back_populates="buyer")
    seller_orders = relationship("Order", foreign_keys="Order.seller_id", back_populates="seller")


class PaymentTransaction(Base):
    """
    Tracks all payment events for idempotency and audit.
    Critical for preventing double-processing of webhooks.
    """
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    
    # Gateway reference
    transaction_id = Column(String(100), unique=True, nullable=False, index=True)  # Gateway's transaction ID
    gateway = Column(String(50), nullable=False)  # e.g., 'ozow', 'payfast', 'payshap'
    
    # Amount (in cents)
    amount_cents = Column(Integer, nullable=False)
    
    # Status
    status = Column(String(50), default="pending", nullable=False)  # pending, success, failed, refunded
    
    # Idempotency
    processed_at = Column(DateTime, nullable=True)
    webhook_payload = Column(Text, nullable=True)  # Store raw webhook for audit
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    order = relationship("Order", back_populates="payment_transactions")


class Dispute(Base):
    """Dispute case for flagged orders."""
    __tablename__ = "disputes"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    
    reason = Column(Text, nullable=False)
    status = Column(String(50), default="open", nullable=False)  # open, under_review, resolved_buyer, resolved_seller
    
    # Evidence
    buyer_evidence_urls = Column(Text, nullable=True)  # JSON array of URLs
    seller_evidence_urls = Column(Text, nullable=True)  # JSON array of URLs
    unboxing_video_url = Column(String(500), nullable=True)
    
    # Resolution
    resolution_notes = Column(Text, nullable=True)
    resolved_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    payout_decision_cents = Column(Integer, nullable=True)  # Final payout amount (could be partial)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    
    order = relationship("Order", back_populates="dispute")


class WebhookLog(Base):
    """Audit log for all incoming webhooks (idempotency tracking)."""
    __tablename__ = "webhook_logs"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(100), unique=True, nullable=False, index=True)
    gateway = Column(String(50), nullable=False)
    signature = Column(String(500), nullable=True)
    payload = Column(Text, nullable=False)
    processed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
