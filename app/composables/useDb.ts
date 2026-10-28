import type { Platform, ExpenseType, Trip, Expense, TripInput, ExpenseInput, TripFilters, ExpenseFilters } from '~/types/models'
import { tripSchema, expenseSchema } from '~/utils/validation'
import { readAll } from '~/utils/readAll'
export const useDb = () => {
  const { $supabase } = useNuxtApp()
  const authUser = async () => {
    const { data, error } = await $supabase.auth.getUser()
    if (error || !data.user) throw new Error('La sesión ha expirado. Vuelve a iniciar sesión.')
    return data.user
  }
  const own = async () => (await authUser()).id
  const platforms = async (): Promise<Platform[]> => {
    const user_id = await own()
    return readAll<Platform>((offset, size) => $supabase.from('platforms').select('*').eq('user_id', user_id).order('name').order('id').range(offset, offset + size - 1))
  }
  const expenseTypes = async (): Promise<ExpenseType[]> => {
    const user_id = await own()
    return readAll<ExpenseType>((offset, size) => $supabase.from('expense_types').select('*').eq('user_id', user_id).order('name').order('id').range(offset, offset + size - 1))
  }
  const trips = async (filters: TripFilters = {}): Promise<Trip[]> => {
    const user_id = await own()
    return readAll<Trip>((offset, size) => {
      let query = $supabase.from('trips').select('*,platform:platforms(*)').eq('user_id', user_id).order('start_at', { ascending: false }).order('id')
      if (filters.from) query = query.gte('start_at', new Date(`${filters.from}T00:00:00`).toISOString())
      if (filters.to) { const end = new Date(`${filters.to}T00:00:00`); end.setDate(end.getDate() + 1); query = query.lt('start_at', end.toISOString()) }
      if (filters.platformId) query = query.eq('platform_id', filters.platformId)
      if (filters.status) query = query.eq('status', filters.status)
      return query.range(offset, offset + size - 1)
    })
  }
  const trip = async (id: string): Promise<Trip> => {
    const { data, error } = await $supabase.from('trips').select('*,platform:platforms(*)').eq('id', id).eq('user_id', await own()).single()
    if (error) throw error
    return data as Trip
  }
  const expenses = async (tripId?: string, filters: ExpenseFilters = {}): Promise<Expense[]> => {
    const user_id = await own()
    return readAll<Expense>((offset, size) => {
      let query = $supabase.from('expenses').select('*,expense_type:expense_types(*),trip:trips(*,platform:platforms(*))').eq('user_id', user_id).order('spent_at', { ascending: false }).order('id')
      if (tripId) query = query.eq('trip_id', tripId)
      if (filters.from) query = query.gte('spent_at', filters.from)
      if (filters.to) query = query.lte('spent_at', filters.to)
      if (filters.typeId) query = query.eq('expense_type_id', filters.typeId)
      return query.range(offset, offset + size - 1)
    })
  }
  const saveTrip = async (input: TripInput, id?: string, expectedCollected?: number) => {
    const values = tripSchema.parse(input)
    const user_id = await own()
    const payload = { ...values, user_id }
    let q = id ? $supabase.from('trips').update(payload).eq('id', id).eq('user_id', user_id) : $supabase.from('trips').insert(payload)
    if (id && expectedCollected !== undefined) q = q.eq('service_collected', expectedCollected)
    const { data, error } = await q.select('id').single()
    if (error) throw error
    return data.id as string
  }
  const saveExpense = async (trip_id: string, input: ExpenseInput, id?: string, expectedReimbursed?: number) => {
    const values = expenseSchema.parse(input)
    const user_id = await own()
    const payload = { ...values, trip_id, user_id }
    let q = id ? $supabase.from('expenses').update(payload).eq('id', id).eq('trip_id', trip_id).eq('user_id', user_id) : $supabase.from('expenses').insert(payload)
    if (id && expectedReimbursed !== undefined) q = q.eq('reimbursed_amount', expectedReimbursed)
    const { error } = await q.select('id').single()
    if (error) throw error
  }
  const remove = async (table: 'trips' | 'expenses' | 'platforms' | 'expense_types', id: string) => {
    const { error } = await $supabase.from(table).delete().eq('id', id).eq('user_id', await own()).select('id').single()
    if (error) throw error
  }
  const collect = async (table: 'trips' | 'expenses', id: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.0001) throw new Error('Introduce un cobro positivo con un máximo de dos decimales.')
    const user_id = await own()
    const current = await $supabase.from(table).select('*').eq('id', id).eq('user_id', user_id).single()
    if (current.error) throw current.error
    const field = table === 'trips' ? 'service_collected' : 'reimbursed_amount'
    if (table === 'trips' && current.data.status === 'cancelado') throw new Error('Un servicio cancelado no tiene un cobro de servicio pendiente.')
    const maximum = Number(table === 'trips' ? current.data.service_price : current.data.refundable_amount)
    if (table === 'expenses' && !current.data.paid_by_driver) throw new Error('Este gasto no fue adelantado por el conductor.')
    const previous = Number(current.data[field])
    const next = (Math.round(previous * 100) + Math.round(amount * 100)) / 100
    if (next > maximum) throw new Error('El cobro supera el importe pendiente. Actualiza los datos y revisa la cantidad.')
    let update = $supabase.from(table).update({ [field]: next, user_id }).eq('id', id).eq('user_id', user_id).eq(field, previous).eq(table === 'trips' ? 'service_price' : 'refundable_amount', maximum)
    if (table === 'expenses') update = update.eq('paid_by_driver', true)
    const result = await update.select('id').single()
    if (result.error?.code === 'PGRST116') throw new Error('El cobro ha cambiado en otra ventana. Actualiza y vuelve a intentarlo.')
    if (result.error) throw result.error
  }
  const updateCatalog = async (table: 'platforms' | 'expense_types', id: string, values: { name?: string; active?: boolean }) => {
    const user_id = await own()
    const payload: { user_id: string; name?: string; active?: boolean } = { user_id }
    if (values.name !== undefined) { if (!values.name.trim()) throw new Error('El nombre no puede estar vacío.'); payload.name = values.name.trim() }
    if (values.active !== undefined) payload.active = values.active
    const { error } = await $supabase.from(table).update(payload).eq('id', id).eq('user_id', user_id).select('id').single()
    if (error) throw error
  }
  const addCatalog = async (table: 'platforms' | 'expense_types', name: string) => {
    if (!name.trim()) throw new Error('El nombre no puede estar vacío.')
    const user_id = await own()
    const { error } = await $supabase.from(table).insert({ user_id, name: name.trim() })
    if (error) throw error
  }
  return { platforms, expenseTypes, trips, trip, expenses, saveTrip, saveExpense, remove, own, collect, updateCatalog, addCatalog }
}
