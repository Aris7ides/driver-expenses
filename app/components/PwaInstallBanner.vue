<script setup lang="ts">
import { Download, X } from 'lucide-vue-next'

const { showRecommendation, canInstall, installing, install, dismiss } = usePwaInstall()
const route = useRoute()
const editing = ref(false)
const visible = computed(() => showRecommendation.value && ['/', '/login'].includes(route.path) && !editing.value)
const updateFocus = () => {
  editing.value = !!document.activeElement?.closest('input, select, textarea, [contenteditable="true"]')
}
const onFocusOut = () => { queueMicrotask(updateFocus) }
onMounted(() => {
  updateFocus()
  document.addEventListener('focusin', updateFocus)
  document.addEventListener('focusout', onFocusOut)
})
onBeforeUnmount(() => {
  document.removeEventListener('focusin', updateFocus)
  document.removeEventListener('focusout', onFocusOut)
})
</script>

<template>
  <aside v-if="visible" class="pwa-banner card" :class="{ 'pwa-banner-login': route.path === '/login' }" aria-labelledby="pwa-banner-title">
    <img src="/icon-192.png" alt="" width="44" height="44" class="pwa-banner-icon" />
    <div class="pwa-banner-content">
      <h2 id="pwa-banner-title">Lleva MiRuta en tu móvil</h2>
      <p>Añádela a tu pantalla de inicio para acceder directamente a tus viajes y gastos.</p>
      <div class="pwa-banner-actions">
        <button class="button primary small" :disabled="installing" @click="install">
          <Download :size="16" aria-hidden="true" />
          {{ installing ? 'Abriendo...' : canInstall ? 'Instalar MiRuta' : 'Cómo instalar' }}
        </button>
        <button class="button secondary small" :disabled="installing" @click="dismiss">Ahora no</button>
      </div>
    </div>
    <button class="icon-button pwa-banner-close" aria-label="Recordármelo dentro de 7 días" :disabled="installing" @click="dismiss"><X :size="18" /></button>
  </aside>
</template>

<style scoped>
.pwa-banner{position:fixed;left:16px;right:16px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:15;display:flex;align-items:flex-start;gap:12px;padding:18px;max-width:480px;margin:0 auto;box-shadow:0 8px 32px #14243f29}
.pwa-banner-login{bottom:calc(16px + env(safe-area-inset-bottom))}
.pwa-banner-icon{border-radius:11px;flex-shrink:0}
.pwa-banner-content{flex:1;min-width:0;padding-right:8px}
.pwa-banner h2{font-size:15px;margin:0 18px 7px 0}
.pwa-banner p{font-size:12px;line-height:1.5;color:#526179;margin:0 0 12px}
.pwa-banner-actions{display:flex;gap:8px;flex-wrap:wrap}
.pwa-banner-close{position:absolute;right:6px;top:6px}
@media(max-width:360px){.pwa-banner{left:10px;right:10px;padding:14px;gap:8px}.pwa-banner-icon{width:32px;height:32px}.pwa-banner-actions .button{font-size:12px;padding:9px}}
</style>
