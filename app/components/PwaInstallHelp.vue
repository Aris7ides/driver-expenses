<script setup lang="ts">
import { X, Share, Download } from 'lucide-vue-next'

const { ios, embedded, secure, standalone, canInstall, installing, helpOpen, installError, install, closeHelp } = usePwaInstall()
const dialog = ref<HTMLDialogElement | null>(null)
watch(helpOpen, open => {
  if (open && !dialog.value?.open) dialog.value?.showModal()
  else if (!open && dialog.value?.open) dialog.value.close()
}, { flush: 'post' })
</script>

<template>
  <dialog ref="dialog" class="pwa-help" aria-labelledby="pwa-help-title" aria-describedby="pwa-help-description" @cancel.prevent="closeHelp" @close="helpOpen && closeHelp()">
    <div class="pwa-help-heading">
      <img src="/icon-192.png" alt="" width="48" height="48" />
      <button class="icon-button" aria-label="Cerrar instrucciones de instalación" @click="closeHelp"><X :size="22" /></button>
    </div>
    <h2 id="pwa-help-title">Instala MiRuta</h2>
    <p id="pwa-help-description">Ten tus viajes y gastos a mano desde la pantalla de inicio de tu dispositivo.</p>
    <p v-if="installError" class="alert warning" role="status">{{ installError }}</p>
    <p v-if="standalone" class="alert success">Ya estás usando MiRuta como aplicación.</p>
    <p v-if="!secure" class="alert warning">Abre la versión HTTPS de MiRuta para poder instalarla.</p>
    <p v-if="embedded" class="alert warning">Estás dentro de otra aplicación. Abre su menú y busca «Abrir en el navegador» para continuar.</p>
    <template v-if="ios">
      <ol>
        <li>Abre esta misma página en <strong>Safari</strong>.</li>
        <li>Pulsa <strong>Compartir</strong> <Share :size="16" aria-hidden="true" />. Según la configuración de Safari, está dentro del menú de la página.</li>
        <li>Elige <strong>Añadir a pantalla de inicio</strong>.</li>
        <li>Si aparece <strong>Abrir como app web</strong>, déjalo activado y pulsa <strong>Añadir</strong>.</li>
      </ol>
      <p class="pwa-help-note">Si no encuentras la opción, busca «Editar acciones» al final del menú Compartir.</p>
    </template>
    <template v-else>
      <button v-if="canInstall && !standalone" class="button primary full" :disabled="installing" @click="install"><Download :size="17" aria-hidden="true" />{{ installing ? 'Abriendo...' : 'Instalar MiRuta' }}</button>
      <ol>
        <li>Abre el menú de tu navegador.</li>
        <li>Busca <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>. En escritorio puede aparecer un icono de instalación en la barra de direcciones.</li>
        <li>Confirma la instalación y abre MiRuta desde su nuevo icono.</li>
      </ol>
      <p class="pwa-help-note">Si tu navegador no ofrece esa opción, prueba con Chrome o Edge; en Mac también puedes usar Safari y «Añadir al Dock».</p>
    </template>
    <p class="pwa-help-note">MiRuta necesita conexión a internet para consultar y guardar tus datos.</p>
    <button class="button secondary full" @click="closeHelp">Entendido</button>
  </dialog>
</template>

<style scoped>
.pwa-help{border:1px solid #e8edf6;border-radius:18px;padding:24px;width:calc(100% - 32px);max-width:440px;max-height:calc(100dvh - 40px);overflow-y:auto;color:#14243f;box-shadow:0 16px 70px #14243f33}
.pwa-help::backdrop{background:#0b1a3477}
.pwa-help-heading{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
.pwa-help-heading img{border-radius:12px}
.pwa-help h2{font-size:22px;margin-bottom:8px}
.pwa-help p,.pwa-help li{font-size:14px;line-height:1.6}
.pwa-help ol{padding-left:22px;margin:18px 0}
.pwa-help li{padding-left:4px;margin-bottom:12px}
.pwa-help li svg{vertical-align:middle;color:#2469ed}
.pwa-help .pwa-help-note{font-size:12px;color:#526179}
</style>
