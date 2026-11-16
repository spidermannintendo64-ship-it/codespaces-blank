from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class TrackedCompetitorItem(Base):
    __tablename__ = "tracked_items"

    id = Column(Integer, primary_key=True, index=True)
    competitor_name = Column(String, index=True, nullable=False)
    product_name = Column(String, nullable=False)
    category = Column(String, default="General", index=True)
    our_target_price = Column(Float, nullable=True)
    url = Column(String, unique=True, nullable=False)

    price_selector = Column(String, nullable=False)
    stock_selector = Column(String, nullable=True)

    current_price = Column(Float, nullable=True)
    in_stock = Column(Boolean, default=True)
    last_checked = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    history = relationship("PriceStockLog", back_populates="item", cascade="all, delete-orphan")


class PriceStockLog(Base):
    __tablename__ = "price_stock_logs"

    id = Column(Integer, primary_key=True, index=True)
    tracked_item_id = Column(Integer, ForeignKey("tracked_items.id"), nullable=False)
    recorded_price = Column(Float, nullable=True)
    in_stock = Column(Boolean, default=True)
    event_type = Column(String, nullable=False)
    price_diff_vs_ours = Column(Float, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("TrackedCompetitorItem", back_populates="history")
