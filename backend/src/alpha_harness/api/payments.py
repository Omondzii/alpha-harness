"""The authenticated account's base and other payment activity."""

import asyncio
from typing import Any

from fastapi import APIRouter

from ..schemas import Out
from .deps import State

router = APIRouter(prefix="/api/payments", tags=["payments"])


class PaymentPeriod(Out):
    start: str | None = None
    end: str | None = None
    value: float | None = None
    regular_alpha: float | None = None
    super_alpha: float | None = None


class BasePaymentRecord(Out):
    date: str
    regular_alpha: float | None
    super_alpha: float | None


class OtherPaymentRecord(Out):
    date: str
    value: float
    description: str


class BasePayments(Out):
    currency: str
    periods: dict[str, PaymentPeriod]
    records: list[BasePaymentRecord]


class OtherPayments(Out):
    currency: str
    total: PaymentPeriod
    records: list[OtherPaymentRecord]


class PaymentOverview(Out):
    base: BasePayments
    other: OtherPayments


def _record_rows(payload: dict[str, Any], activity: str) -> list[list[Any]]:
    records = payload.get("records")
    rows = records.get("records") if isinstance(records, dict) else None
    if not isinstance(rows, list):
        raise ValueError(f"BRAIN returned no records for {activity}.")
    return rows


def _base_payments(payload: dict[str, Any]) -> BasePayments:
    periods = {
        key: PaymentPeriod.model_validate(value)
        for key in ("yesterday", "current", "previous", "ytd", "total")
        if isinstance((value := payload.get(key)), dict)
    }
    rows = _record_rows(payload, "base-payment")
    parsed = [
        BasePaymentRecord(
            date=row[0],
            regular_alpha=row[1] if len(row) > 1 else None,
            super_alpha=row[2] if len(row) > 2 else None,
        )
        for row in rows
        if isinstance(row, list) and 1 <= len(row) <= 3
    ]
    if len(parsed) != len(rows):
        raise ValueError(
            "BRAIN returned a malformed base-payment record; expected date, regular amount, "
            "and optional trailing amount values."
        )
    return BasePayments(
        currency=str(payload.get("currency") or ""),
        periods=periods,
        records=parsed,
    )


def _other_payments(payload: dict[str, Any]) -> OtherPayments:
    total = payload.get("total")
    if not isinstance(total, dict):
        raise ValueError("BRAIN returned no total for other-payment.")
    rows = _record_rows(payload, "other-payment")
    parsed = [
        OtherPaymentRecord(date=row[0], value=row[1], description=row[2])
        for row in rows
        if isinstance(row, list) and len(row) >= 3
    ]
    if len(parsed) != len(rows):
        raise ValueError("BRAIN returned a malformed other-payment record.")
    return OtherPayments(
        currency=str(payload.get("currency") or ""),
        total=PaymentPeriod.model_validate(total),
        records=parsed,
    )


@router.get("")
async def payment_overview(state: State) -> PaymentOverview:
    """Fetch payment feeds from BRAIN without storing account payment data locally."""
    base, other = await asyncio.gather(
        state.endpoints.payment_activity("base-payment"),
        state.endpoints.payment_activity("other-payment"),
    )
    return PaymentOverview(
        base=_base_payments(base),
        other=_other_payments(other),
    )
