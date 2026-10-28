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
export const netExpense = (e: { amount: number; refundable_amount: number; reimbursed_amount: number; paid_by_driver: boolean }) => e.paid_by_driver ? Number(e.amount) - Number(e.refundable_amount) : 0
export const routeProfit = (price: number, expenses: { amount: number; refundable_amount: number; reimbursed_amount: number; paid_by_driver: boolean }[]) => Number(price) - expenses.reduce((sum, e) => sum + netExpense(e), 0)

// datetime-local usa la hora del dispositivo; toISOString() queda para la escritura.
export const localDateTime = (value: string | Date = new Date()) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export const localDate = (value: string | Date = new Date()) => localDateTime(value).slice(0, 10)
export const expensesTotal = (expenses: { amount: number }[]) => expenses.reduce((sum, e) => sum + Number(e.amount), 0)
export const serviceIncome = (trips: { service_price: number }[]) => trips.reduce((sum, t) => sum + Number(t.service_price), 0)
export const pendingReimbursements = (expenses: { refundable_amount: number; reimbursed_amount: number; paid_by_driver: boolean }[]) => expenses.reduce((sum, e) => sum + (e.paid_by_driver ? Math.max(0, Number(e.refundable_amount) - Number(e.reimbursed_amount)) : 0), 0)
export const pendingCollection = (trips: { service_price: number; service_collected: number }[], expenses: Parameters<typeof pendingReimbursements>[0]) => trips.reduce((sum, t) => sum + Math.max(0, Number(t.service_price) - Number(t.service_collected)), 0) + pendingReimbursements(expenses)
