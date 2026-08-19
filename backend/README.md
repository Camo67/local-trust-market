# P2P Escrow Marketplace - South Africa

Automated peer-to-peer marketplace with escrow protection, Paxi logistics integration, and PayShap real-time payments. **Zero SaaS fees** - self-hosted on your VPS.

## 🏗 Architecture

```
┌────────────────────────────────────────────────────────┐
│ 1. Buyer purchases item (PayShap via Ozow/Netcash)    │
│    Payment held in Escrow Ledger                       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 2. Seller drops at PEP/Paxi, enters waybill           │
│    System tracks via API or web scraping               │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 3. Celery worker polls Paxi every 15min               │
│    Auto-detects "Collected by Buyer" status            │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 4. 48h inspection window starts                        │
│    WhatsApp reminder sent via OpenWA                   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 5. Buyer confirms OR auto-expiry → PayShap payout     │
│    Seller receives funds in seconds                    │
└────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- PostgreSQL 14+
- Redis (for Celery)
- VPS (Hetzner Cape Town or AWS af-south-1 recommended)

### Installation

```bash
# Clone and setup
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Environment variables
cp .env.example .env
# Edit .env with your database URL, webhook secrets, etc.

# Initialize database
python -m app.database

# Run API server
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Run Celery worker (in separate terminal)
celery -A app.worker.celery_app worker --loglevel=info

# Run Celery beat for scheduled tasks
celery -A app.worker.celery_app beat --loglevel=info
```

### Docker Deployment (Recommended)

```bash
docker-compose up -d
```

## 📁 Project Structure

```
backend/
├── app/
│   ├── models/
│   │   └── escrow.py          # SQLAlchemy models with state machine
│   ├── services/
│   │   ├── ledger_service.py  # Concurrency-safe state transitions
│   │   ├── paxi_tracker.py    # Paxi API + web scraping fallback
│   │   ├── webhook_handler.py # HMAC verification & idempotency
│   │   ├── payout_service.py  # PayShap payout logic (TODO)
│   │   └── whatsapp_service.py # OpenWA integration (TODO)
│   ├── api/
│   │   └── routes.py          # REST endpoints
│   ├── worker.py              # Celery tasks for background jobs
│   ├── database.py            # DB connection & session management
│   └── main.py                # FastAPI application
├── tests/
├── requirements.txt
└── .env.example
```

## 🔒 Security Features

### 1. Database Row Locking
Prevents race conditions during state transitions:
```python
order = session.query(Order).filter(Order.id == order_id).with_for_update().first()
```

### 2. Strict State Machine
Only valid transitions allowed:
```
PENDING_PAYMENT → HELD_IN_ESCROW → SHIPPED → DELIVERED_INSPECTION_WINDOW → COMPLETED_PAID_OUT
                                        ↓                              ↓
                                   REFUNDED                      DISPUTE_LOCKED
```

### 3. Webhook Idempotency
Prevents double-processing of payment callbacks:
- HMAC signature verification
- Transaction ID deduplication
- Audit logging

### 4. Amount Precision
All monetary values stored in **cents** (integers) to avoid floating-point errors.

## 📡 API Endpoints

### Orders
- `GET /orders` - List orders (filter by status, user_id)
- `GET /orders/{id}` - Get order details
- `POST /orders/{id}/ship` - Register Paxi waybill
- `POST /orders/{id}/confirm-delivery` - Start inspection window
- `POST /orders/{id}/confirm-satisfaction` - Trigger payout
- `POST /orders/{id}/dispute` - Open dispute

### Webhooks
- `POST /webhooks/payshap/confirm` - Payment confirmation
- `POST /webhooks/payout/confirm` - Payout completion

### Paxi Tracking
- `GET /paxi/track/{waybill}` - Track single waybill
- `POST /paxi/batch-track` - Batch track multiple waybills

### Admin
- `GET /admin/disputes` - List open disputes
- `POST /admin/disputes/{id}/resolve` - Resolve dispute

## 🔄 Background Tasks (Celery Beat)

| Task | Frequency | Purpose |
|------|-----------|---------|
| `poll_all_active_shipments` | Every 15 min | Check Paxi status for all shipped orders |
| `process_inspection_deadlines` | Every hour | Auto-complete expired inspection windows |
| `send_inspection_reminder` | On delivery + 24h | WhatsApp reminder to buyer |

## 💰 Revenue Model

| Component | Cost | Your Margin |
|-----------|------|-------------|
| Payment Gateway (PayShap) | R0-R3 per transaction | - |
| Paxi Tracking | R0 (self-hosted) | - |
| Platform Fee | - | **5-10% per sale** |
| Payout Fee | R2-R5 per payout | Can pass to seller |

**Example:** R500 sale
- Card gateway fees: ~R15 (3%)
- PayShap fees: ~R2 (0.4%)
- **Your savings: R13 per transaction**

## 🛠 Production Checklist

- [ ] Set strong `WEBHOOK_SECRET` in environment
- [ ] Configure PostgreSQL connection pooling
- [ ] Set up SSL with Caddy or Nginx
- [ ] Configure Ozow/Netcash PayShap API credentials
- [ ] Test Paxi web scraping fallback
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Configure log rotation
- [ ] Backup strategy for PostgreSQL
- [ ] Load testing with Locust

## 📝 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/escrow_marketplace
SQL_ECHO=false

# Redis/Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Security
WEBHOOK_SECRET=your_super_secret_key_here
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Paxi (optional - falls back to web scraping)
PAXI_API_KEY=your_api_key_if_available

# Payment Gateway
OZOW_API_KEY=your_ozow_key
OZOW_PRIVATE_KEY=your_ozow_private_key

# WhatsApp (OpenWA)
OPENWA_INSTANCE_ID=your_instance
OPENWA_TOKEN=your_token
```

## 🧪 Testing

```bash
# Run tests
pytest tests/

# Test specific module
pytest tests/test_ledger_service.py -v
```

## 📚 Next Steps

1. **Implement PayShap Payout Service** - Integrate with Ozow/Netcash payout API
2. **WhatsApp Integration** - Set up OpenWA for automated notifications
3. **Frontend Dashboard** - Connect to your React/Vue frontend
4. **Admin Panel** - Build dispute resolution interface
5. **Load Testing** - Simulate high concurrent transactions

## 📄 License

MIT License - Self-host with zero software fees.

---

**Built for the South African market** with local payment rails (PayShap) and logistics (Paxi/PEP Stores).
