<script setup lang="ts">
import { Route, Eye, EyeOff } from 'lucide-vue-next'
definePageMeta({ layout: 'blank' })
const { $supabase, $configured } = useNuxtApp()
const email = ref(''), password = ref(''), register = ref(false), showPass = ref(false), busy = ref(false), error = ref(''), info = ref('')
async function submit() {
  error.value = ''; info.value = ''; busy.value = true
  try {
    if (register.value) {
      const { error: err, data } = await $supabase.auth.signUp({ email: email.value, password: password.value })
      if (err) throw err
      if (!data.session) info.value = 'Revisa tu correo y confirma la cuenta antes de acceder.'
      else await navigateTo('/')
    } else {
      const { error: err } = await $supabase.auth.signInWithPassword({ email: email.value, password: password.value })
      if (err) throw err
      await navigateTo('/')
    }
  } catch (e) { error.value = message(e) } finally { busy.value = false }
}
async function reset() {
  if (!email.value) { error.value = 'Introduce primero tu correo electrónico.'; return }
  const { error: err } = await $supabase.auth.resetPasswordForEmail(email.value, { redirectTo: window.location.origin + '/reset-password' })
  if (err) error.value = message(err)
  else info.value = 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.'
}
</script>
<template>
  <div class="login-page"><div class="login-hero"><div class="hero-brand"><div class="brand-icon">M</div><span>MiRuta</span></div><div class="hero-message"><h1>Tu trabajo.<br> Tus viajes.<br> Tus números.</h1><p>Controla los traslados, conoce tus gastos y descubre lo que ganas realmente.</p></div><span class="hero-footer">La herramienta para conductores profesionales</span></div>
    <div class="login-panel"><form class="login-card" @submit.prevent="submit"><div class="login-mark"><Route :size="26"/></div><h2>{{ register ? 'Crea tu cuenta' : 'Bienvenido a MiRuta' }}</h2><p class="muted">{{ register ? 'Empieza a organizar tus viajes.' : 'Accede para gestionar tu actividad.' }}</p>
      <div v-if="!$configured" class="alert warning">Configura <code>NUXT_PUBLIC_SUPABASE_URL</code> y <code>NUXT_PUBLIC_SUPABASE_ANON_KEY</code> en tu archivo .env.</div>
      <div v-if="error" class="alert danger">{{ error }}</div><div v-if="info" class="alert success">{{ info }}</div>
      <label class="field">Correo electrónico<input v-model="email" type="email" autocomplete="email" required placeholder="tu@email.com" /></label>
      <label class="field">Contraseña<div class="password-wrap"><input v-model="password" :type="showPass ? 'text' : 'password'" :autocomplete="register ? 'new-password' : 'current-password'" required minlength="6" placeholder="Mínimo 6 caracteres" /><button type="button" class="icon-button" @click="showPass = !showPass"><EyeOff v-if="showPass" :size="18"/><Eye v-else :size="18"/></button></div></label>
      <button class="button primary full" type="submit" :disabled="busy || !$configured">{{ busy ? 'Procesando...' : register ? 'Crear cuenta' : 'Iniciar sesión' }}</button><button v-if="!register" type="button" class="link-button" @click="reset">¿Has olvidado tu contraseña?</button>
      <p class="auth-switch">{{ register ? '¿Ya tienes cuenta?' : '¿Todavía no tienes cuenta?' }} <button type="button" class="link-button" @click="register = !register; error = ''; info = ''">{{ register ? 'Inicia sesión' : 'Regístrate' }}</button></p>
    </form></div>
  </div>
</template>
