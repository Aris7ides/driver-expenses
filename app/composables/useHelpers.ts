export const euro = (n: number | null | undefined) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n || 0))
export const shortDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('es-ES') : '—'
export const message = (e: unknown): string => {
  if (typeof e === 'object' && e !== null) {
    if ('issues' in e && Array.isArray(e.issues)) {
      const first = e.issues[0] as { message?: string } | undefined
      if (first?.message) return first.message
    }
    if ('message' in e && typeof e.message === 'string') return e.message
  }
  return 'Se ha producido un error'
}
import type { Trip, Expense } from '~/types/models'
export const sumMoney = (values: number[]) => values.reduce((sum, value) => sum + Math.round(Number(value) * 100), 0) / 100
export const netExpense = (e: { amount: number; refundable_amount: number; reimbursed_amount: number; paid_by_driver: boolean }) => e.paid_by_driver ? sumMoney([e.amount, -e.refundable_amount]) : 0
export const routeProfit = (price: number, expenses: { amount: number; refundable_amount: number; reimbursed_amount: number; paid_by_driver: boolean }[]) => sumMoney([price, ...expenses.map(e => -netExpense(e))])

// datetime-local usa la hora del dispositivo; toISOString() queda para la escritura.
export const localDateTime = (value: string | Date = new Date()) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export const localDate = (value: string | Date = new Date()) => localDateTime(value).slice(0, 10)
export const expensesTotal = (expenses: { amount: number }[]) => sumMoney(expenses.map(e => e.amount))
export const serviceIncome = (trips: { service_price: number }[]) => sumMoney(trips.map(t => t.service_price))
export const servicePending = (trip: { service_price: number; service_collected: number; status?: string }) => trip.status === 'cancelado' ? 0 : Math.max(0, sumMoney([trip.service_price, -trip.service_collected]))
export const refundPending = (e: { refundable_amount: number; reimbursed_amount: number; paid_by_driver: boolean }) => e.paid_by_driver ? Math.max(0, sumMoney([e.refundable_amount, -e.reimbursed_amount])) : 0
export const pendingReimbursements = (expenses: Parameters<typeof refundPending>[0][]) => sumMoney(expenses.map(refundPending))
export const pendingCollection = (trips: Parameters<typeof servicePending>[0][], expenses: Parameters<typeof pendingReimbursements>[0]) => sumMoney([...trips.map(servicePending), pendingReimbursements(expenses)])
export const tripStatusLabel: Record<string, string> = { planificado: 'Planificado', en_curso: 'En curso', finalizado: 'Finalizado', cancelado: 'Cancelado' }
export const collectionLabel = (total: number, received: number) => received >= total ? 'Cobrado' : received > 0 ? 'Parcial' : 'Pendiente'
export const budgetDifference = (budget: number, expenses: { amount: number }[]) => sumMoney([budget, -expensesTotal(expenses)])
export function monthlySummary(trips: Trip[], expenses: Expense[], month: string) {
  const monthTrips = trips.filter(t => localDate(t.start_at).slice(0, 7) === month)
  const ids = new Set(monthTrips.map(t => t.id))
  const monthExpenses = expenses.filter(e => ids.has(e.trip_id))
  const completed = monthTrips.filter(t => t.status === 'finalizado')
  const closedIds = new Set(monthTrips.filter(t => ['finalizado', 'cancelado'].includes(t.status)).map(t => t.id))
  const closedExpenses = monthExpenses.filter(e => closedIds.has(e.trip_id))
  const future = monthTrips.filter(t => ['planificado', 'en_curso'].includes(t.status))
  return { monthTrips, monthExpenses, completed, income: serviceIncome(completed), profit: routeProfit(serviceIncome(completed), closedExpenses), spending: expensesTotal(monthExpenses), forecastServices: serviceIncome(future), forecastBudget: sumMoney(future.map(t => t.estimated_budget)), outstanding: pendingCollection(trips, expenses) }
}
