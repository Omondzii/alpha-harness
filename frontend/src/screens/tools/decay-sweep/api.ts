/** Decay Sweep: re-run one Alpha at its original settings with different decay values. */

import type { components } from '@/api/generated'
import { http } from '@/api/http'

type Schemas = components['schemas']

export type DecaySweepPlan = Schemas['DecaySweepPlan']

const B = '/api/tools/decay-sweep'

export const decaySweep = {
  preview: (body: { alphaId: string }) => http.post<DecaySweepPlan>(`${B}/preview`, body),
  addTask: (body: {
    alphaId: string
    decayFrom: number
    decayTo: number
    parity: 'any' | 'even' | 'odd'
    cores: number
  }) => http.post<Schemas['AddedTask']>(`${B}/tasks`, body),
}
