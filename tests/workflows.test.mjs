import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { compileScript, parse } from '@vue/compiler-sfc'
import { computed, reactive, ref, watch, nextTick } from 'vue'
import { evaluate, loadModule } from './load-module.mjs'

const helpers = loadModule('app/composables/useHelpers.ts')
const { readAll } = loadModule('app/utils/readAll.ts')
const { csvText } = loadModule('app/utils/csv.ts')
const owner = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'

function database(fetchImpl) {
  const client = createClient('https://example.supabase.co', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchImpl },
  })
  client.auth.getUser = async () => ({ data: { user: { id: owner } }, error: null })
  return loadModule('app/composables/useDb.ts', { useNuxtApp: () => ({ $supabase: client }) }).useDb()
}

test('las consultas completas superan 1.000 filas y respetan límites menores del servidor', async () => {
  const data = Array.from({ length: 1103 }, (_, id) => ({ id }))
  const offsets = []
  const rows = await readAll(async offset => { offsets.push(offset); return { data: data.slice(offset, offset + 137), error: null } })
  assert.equal(rows.length, 1103)
  assert.equal(rows.at(-1).id, 1102)
  assert.ok(offsets.includes(1096))
  assert.equal(offsets.at(-1), 1103)
  await assert.rejects(readAll(async offset => offset ? { error: new Error('Sin conexión'), data: null } : { data: [{ id }], error: null }), /Sin conexión/)
})

test('los filtros de fechas, plataforma y estado llegan a Supabase con orden estable y propietario', async () => {
  const requests = []
  const db = database(async (url, options) => { requests.push(new URL(url)); return Response.json([]) })
  await db.trips({ from: '2026-10-01', to: '2026-10-31', platformId: id, status: 'finalizado' })
  const query = requests[0].searchParams
  assert.equal(query.get('user_id'), `eq.${owner}`)
  assert.equal(query.get('platform_id'), `eq.${id}`)
  assert.equal(query.get('status'), 'eq.finalizado')
  assert.equal(query.get('order'), 'start_at.desc,id.asc')
  assert.equal(query.get('start_at'), `gte.${new Date('2026-10-01T00:00:00').toISOString()}`)
  assert.equal(query.getAll('start_at')[1], `lt.${new Date('2026-11-01T00:00:00').toISOString()}`)
})

test('registrar cobros suma únicamente el importe recibido y protege el saldo contra otra ventana', async () => {
  const requests = []
  let balance = 20
  const db = database(async (url, options) => {
    const target = new URL(url); requests.push({ target, options })
    if (options.method === 'GET') return Response.json({ id, status: 'finalizado', service_price: 100, service_collected: balance })
    assert.equal(target.searchParams.get('service_collected'), `eq.${balance}`)
    assert.equal(target.searchParams.get('service_price'), 'eq.100')
    assert.equal(target.searchParams.get('user_id'), `eq.${owner}`)
    const payload = JSON.parse(options.body)
    assert.deepEqual(Object.keys(payload).sort(), ['service_collected', 'user_id'])
    balance = payload.service_collected
    return Response.json({ id })
  })
  await db.collect('trips', id, 30)
  assert.equal(balance, 50)
  await assert.rejects(db.collect('trips', id, 51), /supera/)
  await assert.rejects(db.collect('trips', id, 0), /positivo/)
  assert.equal(requests.filter(request => request.options.method === 'PATCH').length, 1)
  const racing = database(async (_url, options) => options.method === 'GET' ? Response.json({ id, status: 'finalizado', service_price: 100, service_collected: 20 }) : Response.json({ code: 'PGRST116', message: 'No rows' }, { status: 406 }))
  await assert.rejects(racing.collect('trips', id, 10), /otra ventana/)
})

test('reembolsos y servicios cancelados respetan quién adelantó el gasto y sus límites', async () => {
  let paid = true
  let patch
  const db = database(async (url, options) => {
    if (options.method === 'GET') return Response.json({ id, status: 'cancelado', service_price: 100, service_collected: 0, paid_by_driver: paid, refundable_amount: 30, reimbursed_amount: 5 })
    patch = { url: new URL(url), body: JSON.parse(options.body) }
    return Response.json({ id })
  })
  await db.collect('expenses', id, 10)
  assert.equal(patch.body.reimbursed_amount, 15)
  assert.equal(patch.url.searchParams.get('paid_by_driver'), 'eq.true')
  assert.equal(patch.url.searchParams.get('refundable_amount'), 'eq.30')
  paid = false
  await assert.rejects(db.collect('expenses', id, 1), /no fue adelantado/)
  await assert.rejects(db.collect('trips', id, 1), /cancelado/)
})

test('el resumen separa previsión y resultado, conservando gastos y reembolsos de cancelaciones', () => {
  const trips = [
    { id: 'done', start_at: '2026-10-10T12:00:00Z', status: 'finalizado', service_price: 100, service_collected: 20, estimated_budget: 30 },
    { id: 'cancelled', start_at: '2026-10-10T12:00:00Z', status: 'cancelado', service_price: 500, service_collected: 0, estimated_budget: 0 },
    { id: 'future', start_at: '2026-10-11T12:00:00Z', status: 'planificado', service_price: 200, service_collected: 0, estimated_budget: 50 },
  ]
  const expenses = [
    { trip_id: 'done', amount: 10, refundable_amount: 0, reimbursed_amount: 0, paid_by_driver: true },
    { trip_id: 'cancelled', amount: 25, refundable_amount: 5, reimbursed_amount: 0, paid_by_driver: true },
    { trip_id: 'future', amount: 15, refundable_amount: 0, reimbursed_amount: 0, paid_by_driver: true },
  ]
  const summary = helpers.monthlySummary(trips, expenses, '2026-10')
  assert.equal(summary.income, 100)
  assert.equal(summary.profit, 70)
  assert.equal(summary.spending, 50)
  assert.equal(summary.forecastServices, 200)
  assert.equal(summary.forecastBudget, 50)
  assert.equal(summary.outstanding, 285)
  assert.equal(helpers.sumMoney([0.1, 0.2]), 0.3)
  assert.equal(helpers.budgetDifference(20, [{ amount: 25 }]), -5)
})

test('el CSV conserva decimales, comillas y saltos de línea y neutraliza fórmulas de texto', () => {
  const csv = csvText([['Concepto', 'Importe'], ['=HYPERLINK("x")', 12.5], ['texto; "entre comillas"\notra línea', -10]])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")";"12,5"'))
  assert.ok(csv.includes('"texto; ""entre comillas""\notra línea";"-10"'))
})

test('una sesión que cambia de usuario o se cierra desmonta inmediatamente la vista privada', async () => {
  let callback, sessions = 0, subscriptions = 0
  const states = new Map(), paths = [], route = reactive({ path: '/' })
  const client = { auth: { getSession: async () => { sessions++; return { data: { session: { user: { id: 'A' } } } } }, onAuthStateChange: fn => { subscriptions++; callback = fn }, signOut: async () => ({ error: null }) } }
  const sessionModule = loadModule('app/composables/useSession.ts', { useState: (key, init) => { if (!states.has(key)) states.set(key, ref(init())); return states.get(key) }, useNuxtApp: () => ({ $supabase: client, $configured: true }), navigateTo: path => paths.push(path) })
  const session = sessionModule.useSession()
  await Promise.all([session.init(), session.init()])
  assert.equal(sessions, 1); assert.equal(subscriptions, 1)
  const { descriptor } = parse(fs.readFileSync('app/app.vue', 'utf8'))
  const component = evaluate(compileScript(descriptor, { id: 'app-test' }).content, 'app.ts', { useSession: () => session, useRoute: () => route, useRouter: () => ({ replace: path => { paths.push(path); return Promise.resolve() } }), computed, watch }).default
  const view = component.setup({}, { expose() {} })
  assert.equal(view.visible.value, true)
  callback('SIGNED_IN', { user: { id: 'B' } }); await nextTick()
  assert.equal(session.user.value.id, 'B')
  assert.equal(paths.at(-1), '/')
  callback('SIGNED_OUT', null)
  assert.equal(view.visible.value, false)
  await nextTick()
  assert.equal(paths.at(-1), '/login')
})

test('los cambios sin guardar se protegen sin bloquear un cambio de cuenta', () => {
  const user = ref({ id: 'A' }), hooks = [], listeners = new Map()
  let guard, confirms = 0
  const window = { confirm: () => { confirms++; return false }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener() {} }
  const { useDirtyForm } = loadModule('app/composables/useDirtyForm.ts', { ref, computed, useSession: () => ({ user }), window, onMounted: fn => hooks.push(fn), onBeforeUnmount() {}, onBeforeRouteLeave: fn => { guard = fn } })
  const form = reactive({ amount: 0 }), state = useDirtyForm(form)
  hooks.forEach(fn => fn())
  form.amount = 20
  assert.equal(state.dirty.value, true)
  assert.equal(guard(), false)
  assert.equal(confirms, 1)
  user.value = { id: 'B' }
  assert.equal(guard(), true)
  assert.equal(confirms, 1)
  state.markSaved()
  assert.equal(state.dirty.value, false)
})

test('el gasto rápido preselecciona un viaje en curso y guardar otro conserva viaje y categoría', async () => {
  const saved = [], events = [], hooks = []
  const db = { expenseTypes: async () => [{ id, name: 'Combustible', active: true }], trips: async () => [{ id: 'old', status: 'finalizado' }, { id, status: 'en_curso' }], saveExpense: async (...args) => saved.push(args) }
  const { descriptor } = parse(fs.readFileSync('app/components/ExpenseForm.vue', 'utf8'))
  const component = evaluate(compileScript(descriptor, { id: 'quick-expense-test' }).content, 'ExpenseForm.ts', { ...helpers, useDb: () => db, ref, reactive, computed, watch, onMounted: fn => hooks.push(fn), useDirtyForm: () => ({ dirty: ref(false), confirmLeave: () => true, markSaved() {} }) }).default
  const view = component.setup({ chooseTrip: true }, { expose() {}, emit: (...args) => events.push(args) })
  await Promise.all(hooks.map(fn => fn()))
  assert.equal(view.selectedTrip.value, id)
  view.form.expense_type_id = id; view.form.amount = 20; view.refundMode.value = 'full'
  await view.submit(true)
  assert.equal(saved.length, 1)
  assert.equal(saved[0][0], id)
  assert.equal(saved[0][1].refundable_amount, 20)
  assert.equal(view.form.amount, 0)
  assert.equal(view.form.expense_type_id, id)
  assert.equal(view.selectedTrip.value, id)
  assert.deepEqual(events[0], ['saved', id, true])
})
