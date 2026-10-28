import type { User } from '@supabase/supabase-js'

export const useSession = () => {
  const user = useState<User | null>('session-user', () => null)
  const ready = useState<boolean>('session-ready', () => false)
  const { $supabase, $configured } = useNuxtApp()
  const init = async () => {
    if (ready.value) return
    if (!$configured) { ready.value = true; return }
    const { data } = await $supabase.auth.getSession()
    user.value = data.session?.user ?? null
    $supabase.auth.onAuthStateChange((_event, session) => { user.value = session?.user ?? null })
    ready.value = true
  }
  const logout = async () => { await $supabase.auth.signOut(); user.value = null; await navigateTo('/login') }
  return { user, ready, init, logout, configured: $configured }
}
