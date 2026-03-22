import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class LendingRecord(TimestampMixin, Base):
    __tablename__ = "lending_records"

    item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=False
    )
    borrower_name: Mapped[str] = mapped_column(String(255), nullable=False)
    borrower_contact: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    returned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    item: Mapped["Item"] = relationship(back_populates="lending_records")  # noqa: F821
