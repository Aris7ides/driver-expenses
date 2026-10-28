import type { User } from '@supabase/supabase-js'
const initializing = new WeakMap<object, Promise<void>>()

export const useSession = () => {
  const user = useState<User | null>('session-user', () => null)
  const ready = useState<boolean>('session-ready', () => false)
  const { $supabase, $configured } = useNuxtApp()
  const init = async () => {
    if (ready.value) return
    if (!$configured) { ready.value = true; return }
    if (!initializing.has($supabase)) initializing.set($supabase, (async () => {
      const { data, error } = await $supabase.auth.getSession()
      user.value = error ? null : data.session?.user ?? null
      $supabase.auth.onAuthStateChange((_event, session) => { user.value = session?.user ?? null })
      ready.value = true
    })().finally(() => { initializing.delete($supabase) }))
    await initializing.get($supabase)
  }
  const logout = async () => { const { error } = await $supabase.auth.signOut(); if (error) throw error; user.value = null; await navigateTo('/login') }
  return { user, ready, init, logout, configured: $configured }
}
