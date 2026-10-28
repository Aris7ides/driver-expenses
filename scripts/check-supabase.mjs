import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const file of ['.env', '.env.test']) {
  if (fs.existsSync(file)) process.loadEnvFile(file)
}
const url = process.env.NUXT_PUBLIC_SUPABASE_URL
const key = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Faltan la URL o la clave pública de Supabase.')
if (key.startsWith('sb_secret_')) throw new Error('Usa exclusivamente una clave pública.')
if (key.split('.').length === 3) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
  if (claims.role !== 'anon') throw new Error('La clave JWT debe corresponder al rol anon.')
}
const headers = { apikey: key }
if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`
const queries = [
  ['profiles', 'id'], ['platforms', '*'], ['expense_types', '*'],
  ['trips', '*,platform:platforms(*)'], ['expenses', '*,expense_type:expense_types(*)'],
]
let failures = 0
const report = (check, status, details = '') => {
  console.log(`${status}: ${check}${details ? ` — ${details}` : ''}`)
  if (status === 'ERROR') failures++
}
const request = (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) })
const client = () => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: request },
})

for (const path of ['health', 'settings']) {
  try {
    const response = await request(`${url.replace(/\/$/, '')}/auth/v1/${path}`, { headers })
    report(`Auth ${path}`, response.ok ? 'OK' : 'ERROR', `HTTP ${response.status}`)
  } catch (error) { report(`Auth ${path}`, 'ERROR', error.cause?.code || error.name) }
}

const anonymous = client()
for (const [table, select] of queries) {
  const { data, error, status } = await anonymous.from(table).select(select).limit(1)
  const denied = [401, 403].includes(status) && error?.code === '42501'
  report(`${table}: acceso sin sesión`, denied || (!error && data?.length === 0) ? 'OK' : 'ERROR',
    denied ? 'denegado por permisos' : error ? `${status} / ${error.code}` : data?.length ? 'expone datos sin sesión' : 'sin filas visibles')
}

const accounts = []
for (const name of ['A', 'B']) {
  const email = process.env[`MIRUTA_TEST_${name}_EMAIL`]
  const password = process.env[`MIRUTA_TEST_${name}_PASSWORD`]
  if (!email && !password) continue
  if (!email || !password) { report(`Cuenta ${name}`, 'ERROR', 'credenciales de prueba incompletas'); continue }
  const supabase = client()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) { report(`Cuenta ${name}: login`, 'ERROR', error?.code || 'sin usuario'); continue }
  accounts.push({ name, supabase, userId: data.user.id })
  report(`Cuenta ${name}: login`, 'OK')
  for (const [table, select] of queries) {
    const result = await supabase.from(table).select(select).limit(100)
    const foreign = result.data?.some(row => (table === 'profiles' ? row.id : row.user_id) !== data.user.id)
    report(`Cuenta ${name}: lectura de ${table}`, !result.error && !foreign ? 'OK' : 'ERROR',
      result.error ? `${result.status} / ${result.error.code}` : foreign ? 'filas de otro usuario' : `${result.data.length} filas propias`)
  }
}
if (accounts.length === 2 && accounts[0].userId === accounts[1].userId) {
  report('Aislamiento', 'ERROR', 'las cuentas A y B deben ser diferentes')
} else if (accounts.length === 2) {
  for (const account of accounts) {
    const other = accounts.find(value => value !== account)
    for (const [table, select] of queries) {
      const result = await account.supabase.from(table).select(select).eq(table === 'profiles' ? 'id' : 'user_id', other.userId).limit(1)
      report(`Cuenta ${account.name}: acceso a ${table} del otro usuario`, !result.error && result.data?.length === 0 ? 'OK' : 'ERROR',
        result.error ? `${result.status} / ${result.error.code}` : result.data?.length ? 'filas ajenas visibles' : 'sin filas visibles')
    }
  }
}
for (const account of accounts) {
  const { error } = await account.supabase.auth.signOut({ scope: 'local' })
  if (error) report(`Cuenta ${account.name}: cerrar sesión de prueba`, 'ERROR', error.code)
}
if (accounts.length < 2) console.log('PENDIENTE: lecturas con dos cuentas distintas. Configura MIRUTA_TEST_A_EMAIL/PASSWORD y MIRUTA_TEST_B_EMAIL/PASSWORD en .env.test.')
console.log('Esta comprobación no crea, edita ni elimina registros. Las escrituras y el aislamiento con datos reales requieren una prueba adicional.')
process.exitCode = failures ? 1 : 0
