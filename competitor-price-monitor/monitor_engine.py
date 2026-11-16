import re
from datetime import datetime
import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from models import TrackedCompetitorItem, PriceStockLog

class MarketMonitorEngine:
    def __init__(self, db: Session):
        self.db = db
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        }

    def _clean_price(self, text: str | None) -> float | None:
        if not text:
            return None
        cleaned = re.sub(r"[^\d.]", "", text)
        try:
            return round(float(cleaned), 2)
        except ValueError:
            return None

    def _check_stock_status(self, text: str | None) -> bool:
        if not text:
            return True
        lowered = text.lower()
        unavailable_terms = ["out of stock", "sold out", "unavailable", "backorder", "notify me"]
        return not any(term in lowered for term in unavailable_terms)

    def scan_item(self, item: TrackedCompetitorItem) -> dict:
        with httpx.Client(headers=self.headers, timeout=15.0, follow_redirects=True) as client:
            resp = client.get(item.url)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        price_node = soup.select_one(item.price_selector)
        new_price = self._clean_price(price_node.get_text(strip=True)) if price_node else None

        stock_node = soup.select_one(item.stock_selector) if item.stock_selector else None
        new_stock = self._check_stock_status(stock_node.get_text(strip=True) if stock_node else None)

        events = []
        if item.last_checked is None:
            events.append("INITIAL")
        else:
            if new_price is not None and item.current_price is not None:
                if new_price < item.current_price:
                    events.append("PRICE_DROP")
                elif new_price > item.current_price:
                    events.append("PRICE_HIKE")

            if new_stock != item.in_stock:
                events.append("BACK_IN_STOCK" if new_stock else "OUT_OF_STOCK")

        if new_price is not None:
            item.current_price = new_price
        item.in_stock = new_stock
        item.last_checked = datetime.utcnow()

        price_gap = None
        if item.current_price is not None and item.our_target_price is not None:
            price_gap = round(item.current_price - item.our_target_price, 2)

        for event in events:
            log = PriceStockLog(
                tracked_item_id=item.id,
                recorded_price=item.current_price,
                in_stock=item.in_stock,
                event_type=event,
                price_diff_vs_ours=price_gap,
            )
            self.db.add(log)

        self.db.commit()
        self.db.refresh(item)

        return {
            "id": item.id,
            "competitor_name": item.competitor_name,
            "product_name": item.product_name,
            "category": item.category,
            "current_price": item.current_price,
            "our_target_price": item.our_target_price,
            "price_gap_vs_ours": price_gap,
            "in_stock": item.in_stock,
            "events_triggered": events,
            "last_checked": item.last_checked.isoformat(),
        }

    def scan_all(self) -> list[dict]:
        items = self.db.query(TrackedCompetitorItem).all()
        results = []
        for item in items:
            try:
                results.append(self.scan_item(item))
            except Exception as exc:
                results.append({
                    "id": item.id,
                    "competitor_name": item.competitor_name,
                    "product_name": item.product_name,
                    "error": str(exc),
                })
        return results
