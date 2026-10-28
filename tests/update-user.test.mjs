import assert from 'node:assert/strict'
import test from 'node:test'
import { formatAdminError, readAdminConfig, updateRegisteredUser } from '../scripts/update-user.mjs'

const userId = '11111111-1111-4111-8111-111111111111'
const env = {
  NUXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test_key',
  MIRUTA_ADMIN_USER_ID: userId,
  MIRUTA_ADMIN_EXPECTED_EMAIL: 'actual@example.com',
  MIRUTA_ADMIN_NEW_EMAIL: 'nuevo@example.com',
  MIRUTA_ADMIN_NEW_PASSWORD: 'Prueba # local 123',
  MIRUTA_ADMIN_CONFIRM_EMAIL: 'true',
}

function mockApi({ missingUser = false, updateError = false } = {}) {
  const requests = []
  const logs = []
  return {
    requests, logs,
    options: {
      write: line => logs.push(line),
      fetchImpl: async (url, init) => {
        const body = init.body ? JSON.parse(init.body) : undefined
        requests.push({ url: new URL(url), method: init.method, body })
        if (missingUser) return Response.json({ message: 'User not found', code: 'user_not_found' }, { status: 404 })
        if (updateError && init.method === 'PUT') return Response.json({ message: 'Email already exists', code: 'email_exists' }, { status: 422 })
        return Response.json({ id: userId, email: init.method === 'PUT' ? body.email || 'actual@example.com' : 'actual@example.com' })
      },
    },
  }
}

test('actualiza correo y contraseña de un usuario existente en una sola petición administrativa', async () => {
  const mock = mockApi()
  await updateRegisteredUser(env, mock.options)
  assert.deepEqual(mock.requests.map(request => request.method), ['GET', 'PUT'])
  assert.equal(mock.requests[1].url.pathname, `/auth/v1/admin/users/${userId}`)
  assert.deepEqual(mock.requests[1].body, { email: env.MIRUTA_ADMIN_NEW_EMAIL, email_confirm: true, password: env.MIRUTA_ADMIN_NEW_PASSWORD })
  assert.equal(mock.logs.some(line => line.includes(env.MIRUTA_ADMIN_NEW_PASSWORD)), false)
  assert.equal(mock.logs.some(line => line.includes(env.SUPABASE_SECRET_KEY)), false)
})

test('la simulación consulta el usuario sin actualizarlo', async () => {
  const mock = mockApi()
  await updateRegisteredUser(env, { ...mock.options, dryRun: true })
  assert.deepEqual(mock.requests.map(request => request.method), ['GET'])
  assert.match(mock.logs.at(-1), /No se ha modificado/)
})

test('permite cambiar solo contraseña sin modificar el correo ni su confirmación', async () => {
  const mock = mockApi()
  await updateRegisteredUser({ ...env, MIRUTA_ADMIN_NEW_EMAIL: '' }, mock.options)
  assert.deepEqual(mock.requests[1].body, { password: env.MIRUTA_ADMIN_NEW_PASSWORD })
})

test('permite cambiar solo correo y omitir la confirmación administrativa', async () => {
  const mock = mockApi()
  await updateRegisteredUser({ ...env, MIRUTA_ADMIN_NEW_PASSWORD: '', MIRUTA_ADMIN_CONFIRM_EMAIL: 'false' }, mock.options)
  assert.deepEqual(mock.requests[1].body, { email: env.MIRUTA_ADMIN_NEW_EMAIL, email_confirm: false })
})

test('no actualiza un usuario inexistente o cuyo correo actual no coincide', async () => {
  const missing = mockApi({ missingUser: true })
  await assert.rejects(updateRegisteredUser(env, missing.options), /User not found/)
  assert.equal(missing.requests.length, 1)
  const mismatch = mockApi()
  await assert.rejects(updateRegisteredUser({ ...env, MIRUTA_ADMIN_EXPECTED_EMAIL: 'otro@example.com' }, mismatch.options), /no coincide/)
  assert.equal(mismatch.requests.length, 1)
})

test('rechaza claves públicas, UID y valores inválidos antes de contactar con Supabase', async () => {
  const jwt = role => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`
  for (const values of [
    { SUPABASE_SECRET_KEY: 'sb_publishable_test' },
    { SUPABASE_SECRET_KEY: jwt('anon') },
    { SUPABASE_SECRET_KEY: jwt('authenticated') },
    { MIRUTA_ADMIN_USER_ID: 'no-es-uuid' },
    { MIRUTA_ADMIN_NEW_EMAIL: 'no-es-correo' },
    { MIRUTA_ADMIN_NEW_EMAIL: '', MIRUTA_ADMIN_NEW_PASSWORD: '' },
    { MIRUTA_ADMIN_NEW_PASSWORD: '123' },
    { MIRUTA_ADMIN_CONFIRM_EMAIL: 'quizás' },
    { NUXT_PUBLIC_SUPABASE_URL: 'http://example.com' },
  ]) {
    const mock = mockApi()
    await assert.rejects(updateRegisteredUser({ ...env, ...values }, mock.options))
    assert.equal(mock.requests.length, 0)
  }
  assert.equal(readAdminConfig({ ...env, SUPABASE_SECRET_KEY: jwt('service_role') }).attributes.email_confirm, true)
})

test('propaga errores de Supabase sin anunciar éxito y oculta secretos al formatearlos', async () => {
  const mock = mockApi({ updateError: true })
  await assert.rejects(updateRegisteredUser(env, mock.options), /Email already exists/)
  assert.equal(mock.logs.some(line => line.includes('actualizado correctamente')), false)
  const text = formatAdminError(new Error(`Error ${env.SUPABASE_SECRET_KEY} ${env.MIRUTA_ADMIN_NEW_PASSWORD}`), env)
  assert.equal(text.includes(env.SUPABASE_SECRET_KEY), false)
  assert.equal(text.includes(env.MIRUTA_ADMIN_NEW_PASSWORD), false)
})
