"""Super Alpha Lab: one form, one task of SuperAlphas from your own submitted Alphas."""

from typing import Literal

from fastapi import APIRouter
from pydantic import Field

from ..db.models import utcnow
from ..engine.packer import MAX_BATCH
from ..labs import super_alpha
from ..labs.launch import AddedTask, add_study
from ..labs.params import SUPER_LAB, SuperParams
from ..schemas import Out
from .deps import State, refuse

router = APIRouter(prefix="/api/super-lab", tags=["super-lab"])

#: BRAIN runs at most three SuperAlpha simulations per person at once.
MAX_CORES = 3
MAX_CUSTOM_RECIPES = 5


class Recipe(Out):
    name: str = Field(min_length=1, max_length=80)
    code: str = Field(min_length=1, max_length=2000)


class SuperTask(Out):
    region: str
    delay: int
    universe: str
    neutralization: str
    selection_limit: int = Field(default=30, ge=super_alpha.MIN_SELECTION, le=200)
    #: ``BOTH`` runs every pairing under each Component Activation.
    activation: Literal["IS", "OS", "BOTH"] = "BOTH"
    cores: int = Field(default=MAX_CORES, ge=1, le=MAX_CORES)
    custom_selections: list[Recipe] = Field(default_factory=list, max_length=MAX_CUSTOM_RECIPES)
    custom_combos: list[Recipe] = Field(default_factory=list, max_length=MAX_CUSTOM_RECIPES)
    run: bool = False


class SuperPlan(Out):
    selections: list[Recipe]
    combos: list[Recipe]
    decays: list[int]
    truncation: float
    simulations: int


def _activations(choice: str) -> list[str]:
    return ["IS", "OS"] if choice == "BOTH" else [choice]


def _recipes(body: SuperTask) -> tuple[list[super_alpha.Recipe], list[super_alpha.Recipe]]:
    selections = super_alpha.selections(body.selection_limit)
    combos = list(super_alpha.COMBOS)
    cap = super_alpha.OPERATOR_LIMIT // body.selection_limit
    for index, recipe in enumerate(body.custom_selections, 1):
        selections.append(
            super_alpha.Recipe(
                f"Custom selection {index} · {recipe.name}",
                f"(operator_count <= {cap}) * max(0, ({recipe.code.strip()}))",
            )
        )
    for index, recipe in enumerate(body.custom_combos, 1):
        combos.append(
            super_alpha.Recipe(f"Custom combo {index} · {recipe.name}", recipe.code.strip())
        )
    return selections, combos


@router.post("/plan")
async def plan(body: SuperTask) -> SuperPlan:
    """What a task with these settings would run, without running anything."""
    activations = _activations(body.activation)
    selections, combos = _recipes(body)
    return SuperPlan(
        selections=[Recipe(name=r.name, code=r.code) for r in selections],
        combos=[Recipe(name=r.name, code=r.code) for r in combos],
        decays=list(super_alpha.DECAYS),
        truncation=super_alpha.TRUNCATION,
        simulations=len(selections) * len(combos) * len(super_alpha.DECAYS) * len(activations),
    )


@router.post("/tasks", status_code=201)
async def add_task(body: SuperTask, state: State) -> AddedTask:
    """Write every pairing as a SuperAlpha simulation, and queue the task when ``run``."""
    if body.region == "ALL":
        raise refuse(422, "region_agnostic", "SuperAlphas combine Alphas of one region.")
    selections, combos = _recipes(body)
    found = super_alpha.candidates(
        region=body.region,
        delay=body.delay,
        universe=body.universe,
        neutralization=body.neutralization,
        selection_limit=body.selection_limit,
        activations=_activations(body.activation),
        extra_selections=selections[len(super_alpha.selections(body.selection_limit)) :],
        extra_combos=combos[len(super_alpha.COMBOS) :],
    )
    return await add_study(
        state,
        now=utcnow(),
        sampler=SUPER_LAB,
        params=SuperParams(
            region=body.region,
            delay=body.delay,
            universe=body.universe,
            neutralization=body.neutralization,
            selection_limit=body.selection_limit,
            activation=_activations(body.activation),
            recipes=sorted({c.name for c in found}),
            cores=body.cores,
        ),
        simulations=len(found),
        batch_size=body.cores * MAX_BATCH,
        template_source=super_alpha.COMBOS[0].code,
        template_name=f"Super Alpha Lab · {body.region} D{body.delay} {body.universe}",
        run=body.run,
        seeds=super_alpha.seed_trials(found),
    )
