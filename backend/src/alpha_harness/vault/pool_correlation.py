"""Power Pool correlations measured over BRAIN's submission window."""

from bisect import bisect_left
from datetime import date
from typing import Any

import numpy as np
import numpy.typing as npt

from ..tools import submission_planner
from . import metrics

type PnlGrid = tuple[list[str], list[date], npt.NDArray[np.float64]]


def below_ceiling(
    grid: PnlGrid,
    meta: dict[str, dict[str, Any]],
    alpha_id: str,
    pool: list[str],
) -> bool | None:
    """Whether every Power Pool comparison is measurable and below BRAIN's ceiling."""
    members = list(dict.fromkeys(member for member in pool if member != alpha_id))
    if not members:
        return True
    ids = set(grid[0])
    if alpha_id not in ids or any(member not in ids for member in members):
        return None
    rho = correlation_matrix(grid, meta, [alpha_id], members)
    if rho.size == 0 or not np.isfinite(rho).all():
        return None
    return bool(float(rho.max()) < submission_planner.CEILING)


def correlation_matrix(
    grid: PnlGrid,
    meta: dict[str, dict[str, Any]],
    left: list[str],
    right: list[str],
) -> npt.NDArray[np.float64]:
    """BRAIN-window correlations for two Alpha lists, preserving unknown pairs as NaN."""
    ids, dates, pnl = grid
    at = {alpha_id: i for i, alpha_id in enumerate(ids)}
    rho = np.full((len(left), len(right)), np.nan)
    if not left or not right:
        return rho
    cols = [at[alpha_id] for alpha_id in (*left, *right)]
    traded = ~np.isnan(pnl[:, cols])
    stored_last = [dates[i] for i in len(dates) - 1 - traded[::-1].argmax(axis=0)]
    # Closing days move where BRAIN's window ends, as ``portfolio.frame`` counts them, but
    # are never correlated: that is what makes these match BRAIN's own figures.
    last = max(
        metrics.with_closing([(day, 0.0, 0.0)], meta.get(alpha_id, {}))[-1][0]
        for alpha_id, day in zip((*left, *right), stored_last, strict=True)
    )
    window = pnl[bisect_left(dates, submission_planner.window_start(last)) :]
    return submission_planner.correlations(
        window[:, cols[: len(left)]], window[:, cols[len(left) :]]
    )
