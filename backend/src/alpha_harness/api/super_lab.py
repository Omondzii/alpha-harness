"""Super Alpha Lab: one form, one task of SuperAlphas from your own submitted Alphas."""

import asyncio
from typing import Literal

from fastapi import APIRouter
from pydantic import Field

from ..brain.endpoints import BrainEndpoints
from ..brain.filters import AlphaQuery, Filter
from ..brain.schemas import TEST_PERIOD, Alpha, SimulationType
from ..db.models import utcnow
from ..engine.packer import MAX_BATCH
from ..labs import super_alpha, template
from ..labs.launch import AddedTask, add_study, choices, legal_choices, synced_universes
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
    universes: list[str] = Field(default_factory=list, max_length=20)
    neutralizations: list[str] = Field(default_factory=list, max_length=20)
    selection_limit: int = Field(default=30, ge=super_alpha.MIN_SELECTION, le=200)
    decay: int = Field(default=super_alpha.DEFAULT_DECAY, ge=0, le=512)
    truncation: float = Field(default=super_alpha.DEFAULT_TRUNCATION, ge=0, le=1)
    pasteurization: Literal["ON", "OFF"] = "ON"
    unit_handling: str = Field(default="VERIFY", min_length=1, max_length=32)
    nan_handling: Literal["ON", "OFF"] = "ON"
    test_period: str = Field(default=TEST_PERIOD, pattern=r"^P[0-6]Y(?:[0-9]|1[01])M0D$")
    investability: list[template.Investability] = Field(default_factory=list, max_length=3)
    #: ``BOTH`` runs every pairing under each Component Activation.
    activation: Literal["IS", "OS", "BOTH"] = "BOTH"
    cores: int = Field(default=MAX_CORES, ge=1, le=MAX_CORES)
    custom_selections: list[Recipe] = Field(default_factory=list, max_length=MAX_CUSTOM_RECIPES)
    custom_combos: list[Recipe] = Field(default_factory=list, max_length=MAX_CUSTOM_RECIPES)
    run: bool = False


class SuperPlan(Out):
    selections: list[Recipe]
    combos: list[Recipe]
    universes: list[str]
    selected_universes: list[str]
    neutralizations: list[str]
    selected_neutralizations: list[str]
    problems: list[str]
    decay: int
    truncation: float
    pasteurization: str
    unit_handling: str
    nan_handling: str
    test_period: str
    investability: list[template.Investability]
    selected_investability: list[template.Investability]
    activation: Literal["IS", "OS", "BOTH"]
    simulations: int


class SelectionRun(Out):
    region: str
    delay: int
    selection: str = Field(min_length=1, max_length=2000)
    selection_limit: int = Field(default=30, ge=super_alpha.MIN_SELECTION, le=200)


class SelectionCount(Out):
    count: int


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
            source = alpha.id
            if alpha.selection and (code := alpha.selection.code):
                if len(code) <= 2000:
                    name, count, sources = selections.get(
                        code,
                        (_recipe_name(alpha.name, alpha.id, "selection"), 0, []),
                    )
                    selections[code] = (
                        name,
                        count + 1,
                        sources or [source],
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
                        sources or [source],
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


def _selection_code(code: str, limit: int) -> str:
    cap = super_alpha.OPERATOR_LIMIT // limit
    return f"(operator_count <= {cap}) * max(0, ({code.strip()}))"


def _recipes(body: SuperTask) -> tuple[list[super_alpha.Recipe], list[super_alpha.Recipe]]:
    selections: list[super_alpha.Recipe] = []
    combos: list[super_alpha.Recipe] = []
    for index, recipe in enumerate(body.custom_selections, 1):
        selections.append(
            super_alpha.Recipe(
                f"Custom selection {index} · {recipe.name}",
                _selection_code(recipe.code, body.selection_limit),
            )
        )
    for index, recipe in enumerate(body.custom_combos, 1):
        combos.append(
            super_alpha.Recipe(f"Custom combo {index} · {recipe.name}", recipe.code.strip())
        )
    return selections, combos


@router.post("/selection")
async def run_selection(body: SelectionRun, state: State) -> SelectionCount:
    """Run only a selection expression through BRAIN's SuperAlpha selection endpoint."""
    if body.region == "ALL":
        raise refuse(422, "region_agnostic", "SuperAlphas combine Alphas of one region.")
    result = await state.endpoints.super_selection(
        region=body.region,
        delay=body.delay,
        selection=body.selection.strip(),
        selection_limit=body.selection_limit,
        selection_handling="POSITIVE",
    )
    count = result.get("count")
    if not isinstance(count, int) or isinstance(count, bool):
        raise ValueError(f"Unexpected BRAIN SuperAlpha selection response: {result!r}")
    return SelectionCount(count=count)


@router.post("/plan")
async def plan(body: SuperTask, state: State) -> SuperPlan:
    """What a task with these settings would run, without running anything."""
    activations = _activations(body.activation)
    selections, combos = _recipes(body)
    schema = await state.metadata.cached_settings_schema()
    legal = legal_choices(schema, body.region, body.delay)
    universes = await synced_universes(
        state, legal, body.region, body.delay, body.universes[0] if body.universes else None
    )
    neutralizations = [str(value) for value in choices(legal, "neutralization")]
    selected_universes = [value for value in universes if value in body.universes]
    selected_neutralizations = [value for value in neutralizations if value in body.neutralizations]
    available_investability: list[template.Investability] = list(
        template.REGION_INVESTABILITY.get(body.region, ())
    )
    selected_investability: list[template.Investability] = [
        value for value in body.investability if value in available_investability
    ]
    problems: list[str] = []
    if not schema:
        problems.append("BRAIN's settings list is not loaded. Sign in again.")
    elif not universes:
        problems.append(
            f"No {body.region} delay {body.delay} market is downloaded. Sync it in BRAIN › Sync."
        )
    if not selected_universes:
        problems.append("Choose at least one Universe.")
    if not selected_neutralizations:
        problems.append("Choose at least one Neutralization.")
    if not selected_investability:
        problems.append("Choose at least one Investability.")
    return SuperPlan(
        selections=[Recipe(name=r.name, code=r.code) for r in selections],
        combos=[Recipe(name=r.name, code=r.code) for r in combos],
        universes=universes,
        selected_universes=selected_universes,
        neutralizations=neutralizations,
        selected_neutralizations=selected_neutralizations,
        problems=problems,
        decay=body.decay,
        truncation=body.truncation,
        pasteurization=body.pasteurization,
        unit_handling=body.unit_handling,
        nan_handling=body.nan_handling,
        test_period=body.test_period,
        investability=available_investability,
        selected_investability=selected_investability,
        activation=body.activation,
        simulations=len(selections)
        * len(combos)
        * len(selected_universes)
        * len(selected_neutralizations)
        * len(selected_investability)
        * len(activations),
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
    schema = await state.metadata.cached_settings_schema()
    if not schema:
        raise refuse(
            503, "settings_unavailable", "BRAIN's settings list is not loaded. Sign in again."
        )
    legal = legal_choices(schema, body.region, body.delay)
    available_universes = await synced_universes(
        state, legal, body.region, body.delay, body.universes[0] if body.universes else None
    )
    selected_universes = [value for value in available_universes if value in body.universes]
    available_neutralizations = [str(value) for value in choices(legal, "neutralization")]
    selected_neutralizations = [
        value for value in available_neutralizations if value in body.neutralizations
    ]
    if not selected_universes:
        raise refuse(422, "universe_required", "Choose at least one available, synced Universe.")
    if not selected_neutralizations:
        raise refuse(
            422, "neutralization_required", "Choose at least one available Neutralization."
        )
    available_investability: tuple[template.Investability, ...] = template.REGION_INVESTABILITY.get(
        body.region, ()
    )
    selected_investability: list[template.Investability] = [
        value for value in body.investability if value in available_investability
    ]
    if not selected_investability:
        raise refuse(
            422,
            "investability_required",
            "Choose at least one investability option available in this region.",
        )
    found = super_alpha.candidates(
        region=body.region,
        delay=body.delay,
        universes=selected_universes,
        neutralizations=selected_neutralizations,
        selection_limit=body.selection_limit,
        decay=body.decay,
        truncation=body.truncation,
        pasteurization=body.pasteurization,
        unit_handling=body.unit_handling,
        nan_handling=body.nan_handling,
        test_period=body.test_period,
        investability=selected_investability,
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
            universe=selected_universes[0],
            universes=selected_universes,
            neutralization=selected_neutralizations[0],
            neutralizations=selected_neutralizations,
            selection_limit=body.selection_limit,
            decay=body.decay,
            truncation=body.truncation,
            pasteurization=body.pasteurization,
            unit_handling=body.unit_handling,
            nan_handling=body.nan_handling,
            test_period=body.test_period,
            investability=[str(value) for value in selected_investability],
            activation=_activations(body.activation),
            recipes=sorted({c.name for c in found}),
            cores=body.cores,
        ),
        simulations=len(found),
        batch_size=body.cores * MAX_BATCH,
        template_source=combos[0].code,
        template_name=f"Super Alpha Lab · {body.region} D{body.delay} {selected_universes[0]}",
        run=body.run,
        seeds=super_alpha.seed_trials(found),
    )
