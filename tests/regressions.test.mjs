import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createClient } from '@supabase/supabase-js'
import { computed, reactive, ref, watch } from 'vue'
import { evaluate, loadModule } from './load-module.mjs'

const helpers = loadModule('app/composables/useHelpers.ts')
const { tripSchema, expenseSchema } = loadModule('app/utils/validation.ts')
const owner = '11111111-1111-4111-8111-111111111111'
const tripId = '22222222-2222-4222-8222-222222222222'
const expenseId = '33333333-3333-4333-8333-333333333333'
const platformId = '44444444-4444-4444-8444-444444444444'
const trip = { platform_id: platformId, origin: 'Valencia', destination: 'Madrid', start_at: '2026-10-28T09:30:00.000Z', end_at: null, status: 'planificado', estimated_budget: 90, service_price: 180, service_collected: 0, kilometers: 350, external_reference: null, notes: null }
const expense = { expense_type_id: null, spent_at: '2026-10-28', amount: 50, refundable_amount: 35, reimbursed_amount: 10, description: 'Combustible', notes: null, paid_by_driver: true }

function database({ authenticated = true, empty = false } = {}) {
  const requests = []
  const client = createClient('https://example.supabase.co', 'test-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      requests.push({ url: new URL(url), method: options.method, body: options.body ? JSON.parse(options.body) : null })
      return new Response(JSON.stringify(empty ? { code: 'PGRST116', message: 'No rows returned' } : { id: expenseId }), {
        status: empty ? 406 : 200, headers: { 'Content-Type': 'application/json' },
      })
    } },
  })
  client.auth.getUser = async () => ({ data: { user: authenticated ? { id: owner } : null }, error: null })
  const { useDb } = loadModule('app/composables/useDb.ts', { useNuxtApp: () => ({ $supabase: client }) })
  return { db: useDb(), requests }
}

test('crear y editar viajes omite relaciones y fuerza el propietario autenticado', async () => {
  const { db, requests } = database()
  const input = { ...trip, id: tripId, user_id: 'otro-usuario', platform: { name: 'HiFlow' }, created_at: 'ayer' }
  await db.saveTrip(input)
  await db.saveTrip(input, tripId)
  for (const request of requests) {
    assert.equal(request.body.user_id, owner)
    assert.equal(request.body.origin, trip.origin)
    for (const key of ['id', 'platform', 'created_at']) assert.equal(key in request.body, false)
  }
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[1].method, 'PATCH')
  assert.equal(requests[1].url.searchParams.get('id'), `eq.${tripId}`)
  assert.equal(requests[1].url.searchParams.get('user_id'), `eq.${owner}`)
})

test('crear y editar gastos fija viaje y propietario, sin enviar expense_type', async () => {
  const { db, requests } = database()
  const input = { ...expense, user_id: 'otro', trip_id: 'otro-viaje', expense_type: { name: 'Otros' } }
  await db.saveExpense(tripId, input)
  await db.saveExpense(tripId, input, expenseId)
  for (const request of requests) {
    assert.equal(request.body.user_id, owner)
    assert.equal(request.body.trip_id, tripId)
    assert.equal('expense_type' in request.body, false)
  }
  assert.equal(requests[1].url.searchParams.get('trip_id'), `eq.${tripId}`)
  assert.equal(requests[1].url.searchParams.get('user_id'), `eq.${owner}`)
})

test('una sesión ausente no permite enviar escrituras', async () => {
  const { db, requests } = database({ authenticated: false })
  await assert.rejects(db.saveTrip(trip), /sesión ha expirado/)
  await assert.rejects(db.saveExpense(tripId, expense), /sesión ha expirado/)
  await assert.rejects(db.remove('trips', tripId), /sesión ha expirado/)
  assert.equal(requests.length, 0)
})

test('editar o eliminar un registro inaccesible no se presenta como éxito', async () => {
  const { db } = database({ empty: true })
  await assert.rejects(db.saveExpense(tripId, expense, expenseId), error => error.code === 'PGRST116')
  await assert.rejects(db.saveTrip(trip, tripId), error => error.code === 'PGRST116')
  await assert.rejects(db.remove('expenses', expenseId), error => error.code === 'PGRST116')
})

test('validación de fechas, importes y reembolsos antes de contactar con Supabase', async () => {
  for (const values of [
    { ...trip, end_at: '2026-10-27T09:00:00Z' },
    { ...trip, service_collected: 181 },
    { ...trip, service_price: -1 },
    { ...trip, service_price: 10.001 },
    { ...trip, service_price: Infinity },
    { ...trip, origin: ' ' },
  ]) assert.equal(tripSchema.safeParse(values).success, false)
  for (const values of [
    { ...expense, amount: 0 }, { ...expense, refundable_amount: 51 },
    { ...expense, reimbursed_amount: 36 }, { ...expense, spent_at: '2026-02-30' },
  ]) assert.equal(expenseSchema.safeParse(values).success, false)
  const { db, requests } = database()
  await assert.rejects(db.saveTrip({ ...trip, service_collected: 181 }))
  await assert.rejects(db.saveExpense(tripId, { ...expense, reimbursed_amount: 36 }))
  assert.equal(requests.length, 0)
})

test('beneficio y pendiente separan gastos propios, reembolsos y cobros parciales', () => {
  const expenses = [
    { ...expense, amount: 35, refundable_amount: 35, reimbursed_amount: 10 },
    { ...expense, amount: 15, refundable_amount: 15, reimbursed_amount: 0 },
    { ...expense, amount: 30, refundable_amount: 0, reimbursed_amount: 0 },
    { ...expense, amount: 10, refundable_amount: 0, reimbursed_amount: 0 },
    { ...expense, amount: 20, paid_by_driver: false },
  ]
  assert.equal(helpers.routeProfit(180, expenses), 140)
  assert.equal(helpers.pendingCollection([{ ...trip, service_collected: 80 }], expenses), 140)
  assert.equal(helpers.expensesTotal(expenses), 110)
  assert.equal(helpers.pendingCollection([], []), 0)
})

test('fechas locales conservan la hora en invierno, verano y cambio de mes', () => {
  const previous = process.env.TZ
  process.env.TZ = 'Europe/Madrid'
  try {
    for (const [iso, local] of [
      ['2026-01-28T09:30:00.000Z', '2026-01-28T10:30'],
      ['2026-07-28T09:30:00.000Z', '2026-07-28T11:30'],
      ['2026-10-31T23:30:00.000Z', '2026-11-01T00:30'],
    ]) {
      assert.equal(helpers.localDateTime(iso), local)
      assert.equal(new Date(helpers.localDateTime(iso)).toISOString(), iso)
    }
    assert.equal(helpers.localDate('2026-10-31T23:30:00.000Z'), '2026-11-01')
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
})

test('los errores de PostgREST y de validación muestran su mensaje', () => {
  assert.equal(helpers.message({ code: '42501', message: 'Permiso denegado' }), 'Permiso denegado')
  assert.equal(helpers.message(tripSchema.safeParse({ ...trip, origin: '' }).error), 'Introduce el origen.')
  assert.equal(helpers.message(null), 'Se ha producido un error')
})

test('los formularios editan únicamente sus campos y conservan el catálogo histórico', async () => {
  for (const [name, initial, optionName, availableName, selectedKey] of [
    ['TripForm', { ...trip, id: tripId, platform: { name: 'HiFlow' } }, 'options', 'availablePlatforms', 'platform_id'],
    ['ExpenseForm', { ...expense, id: expenseId, expense_type_id: platformId, expense_type: { name: 'Otros' } }, 'types', 'availableTypes', 'expense_type_id'],
  ]) {
    const { descriptor, errors } = parse(fs.readFileSync(`app/components/${name}.vue`, 'utf8'))
    assert.equal(errors.length, 0)
    const compiled = compileScript(descriptor, { id: name })
    const hooks = []
    const { db, requests } = database()
    db.platforms = db.expenseTypes = async () => [
      { id: platformId, name: 'Histórico', active: false },
      { id: expenseId, name: 'Desactivado', active: false },
      { id: tripId, name: 'Activo', active: true },
    ]
    const globals = { ...helpers, computed, reactive, ref, watch, onMounted: hook => hooks.push(hook), useDb: () => db, useDirtyForm: () => ({ dirty: ref(false), confirmLeave: () => true, markSaved() {} }) }
    const component = evaluate(compiled.content, `${name}.ts`, globals).default
    const bindings = component.setup({ initial, tripId }, { expose() {}, emit() {} })
    await Promise.all(hooks.map(hook => hook()))
    assert.equal(bindings[optionName].value.length, 3)
    assert.equal(bindings[availableName].value.length, 2)
    assert.equal(bindings[availableName].value.some(option => option.id === expenseId), false)
    assert.equal(bindings.form[selectedKey], platformId)
    assert.equal('platform' in bindings.form, false)
    assert.equal('expense_type' in bindings.form, false)
    await bindings.submit()
    assert.equal(bindings.error.value, '')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].method, 'PATCH')
  }
})
