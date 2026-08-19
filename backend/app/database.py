"""
Database configuration and session management.
Supports PostgreSQL for production with connection pooling.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import Generator
import os

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/escrow_marketplace"
)

# Create engine with connection pooling optimized for VPS
engine = create_engine(
    DATABASE_URL,
    pool_size=10,  # Number of connections to keep open
    max_overflow=20,  # Additional connections allowed during spikes
    pool_pre_ping=True,  # Verify connections before use
    echo=os.getenv("SQL_ECHO", "false").lower() == "true"  # SQL logging for debugging
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db() -> Generator:
    """
    Dependency for FastAPI routes to get database session.
    
    Usage in routes:
        @app.get("/orders")
        def get_orders(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database tables.
    Call this on application startup or during deployment.
    """
    from app.models.escrow import Base as EscrowBase
    
    # Import all models to ensure they're registered
    import app.models.escrow
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    print("Database tables created successfully!")


if __name__ == "__main__":
    # Run directly to initialize database
    init_db()
