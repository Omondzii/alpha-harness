"""Super Alpha Lab: one form, one task of SuperAlphas from your own submitted Alphas."""

import asyncio
from typing import Literal

from fastapi import APIRouter
from pydantic import Field

from ..brain.endpoints import BrainEndpoints
from ..brain.filters import AlphaQuery, Filter
from ..brain.schemas import Alpha, SimulationType
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
ALPHA_PAGE_SIZE = 100
MAX_ALPHA_OFFSET = 1_000


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
    builtin_selections: list[str] = Field(default_factory=list, max_length=5)
    builtin_combos: list[str] = Field(default_factory=list, max_length=4)
    custom_selections: list[Recipe] = Field(default_factory=list, max_length=MAX_CUSTOM_RECIPES)
    custom_combos: list[Recipe] = Field(default_factory=list, max_length=MAX_CUSTOM_RECIPES)
    run: bool = False


class SuperPlan(Out):
    selections: list[Recipe]
    combos: list[Recipe]
    builtin_selections: list[Recipe]
    builtin_combos: list[Recipe]
    decays: list[int]
    truncation: float
    simulations: int


class SubmittedExpression(Out):
    name: str
    code: str
    used_by: int
    sources: list[str]


class SubmittedExpressions(Out):
    selections: list[SubmittedExpression]
    combos: list[SubmittedExpression]
    truncated: bool
    omitted: int


def _recipe_name(name: str | None, alpha_id: str, expression_type: str) -> str:
    label = (name or "Submitted SuperAlpha").strip()[:40]
    return f"{label} · {alpha_id[-10:]} · {expression_type}"


def _source_name(name: str | None, alpha_id: str) -> str:
    label = (name or "Submitted SuperAlpha").strip()[:40]
    return f"{label} · {alpha_id[-10:]}"


async def _submitted_expressions(endpoints: BrainEndpoints) -> SubmittedExpressions:
    selections: dict[str, tuple[str, int, list[str]]] = {}
    combos: dict[str, tuple[str, int, list[str]]] = {}
    offset = 0
    truncated = False
    omitted = 0
    semaphore = asyncio.Semaphore(4)

    while True:
        page = await endpoints.list_alphas(
            AlphaQuery(
                limit=ALPHA_PAGE_SIZE,
                offset=offset,
                order="-dateSubmitted",
                filters=[
                    Filter("status", "!=", "UNSUBMITTED"),
                    Filter("type", "=", "SUPER"),
                ],
                hidden=None,
            )
        )
        results = page["results"]
        total = page["count"]
        candidates = [Alpha.model_validate(row) for row in results]
        candidates = [alpha for alpha in candidates if alpha.type == SimulationType.SUPER]

        async def complete(alpha: Alpha) -> Alpha:
            if alpha.selection and alpha.selection.code and alpha.combo and alpha.combo.code:
                return alpha
            async with semaphore:
                return await endpoints.get_alpha(alpha.id)

        full_alphas = await asyncio.gather(*(complete(alpha) for alpha in candidates))
        for alpha in full_alphas:
            source = _source_name(alpha.name, alpha.id)
            if alpha.selection and (code := alpha.selection.code):
                if len(code) <= 2000:
                    name, count, sources = selections.get(
                        code,
                        (_recipe_name(alpha.name, alpha.id, "selection"), 0, []),
                    )
                    selections[code] = (
                        name,
                        count + 1,
                        [*sources, source] if len(sources) < 3 else sources,
                    )
                else:
                    omitted += 1
            if alpha.combo and (code := alpha.combo.code):
                if len(code) <= 2000:
                    name, count, sources = combos.get(
                        code,
                        (_recipe_name(alpha.name, alpha.id, "combo"), 0, []),
                    )
                    combos[code] = (
                        name,
                        count + 1,
                        [*sources, source] if len(sources) < 3 else sources,
                    )
                else:
                    omitted += 1

        if len(results) < ALPHA_PAGE_SIZE or offset + len(results) >= total:
            break
        if offset >= MAX_ALPHA_OFFSET:
            truncated = True
            break
        offset += ALPHA_PAGE_SIZE

    return SubmittedExpressions(
        selections=[
            SubmittedExpression(name=name, code=code, used_by=count, sources=sources)
            for code, (name, count, sources) in selections.items()
        ],
        combos=[
            SubmittedExpression(name=name, code=code, used_by=count, sources=sources)
            for code, (name, count, sources) in combos.items()
        ],
        truncated=truncated,
        omitted=omitted,
    )


@router.get("/submitted-expressions")
async def submitted_expressions(state: State) -> SubmittedExpressions:
    """Read selection and combo recipes from the user's submitted SuperAlphas."""
    return await _submitted_expressions(state.endpoints)


def _activations(choice: str) -> list[str]:
    return ["IS", "OS"] if choice == "BOTH" else [choice]


def _selected_builtins(
    requested: list[str], available: list[super_alpha.Recipe], kind: str
) -> list[super_alpha.Recipe]:
    by_name = {recipe.name: recipe for recipe in available}
    if len(requested) != len(set(requested)) or any(name not in by_name for name in requested):
        raise refuse(
            422, "invalid_builtin_expression", f"One or more {kind} expressions are invalid."
        )
    return [by_name[name] for name in requested]


def _recipes(body: SuperTask) -> tuple[list[super_alpha.Recipe], list[super_alpha.Recipe]]:
    selections = _selected_builtins(
        body.builtin_selections, super_alpha.selections(body.selection_limit), "selection"
    )
    combos = _selected_builtins(body.builtin_combos, super_alpha.COMBOS, "combo")
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
        builtin_selections=[
            Recipe(name=r.name, code=r.code) for r in super_alpha.selections(body.selection_limit)
        ],
        builtin_combos=[Recipe(name=r.name, code=r.code) for r in super_alpha.COMBOS],
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
    if not selections or not combos:
        raise refuse(
            422,
            "expressions_required",
            "Choose at least one selection expression and one combo expression.",
        )
    found = super_alpha.candidates(
        region=body.region,
        delay=body.delay,
        universe=body.universe,
        neutralization=body.neutralization,
        selection_limit=body.selection_limit,
        activations=_activations(body.activation),
        selection_recipes=selections,
        combo_recipes=combos,
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
