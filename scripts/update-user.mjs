import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const root = fileURLToPath(new URL('../', import.meta.url))

export function readAdminConfig(env) {
  const url = env.SUPABASE_URL || env.NUXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Rellena la URL en .env y SUPABASE_SECRET_KEY en .env.admin.')
  const parsedUrl = new URL(url)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname)
  if ((parsedUrl.protocol !== 'https:' && !(local && parsedUrl.protocol === 'http:')) || parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error('La URL de Supabase debe usar HTTPS (HTTP solo en localhost) y no incluir credenciales ni parámetros.')
  }
  let adminKey = key.startsWith('sb_secret_')
  if (!adminKey && key.split('.').length === 3) {
    try { adminKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role' } catch { /* Clave inválida. */ }
  }
  if (!adminKey) throw new Error('Usa una clave secret (sb_secret_...) o service_role; la clave publishable/anon no permite administrar usuarios.')
  const userId = (env.MIRUTA_ADMIN_USER_ID || '').trim()
  if (!z.uuid().safeParse(userId).success) throw new Error('MIRUTA_ADMIN_USER_ID debe ser el UID del usuario en Authentication → Users.')
  const email = (env.MIRUTA_ADMIN_NEW_EMAIL || '').trim()
  const password = env.MIRUTA_ADMIN_NEW_PASSWORD || ''
  if (!email && !password) throw new Error('Indica MIRUTA_ADMIN_NEW_EMAIL y/o MIRUTA_ADMIN_NEW_PASSWORD en .env.admin.')
  if (email && !z.email().safeParse(email).success) throw new Error('MIRUTA_ADMIN_NEW_EMAIL no es un correo válido.')
  if (password && (password.length < 6 || !password.trim())) throw new Error('La contraseña debe tener al menos 6 caracteres y no contener solo espacios. Supabase puede exigir requisitos adicionales.')
  const confirm = env.MIRUTA_ADMIN_CONFIRM_EMAIL ?? 'true'
  if (!['true', 'false'].includes(confirm)) throw new Error('MIRUTA_ADMIN_CONFIRM_EMAIL debe ser true o false.')
  const attributes = {}
  if (email) Object.assign(attributes, { email, email_confirm: confirm === 'true' })
  if (password) attributes.password = password
  return { url: parsedUrl.href.replace(/\/$/, ''), key, userId, attributes, expectedEmail: (env.MIRUTA_ADMIN_EXPECTED_EMAIL || '').trim() }
}

export function formatAdminError(error, env) {
  let text = typeof error?.message === 'string' ? error.message : 'No se pudo actualizar el usuario.'
  for (const secret of [env.SUPABASE_SECRET_KEY, env.SUPABASE_SERVICE_ROLE_KEY, env.MIRUTA_ADMIN_NEW_PASSWORD]) {
    if (secret) text = text.split(secret).join('[oculto]')
  }
  return text
}

export async function updateRegisteredUser(env, { dryRun = false, write = console.log, fetchImpl = fetch } = {}) {
  const { url, key, userId, attributes, expectedEmail } = readAdminConfig(env)
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetchImpl(input, { ...init, signal: AbortSignal.timeout(15000) }) },
  }).auth.admin
  const existing = await admin.getUserById(userId)
  if (existing.error) throw existing.error
  if (!existing.data.user || existing.data.user.id.toLowerCase() !== userId.toLowerCase()) throw new Error('No se encontró el usuario indicado.')
  const currentEmail = existing.data.user.email || ''
  if (expectedEmail && currentEmail.toLowerCase() !== expectedEmail.toLowerCase()) throw new Error('El correo actual no coincide con MIRUTA_ADMIN_EXPECTED_EMAIL. No se ha cambiado la cuenta.')

  write(`Proyecto: ${new URL(url).origin}`)
  write(`Usuario: ${userId} · Correo actual: ${currentEmail || '(sin correo)'}`)
  if (attributes.email) write(`Nuevo correo: ${attributes.email} · Confirmar administrativamente: ${attributes.email_confirm ? 'sí' : 'no'}`)
  if (attributes.password) write('Contraseña: se actualizará (valor oculto).')
  if (dryRun) {
    write('Simulación completada. No se ha modificado el usuario.')
    return
  }
  const result = await admin.updateUserById(userId, attributes)
  if (result.error) throw result.error
  if (result.data.user?.id.toLowerCase() !== userId.toLowerCase()) throw new Error('La respuesta no permite confirmar la actualización. Revisa el usuario en Supabase antes de repetirla.')
  write('Usuario actualizado correctamente. Conserva su UID y los datos asociados.')
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  const args = process.argv.slice(2)
  try {
    if (args.includes('--help')) {
      console.log('Rellena .env.admin y ejecuta npm run admin:user. Usa -- --dry-run para comprobar el usuario sin cambiarlo. Nunca pases claves ni contraseñas como argumentos.')
    } else {
      if (args.some(arg => arg !== '--dry-run')) throw new Error('Argumento no reconocido. Usa --dry-run o --help.')
      for (const file of ['.env', '.env.admin']) {
        const filename = path.join(root, file)
        if (fs.existsSync(filename)) process.loadEnvFile(filename)
      }
      await updateRegisteredUser(process.env, {
        dryRun: args.includes('--dry-run'),
        write: text => console.log(formatAdminError({ message: text }, process.env)),
      })
    }
  } catch (error) {
    console.error(`Error: ${formatAdminError(error, process.env)}`)
    process.exitCode = 1
  }
}
