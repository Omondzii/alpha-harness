"""Super Alpha Lab: SuperAlphas built from your own submitted Alphas, ready to submit.

A SuperAlpha is a selection expression, ranking every submitted ``ACTIVE`` Alpha of the
region and delay and keeping the top ``selectionLimit``, and a combo expression, weighting
the kept Alphas each day. Users select their expressions from submitted SuperAlphas or
provide their own. Each pairing runs at the chosen decay and truncation, and BRAIN's own
checks say which are submittable.

Every selection caps each Alpha's operators at 8,000 / limit: BRAIN warns rather than
fails past 8,000 operators in all, and drops what does not fit.
"""

from dataclasses import dataclass
from typing import TYPE_CHECKING

from ..brain.schemas import (
    FULL_MODE,
    TEST_PERIOD,
    SimulationRequest,
    SimulationSettings,
    SimulationType,
)
from ..db.models import Trial, TrialState
from .scheduler import PENDING_SEND
from .template import INVESTABILITY, Investability

if TYPE_CHECKING:
    from collections.abc import Callable

#: BRAIN's own ceiling on operators across every selected Alpha.
OPERATOR_LIMIT = 8000
#: The least ``selectionLimit`` BRAIN accepts.
MIN_SELECTION = 10
#: Match Template Lab defaults; both are editable per task.
DEFAULT_DECAY = 0
DEFAULT_TRUNCATION = 0.08


@dataclass(frozen=True, slots=True)
class Recipe:
    name: str
    code: str


@dataclass(frozen=True, slots=True)
class Candidate:
    selection: Recipe
    combo: Recipe
    universe: str
    neutralization: str
    investability: Investability
    request: SimulationRequest

    @property
    def name(self) -> str:
        label = self.investability.replace("_", " ").title()
        return (
            f"{self.selection.name} · {self.combo.name} · {self.universe} · "
            f"{self.neutralization} · {label}"
        )


def candidates(
    *,
    region: str,
    delay: int,
    universes: list[str],
    neutralizations: list[str],
    selection_limit: int,
    decay: int = DEFAULT_DECAY,
    truncation: float = DEFAULT_TRUNCATION,
    pasteurization: str = "ON",
    unit_handling: str = "VERIFY",
    nan_handling: str = "ON",
    test_period: str = TEST_PERIOD,
    investability: list[Investability] | None = None,
    activations: list[str],
    selection_recipes: list[Recipe],
    combo_recipes: list[Recipe],
) -> list[Candidate]:
    """Every selection · combo · market · investability · activation, using chosen settings.

    Full mode always: only a Full simulation can be submitted, and Quick runs none of the
    correlation checks a SuperAlpha must also pass.
    """
    out: list[Candidate] = []
    for activation in activations:
        for invest in investability or ["none"]:
            max_trade, max_position = INVESTABILITY[invest]
            for universe in universes:
                for neutralization in neutralizations:
                    for selection in selection_recipes:
                        for combo in combo_recipes:
                            settings = SimulationSettings(
                                region=region,
                                delay=delay,
                                universe=universe,
                                neutralization=neutralization,
                                decay=decay,
                                truncation=truncation,
                                pasteurization=pasteurization,
                                unit_handling=unit_handling,
                                nan_handling=nan_handling,
                                test_period=test_period,
                                max_trade=max_trade,
                                max_position=max_position,
                                selection_handling="POSITIVE",
                                selection_limit=selection_limit,
                                component_activation=activation,
                                simulation_mode=FULL_MODE,
                            )
                            request = SimulationRequest(
                                type=SimulationType.SUPER,
                                settings=settings,
                                selection=selection.code,
                                combo=combo.code,
                            )
                            out.append(
                                Candidate(
                                    selection, combo, universe, neutralization, invest, request
                                )
                            )
    return out


def seed_trials(found: list[Candidate]) -> Callable[[int], list[Trial]]:
    """Parked trials for every candidate. Both expressions ride in ``params``, which
    ``send_parked`` reads; the trial's own expression names the recipe, the line a results
    table shows."""

    def build(study_id: int) -> list[Trial]:
        return [
            Trial(
                study_id=study_id,
                number=number,
                params={
                    "recipe": candidate.name,
                    "selection": candidate.request.selection,
                    "combo": candidate.request.combo,
                },
                distributions={},
                expression=(
                    f"{candidate.name} · Decay {candidate.request.settings.decay}"
                    f" · {candidate.request.settings.component_activation}"
                ),
                settings=candidate.request.settings.model_dump(by_alias=True, exclude_none=True),
                state=TrialState.PRUNED,
                message=PENDING_SEND,
            )
            for number, candidate in enumerate(found)
        ]

    return build


if __name__ == "__main__":
    import sys

    from ..engine.lifecycle import request_hash
    from ..engine.packer import key_of
    from .scheduler import request_of

    limit = 40
    chosen_decay = 9
    chosen_truncation = 0.23
    found = candidates(
        region="USA",
        delay=1,
        universes=["TOP3000"],
        neutralizations=["SUBINDUSTRY"],
        selection_limit=limit,
        decay=chosen_decay,
        truncation=chosen_truncation,
        activations=["IS", "OS"],
        selection_recipes=[Recipe("Sample selection", "(operator_count <= 200)")],
        combo_recipes=[Recipe("Sample combo", "1")],
    )
    trials = seed_trials(found)(1)
    wires = [c.request.to_wire() for c in found]
    market_sweep = candidates(
        region="USA",
        delay=1,
        universes=["TOP3000", "TOP1000"],
        neutralizations=["SUBINDUSTRY", "STATISTICAL"],
        selection_limit=limit,
        activations=["IS"],
        selection_recipes=[Recipe("Sample selection", "(operator_count <= 200)")],
        combo_recipes=[Recipe("Sample combo", "1")],
    )
    checks = {
        "every pairing at one decay and every activation": len(found) == 2,
        "every selected universe/neutralization pair is simulated": {
            (c.request.settings.universe, c.request.settings.neutralization) for c in market_sweep
        }
        == {
            (universe, neutralization)
            for universe in ["TOP3000", "TOP1000"]
            for neutralization in ["SUBINDUSTRY", "STATISTICAL"]
        },
        "chosen decay and truncation reach BRAIN": all(
            w["settings"]["decay"] == chosen_decay
            and w["settings"]["truncation"] == chosen_truncation
            for w in wires
        ),
        "remaining platform settings reach BRAIN": all(
            w["settings"]["pasteurization"] == "ON"
            and w["settings"]["unitHandling"] == "VERIFY"
            and w["settings"]["nanHandling"] == "ON"
            and w["settings"]["testPeriod"] == TEST_PERIOD
            and w["settings"]["maxTrade"] == "OFF"
            and w["settings"]["maxPosition"] == "OFF"
            for w in wires
        ),
        "no two alike": len({request_hash(c.request) for c in found}) == len(found),
        "operators capped at 8,000 / limit": all(
            c.request.selection is not None
            and f"(operator_count <= {OPERATOR_LIMIT // limit})" in c.request.selection
            for c in found
        ),
        "SUPER, Full, Positive, as asked": all(
            w["type"] == "SUPER"
            and w["settings"]["simulationMode"] == FULL_MODE
            and w["settings"]["selectionHandling"] == "POSITIVE"
            and w["settings"]["selectionLimit"] == limit
            and w["selection"]
            and w["combo"]
            for w in wires
        ),
        "a written trial sends the same simulation": all(
            request_hash(request_of(t)) == request_hash(c.request)
            for t, c in zip(trials, found, strict=True)
        ),
        "written trial keeps chosen decay and truncation": all(
            request_of(t).settings.decay == chosen_decay
            and request_of(t).settings.truncation == chosen_truncation
            for t in trials
        ),
        "never batched": all(key_of(w).max_batch == 1 for w in wires),
    }
    if failed := [check for check, ok in checks.items() if not ok]:
        raise SystemExit(f"super alpha self-check failed: {'; '.join(failed)}")
    sys.stdout.write(f"{len(found)} SuperAlpha simulations, e.g. {trials[0].expression}\n")
