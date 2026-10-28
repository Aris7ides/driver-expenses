import { createClient } from '@supabase/supabase-js'
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const url = String(config.public.supabaseUrl)
  const key = String(config.public.supabaseAnonKey)
  // Demo setup remains navigable even before credentials are configured.
  const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder-key', {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  })
  return { provide: { supabase, configured: !!(url && key) } }
})
