import process from 'node:process'

export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  ssr: false,
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  app: { head: { title: 'MiRuta · Viajes y gastos', meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }, { name: 'theme-color', content: '#2365e8' }, { name: 'description', content: 'Gestiona tus traslados, gastos y rentabilidad.' }], link: [{ rel: 'manifest', href: '/manifest.webmanifest' }, { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' }, { rel: 'apple-touch-icon', href: '/icon-192.png' }] } },
  runtimeConfig: { public: { supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '', supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || '' } }
})
