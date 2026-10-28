<script setup lang="ts">
import { Download } from 'lucide-vue-next'
const { standalone, knownInstalled, canInstall, installing, install, openHelp } = usePwaInstall()
</script>

<template>
  <section class="card pwa-settings" aria-labelledby="pwa-settings-title">
    <img src="/icon-192.png" alt="" width="48" height="48" />
    <div class="pwa-settings-content">
      <h2 id="pwa-settings-title">MiRuta en tu dispositivo</h2>
      <p v-if="standalone">Ya estás usando MiRuta como aplicación.</p>
      <p v-else-if="knownInstalled">MiRuta ya se ha instalado desde este navegador. Puedes abrirla desde su icono.</p>
      <p v-else>Añade MiRuta a la pantalla de inicio para acceder directamente a tus viajes y gastos.</p>
      <button class="button" :class="standalone || knownInstalled ? 'secondary' : 'primary'" :disabled="installing" @click="standalone || knownInstalled ? openHelp() : install()">
        <Download :size="17" aria-hidden="true" />
        {{ installing ? 'Abriendo...' : standalone || knownInstalled ? 'Ver instrucciones' : canInstall ? 'Instalar MiRuta' : 'Cómo instalar MiRuta' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.pwa-settings{display:flex;gap:16px;align-items:flex-start;padding:22px;margin-top:24px}
.pwa-settings>img{border-radius:12px;flex-shrink:0}
.pwa-settings-content{min-width:0}
.pwa-settings h2{margin-bottom:8px}
.pwa-settings p{font-size:13px;line-height:1.6;color:#526179}
@media(max-width:360px){.pwa-settings{padding:16px;gap:10px}.pwa-settings>img{width:36px;height:36px}.pwa-settings .button{white-space:normal}}
</style>
