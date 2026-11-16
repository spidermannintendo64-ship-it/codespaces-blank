from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import Base, engine, get_db
from models import TrackedCompetitorItem, PriceStockLog
from monitor_engine import MarketMonitorEngine

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Automated Competitor & Market Price Monitor",
    description="Standalone market intelligence engine for tracking competitor pricing, stockouts, and margin positioning.",
    version="1.0.0",
)

class TrackItemRequest(BaseModel):
    competitor_name: str
    product_name: str
    category: str = "General"
    our_target_price: float | None = None
    url: str
    price_selector: str
    stock_selector: str | None = None

class SimulateUpdateRequest(BaseModel):
    simulated_price: float
    simulated_in_stock: bool

@app.get("/")
def health_check():
    return {"status": "online", "service": "Competitor & Market Price Monitor"}

@app.post("/api/v1/items/track", tags=["Tracking"])
def track_new_item(payload: TrackItemRequest, db: Session = Depends(get_db)):
    if db.query(TrackedCompetitorItem).filter(TrackedCompetitorItem.url == payload.url).first():
        raise HTTPException(status_code=400, detail="URL is already being monitored.")

    new_item = TrackedCompetitorItem(**payload.model_dump())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    monitor = MarketMonitorEngine(db)
    try:
        return monitor.scan_item(new_item)
    except Exception as e:
        return {
            "id": new_item.id,
            "message": "Item saved, but initial live scrape failed (check URL or CSS selector).",
            "error": str(e),
        }

@app.get("/api/v1/items", tags=["Tracking"])
def list_tracked_items(db: Session = Depends(get_db)):
    items = db.query(TrackedCompetitorItem).all()
    return [
        {
            "id": i.id,
            "competitor_name": i.competitor_name,
            "product_name": i.product_name,
            "category": i.category,
            "current_price": i.current_price,
            "our_target_price": i.our_target_price,
            "price_gap": round(i.current_price - i.our_target_price, 2)
            if (i.current_price is not None and i.our_target_price is not None)
            else None,
            "in_stock": i.in_stock,
            "last_checked": i.last_checked.isoformat() if i.last_checked else None,
        }
        for i in items
    ]

@app.post("/api/v1/scan/all", tags=["Scanner"])
def run_full_market_scan(db: Session = Depends(get_db)):
    monitor = MarketMonitorEngine(db)
    return {"results": monitor.scan_all()}

@app.post("/api/v1/items/{item_id}/simulate", tags=["Testing & Simulation"])
def simulate_market_change(item_id: int, payload: SimulateUpdateRequest, db: Session = Depends(get_db)):
    item = db.query(TrackedCompetitorItem).filter(TrackedCompetitorItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Tracked item not found.")

    events = []
    if item.current_price is None:
        events.append("INITIAL")
    else:
        if payload.simulated_price < item.current_price:
            events.append("PRICE_DROP")
        elif payload.simulated_price > item.current_price:
            events.append("PRICE_HIKE")

    if payload.simulated_in_stock != item.in_stock:
        events.append("BACK_IN_STOCK" if payload.simulated_in_stock else "OUT_OF_STOCK")

    item.current_price = payload.simulated_price
    item.in_stock = payload.simulated_in_stock
    item.last_checked = datetime.utcnow()

    price_gap = round(item.current_price - item.our_target_price, 2) if item.our_target_price else None

    for ev in events:
        db.add(PriceStockLog(
            tracked_item_id=item.id,
            recorded_price=item.current_price,
            in_stock=item.in_stock,
            event_type=ev,
            price_diff_vs_ours=price_gap,
        ))

    db.commit()
    return {
        "id": item.id,
        "product_name": item.product_name,
        "new_price": item.current_price,
        "in_stock": item.in_stock,
        "price_gap_vs_ours": price_gap,
        "events_triggered": events,
    }

@app.get("/api/v1/alerts", tags=["Intelligence & Alerts"])
def get_market_alerts(limit: int = 30, db: Session = Depends(get_db)):
    logs = (
        db.query(PriceStockLog)
        .filter(PriceStockLog.event_type != "INITIAL")
        .order_by(PriceStockLog.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "alert_id": log.id,
            "competitor_name": log.item.competitor_name,
            "product_name": log.item.product_name,
            "event_type": log.event_type,
            "recorded_price": log.recorded_price,
            "our_target_price": log.item.our_target_price,
            "price_diff_vs_ours": log.price_diff_vs_ours,
            "in_stock": log.in_stock,
            "recorded_at": log.recorded_at.isoformat(),
        }
        for log in logs
    ]