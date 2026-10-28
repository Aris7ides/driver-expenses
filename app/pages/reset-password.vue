<script setup lang="ts">
definePageMeta({ layout: 'blank' })
const { $supabase } = useNuxtApp()
const password = ref(''), info = ref(''), error = ref('')
async function submit() { const { error: err } = await $supabase.auth.updateUser({ password: password.value }); if (err) error.value = message(err); else { info.value = 'Contraseña actualizada.'; await navigateTo('/') } }
</script>
<template><div class="center-page"><form class="card reset-card" @submit.prevent="submit"><h1>Restablecer contraseña</h1><p class="muted">Escribe tu nueva contraseña.</p><div v-if="error" class="alert danger">{{error}}</div><div v-if="info" class="alert success">{{info}}</div><label class="field">Nueva contraseña<input v-model="password" type="password" minlength="6" required /></label><button class="button primary" type="submit">Guardar contraseña</button></form></div></template>
