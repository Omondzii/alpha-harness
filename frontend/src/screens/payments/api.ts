import type { components } from '@/api/generated'
import { http } from '@/api/http'

export type PaymentOverview = components['schemas']['PaymentOverview']

export const payments = {
  overview: () => http.get<PaymentOverview>('/api/payments'),
}
