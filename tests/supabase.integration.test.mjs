import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { loadModule } from './load-module.mjs'

for (const file of ['.env', '.env.test']) {
  if (fs.existsSync(file)) process.loadEnvFile(file)
}
const required = ['NUXT_PUBLIC_SUPABASE_URL', 'NUXT_PUBLIC_SUPABASE_ANON_KEY',
  'MIRUTA_TEST_A_EMAIL', 'MIRUTA_TEST_A_PASSWORD', 'MIRUTA_TEST_B_EMAIL', 'MIRUTA_TEST_B_PASSWORD']
const enabled = required.every(name => process.env[name]) && process.env.MIRUTA_TEST_ALLOW_WRITES === '1'

test('Supabase remoto: CRUD, joins, RLS y referencias entre dos usuarios de prueba', {
  skip: enabled ? false : 'Requiere dos cuentas de prueba y MIRUTA_TEST_ALLOW_WRITES=1 en .env.test.',
  timeout: 120000,
}, async () => {
  const accounts = []
  const cleanup = []
  try {
    for (const name of ['A', 'B']) {
      const client = createClient(process.env.NUXT_PUBLIC_SUPABASE_URL, process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }) },
      })
      const { data, error } = await client.auth.signInWithPassword({
        email: process.env[`MIRUTA_TEST_${name}_EMAIL`], password: process.env[`MIRUTA_TEST_${name}_PASSWORD`],
      })
      if (error) throw new Error(`Login de prueba ${name}: ${error.code || error.message}`)
      const { useDb } = loadModule('app/composables/useDb.ts', { useNuxtApp: () => ({ $supabase: client }) })
      accounts.push({ client, db: useDb(), userId: data.user.id })
    }
    const [a, b] = accounts
    assert.notEqual(a.userId, b.userId, 'Deben ser dos usuarios diferentes.')
    const reference = `MiRuta prueba ${randomUUID()}`
    const tripInput = { platform_id: null, origin: 'Prueba automática', destination: 'Prueba automática',
      start_at: new Date().toISOString(), end_at: null, status: 'planificado', estimated_budget: 10,
      service_price: 100, service_collected: 0, kilometers: 1, external_reference: reference, notes: 'Registro temporal de prueba' }
    const expenseInput = { expense_type_id: null, spent_at: new Date().toISOString().slice(0, 10),
      amount: 10, refundable_amount: 5, reimbursed_amount: 0, description: reference, notes: null, paid_by_driver: true }

    for (const account of accounts) {
      const platforms = await account.db.platforms()
      const types = await account.db.expenseTypes()
      assert.ok(platforms.length, 'El alta debe precargar las plataformas del usuario.')
      assert.ok(types.length, 'El alta debe precargar las categorías del usuario.')
      assert.ok(platforms.every(item => item.user_id === account.userId))
      assert.ok(types.every(item => item.user_id === account.userId))
      account.platform = platforms[0].id
      account.category = types[0].id
      account.tripId = await account.db.saveTrip({ ...tripInput, platform_id: account.platform })
      cleanup.push(account)
      const original = await account.db.trip(account.tripId)
      assert.equal(original.platform.id, account.platform)
      await account.db.saveTrip({ ...original, service_price: 120, service_collected: 30 }, account.tripId)
      assert.equal(Number((await account.db.trip(account.tripId)).service_collected), 30)
      await account.db.saveExpense(account.tripId, { ...expenseInput, expense_type_id: account.category })
      const [expense] = await account.db.expenses(account.tripId)
      assert.equal(expense.expense_type.id, account.category)
      account.expenseId = expense.id
      await account.db.saveExpense(account.tripId, { ...expense, reimbursed_amount: 3 }, expense.id)
      assert.equal(Number((await account.db.expenses(account.tripId))[0].reimbursed_amount), 3)
      await account.db.collect('trips', account.tripId, 1.25)
      assert.equal(Number((await account.db.trip(account.tripId)).service_collected), 31.25)
      await account.db.collect('expenses', expense.id, 2)
      assert.equal(Number((await account.db.expenses(account.tripId))[0].reimbursed_amount), 5)
      await assert.rejects(account.db.collect('expenses', expense.id, 1), /supera/)
      await assert.rejects(account.db.saveTrip({ ...original, service_price: 120, service_collected: 30 }, account.tripId, 30), error => error.code === 'PGRST116')
      await assert.rejects(account.db.saveExpense(account.tripId, { ...expense, reimbursed_amount: 3 }, expense.id, 3), error => error.code === 'PGRST116')
      assert.ok((await account.db.trips()).every(item => item.user_id === account.userId))
    }
    for (const [account, other] of [[a, b], [b, a]]) {
      for (const [table, foreignId] of [['trips', other.tripId], ['expenses', other.expenseId]]) {
        const read = await account.client.from(table).select('id').eq('id', foreignId)
        assert.equal(read.error, null)
        assert.equal(read.data.length, 0, 'RLS debe impedir la lectura incluso sin el filtro de propietario del cliente.')
        const update = await account.client.from(table).update({ notes: 'Intento entre cuentas de prueba' }).eq('id', foreignId).select('id')
        assert.equal(update.error, null)
        assert.equal(update.data.length, 0, 'RLS debe impedir la escritura incluso sin el filtro de propietario del cliente.')
      }
      await assert.rejects(account.db.trip(other.tripId), error => error.code === 'PGRST116')
      assert.equal((await account.db.expenses(other.tripId)).length, 0)
      await assert.rejects(account.db.saveTrip(tripInput, other.tripId), error => error.code === 'PGRST116')
      await assert.rejects(account.db.saveExpense(other.tripId, expenseInput, other.expenseId), error => error.code === 'PGRST116')
      await assert.rejects(account.db.remove('trips', other.tripId), error => error.code === 'PGRST116')
      await assert.rejects(account.db.remove('expenses', other.expenseId), error => error.code === 'PGRST116')
      await assert.rejects(account.db.saveExpense(other.tripId, expenseInput), error => error.code === '23503')
      await assert.rejects(account.db.saveTrip({ ...tripInput, platform_id: other.platform }, account.tripId), error => error.code === '23503')
      await assert.rejects(account.db.saveExpense(account.tripId, { ...expenseInput, expense_type_id: other.category }), error => error.code === '23503')
      const changeOwner = await account.client.from('trips').update({ user_id: other.userId }).eq('id', account.tripId)
      assert.equal(changeOwner.error?.code, '42501', 'RLS debe impedir cambiar el propietario.')
      const otherProfile = await account.client.from('profiles').select('id').eq('id', other.userId)
      assert.equal(otherProfile.error, null)
      assert.equal(otherProfile.data.length, 0)
    }
    for (const account of accounts) {
      await account.db.remove('expenses', account.expenseId)
      assert.equal((await account.db.expenses(account.tripId)).length, 0)
      await account.db.saveExpense(account.tripId, expenseInput)
      await account.db.remove('trips', account.tripId)
      account.tripId = null
      assert.equal((await account.db.expenses()).some(expense => expense.description === reference), false, 'El borrado del viaje debe eliminar sus gastos.')
    }
  } finally {
    // Solo se eliminan los viajes creados por esta ejecución; nunca registros previos.
    const results = await Promise.allSettled(cleanup.filter(account => account.tripId).map(account => account.db.remove('trips', account.tripId)))
    const failures = results.filter(result => result.status === 'rejected')
    for (const account of accounts) await account.client.auth.signOut({ scope: 'local' })
    assert.equal(failures.length, 0, 'No se pudieron limpiar todos los registros temporales de prueba.')
  }
})
