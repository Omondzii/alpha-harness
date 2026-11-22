/** Truncation Sweep: re-run one Alpha at its original settings with different truncations. */

import type { components } from '@/api/generated'
import { http } from '@/api/http'

type Schemas = components['schemas']

export type TruncationSweepPlan = Schemas['TruncationSweepPlan']

const B = '/api/tools/truncation-sweep'

export const truncationSweep = {
  preview: (body: { alphaId: string }) => http.post<TruncationSweepPlan>(`${B}/preview`, body),
  addTask: (body: {
    alphaId: string
    truncationFrom: number
    truncationTo: number
    step: number
    cores: number
  }) => http.post<Schemas['AddedTask']>(`${B}/tasks`, body),
}
