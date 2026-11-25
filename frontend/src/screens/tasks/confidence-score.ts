import type { PowerPoolRow, RankedAlpha } from '@/screens/tasks/api'

const RETURN_DRAWDOWN_CAP = 5

export type ConfidenceScore =
  | {
      value: number
      status: 'scored'
      cohortSize: number
    }
  | {
      value: null
      status: 'incomplete'
      detail: string
    }
  | {
      value: null
      status: 'pending' | 'blocked' | 'excluded'
      detail?: string
    }

interface ScorableAlpha {
  alphaId: string
  market: string
  metrics: {
    afterCostSharpe: number
    testSharpe: number
    margin: number
    turnover: number
    returnDrawdown: number
  }
}

const finite = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value)

function rankPercentiles(
  candidates: ScorableAlpha[],
  value: (candidate: ScorableAlpha) => number,
  higherIsBetter = true,
): Map<string, number> {
  const sorted = [...candidates].sort((a, b) => value(a) - value(b))
  const percentiles = new Map<string, number>()

  for (let start = 0; start < sorted.length; ) {
    const first = sorted[start]
    if (!first) throw new Error('Missing candidate while ranking confidence scores.')
    let end = start + 1
    while (end < sorted.length) {
      const current = sorted[end]
      if (!current) throw new Error('Missing candidate while ranking confidence scores.')
      if (value(current) !== value(first)) break
      end += 1
    }
    const rank = sorted.length === 1 ? 0.5 : (start + end - 1) / (2 * (sorted.length - 1))
    const percentile = higherIsBetter ? rank : 1 - rank
    for (let index = start; index < end; index += 1) {
      const candidate = sorted[index]
      if (!candidate) throw new Error('Missing candidate while assigning confidence score ranks.')
      percentiles.set(candidate.alphaId, percentile)
    }
    start = end
  }

  return percentiles
}

function marketOf(alpha: RankedAlpha): string | null {
  const settings = alpha.settings
  const region = settings?.['region']
  const delay = settings?.['delay']
  const universe = settings?.['universe']
  if (
    typeof region !== 'string' ||
    (typeof delay !== 'string' && typeof delay !== 'number') ||
    typeof universe !== 'string'
  ) {
    return null
  }
  return `${region}|${delay}|${universe}`
}

export function confidenceScores(
  rows: RankedAlpha[],
  poolById: ReadonlyMap<string, PowerPoolRow>,
): Map<string, ConfidenceScore> {
  const results = new Map<string, ConfidenceScore>()
  const groups = new Map<string, ScorableAlpha[]>()

  for (const alpha of rows) {
    if (!alpha.alphaId) continue
    results.set(alpha.alphaId, { value: null, status: 'excluded' })

    if (
      alpha.submitted ||
      alpha.quick ||
      !alpha.submittable ||
      alpha.errored ||
      alpha.refusedBy.length > 0
    ) {
      continue
    }

    if (alpha.powerPool) {
      const verdict = poolById.get(alpha.alphaId)?.verdict
      if (verdict === 'blocked') {
        results.set(alpha.alphaId, { value: null, status: 'blocked' })
        continue
      }
      if (verdict !== 'clear' && verdict !== 'beats') {
        results.set(alpha.alphaId, { value: null, status: 'pending' })
        continue
      }
    }

    const afterCostSharpe = alpha.afterCostSharpe
    const testSharpe = alpha.testSharpe
    const margin = alpha.margin
    const turnover = alpha.turnover
    const returns = alpha.returns
    const drawdown = alpha.drawdown
    const market = marketOf(alpha)
    const missing: string[] = []
    if (!finite(afterCostSharpe)) missing.push('After-Cost Sharpe')
    if (!finite(testSharpe)) missing.push('Test Sharpe')
    if (!finite(margin)) missing.push('Margin')
    if (!finite(turnover)) missing.push('Turnover')
    if (!finite(returns)) missing.push('Return')
    if (!finite(drawdown) || drawdown <= 0) missing.push('positive Drawdown')
    if (!market) missing.push('market settings')
    if (missing.length) {
      results.set(alpha.alphaId, {
        value: null,
        status: 'incomplete',
        detail: `Missing or invalid: ${missing.join(', ')}`,
      })
      continue
    }

    if (
      !finite(afterCostSharpe) ||
      !finite(testSharpe) ||
      !finite(margin) ||
      !finite(turnover) ||
      !finite(returns) ||
      !finite(drawdown) ||
      drawdown <= 0 ||
      !market
    ) {
      throw new Error('Confidence score inputs changed after validation.')
    }

    const candidate: ScorableAlpha = {
      alphaId: alpha.alphaId,
      market,
      metrics: {
        afterCostSharpe,
        testSharpe,
        margin,
        turnover,
        returnDrawdown: Math.min(RETURN_DRAWDOWN_CAP, returns / drawdown),
      },
    }
    const group = groups.get(candidate.market) ?? []
    group.push(candidate)
    groups.set(candidate.market, group)
  }

  for (const candidates of groups.values()) {
    const afterCost = rankPercentiles(candidates, (r) => r.metrics.afterCostSharpe)
    const test = rankPercentiles(candidates, (r) => r.metrics.testSharpe)
    const margin = rankPercentiles(candidates, (r) => r.metrics.margin)
    const turnover = rankPercentiles(candidates, (r) => r.metrics.turnover, false)
    const returnDrawdown = rankPercentiles(candidates, (r) => r.metrics.returnDrawdown)

    for (const { alphaId } of candidates) {
      const afterCostRank = afterCost.get(alphaId)
      const testRank = test.get(alphaId)
      const marginRank = margin.get(alphaId)
      const turnoverRank = turnover.get(alphaId)
      const returnDrawdownRank = returnDrawdown.get(alphaId)
      if (
        afterCostRank == null ||
        testRank == null ||
        marginRank == null ||
        turnoverRank == null ||
        returnDrawdownRank == null
      ) {
        throw new Error(`Missing percentile rank for Alpha ${alphaId}.`)
      }
      const score =
        100 *
        (0.3 * afterCostRank +
          0.25 * testRank +
          0.15 * marginRank +
          0.1 * turnoverRank +
          0.2 * returnDrawdownRank)
      results.set(alphaId, {
        value: score,
        status: 'scored',
        cohortSize: candidates.length,
      })
    }
  }

  return results
}
