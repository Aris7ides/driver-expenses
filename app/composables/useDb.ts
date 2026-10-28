import type { Platform, ExpenseType, Trip, Expense, TripInput, ExpenseInput } from '~/types/models'
import { tripSchema, expenseSchema } from '~/utils/validation'
export const useDb = () => {
  const { $supabase } = useNuxtApp()
  const authUser = async () => {
    const { data, error } = await $supabase.auth.getUser()
    if (error || !data.user) throw new Error('La sesión ha expirado. Vuelve a iniciar sesión.')
    return data.user
  }
  const own = async () => (await authUser()).id
  const platforms = async (): Promise<Platform[]> => {
    const { data, error } = await $supabase.from('platforms').select('*').order('name')
    if (error) throw error
    return data as Platform[]
  }
  const expenseTypes = async (): Promise<ExpenseType[]> => {
    const { data, error } = await $supabase.from('expense_types').select('*').order('name')
    if (error) throw error
    return data as ExpenseType[]
  }
  const trips = async (): Promise<Trip[]> => {
    const { data, error } = await $supabase.from('trips').select('*,platform:platforms(*)').order('start_at', { ascending: false })
    if (error) throw error
    return data as Trip[]
  }
  const trip = async (id: string): Promise<Trip> => {
    const { data, error } = await $supabase.from('trips').select('*,platform:platforms(*)').eq('id', id).single()
    if (error) throw error
    return data as Trip
  }
  const expenses = async (tripId?: string): Promise<Expense[]> => {
    let query = $supabase.from('expenses').select('*,expense_type:expense_types(*)').order('spent_at', { ascending: false })
    if (tripId) query = query.eq('trip_id', tripId)
    const { data, error } = await query
    if (error) throw error
    return data as Expense[]
  }
  const saveTrip = async (input: TripInput, id?: string) => {
    const values = tripSchema.parse(input)
    const user_id = await own()
    const payload = { ...values, user_id }
    const q = id ? $supabase.from('trips').update(payload).eq('id', id).eq('user_id', user_id) : $supabase.from('trips').insert(payload)
    const { data, error } = await q.select('id').single()
    if (error) throw error
    return data.id as string
  }
  const saveExpense = async (trip_id: string, input: ExpenseInput, id?: string) => {
    const values = expenseSchema.parse(input)
    const user_id = await own()
    const payload = { ...values, trip_id, user_id }
    const q = id ? $supabase.from('expenses').update(payload).eq('id', id).eq('trip_id', trip_id).eq('user_id', user_id) : $supabase.from('expenses').insert(payload)
    const { error } = await q.select('id').single()
    if (error) throw error
  }
  const remove = async (table: 'trips' | 'expenses' | 'platforms' | 'expense_types', id: string) => {
    const { error } = await $supabase.from(table).delete().eq('id', id).eq('user_id', await own()).select('id').single()
    if (error) throw error
  }
  return { platforms, expenseTypes, trips, trip, expenses, saveTrip, saveExpense, remove, own }
}
