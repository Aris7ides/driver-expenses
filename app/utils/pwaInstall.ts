import { computed, ref } from 'vue'

export interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const SNOOZE_KEY = 'miruta:pwa-dismissed-until'
const INSTALLED_KEY = 'miruta:pwa-installed'
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

export function createPwaInstaller(browser: Window, now = () => Date.now()) {
  const nav = browser.navigator as Navigator & { standalone?: boolean; userAgentData?: { mobile?: boolean } }
  const ios = /iPad|iPhone|iPod/i.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  const mobile = ios || nav.userAgentData?.mobile === true || /Android|Mobile/i.test(nav.userAgent)
  const embedded = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|; wv\)/i.test(nav.userAgent)
  const displayMode = browser.matchMedia('(display-mode: standalone)')
  const standalone = ref(false)
  const knownInstalled = ref(false)
  const snoozed = ref(false)
  const delayed = ref(false)
  const canInstall = ref(false)
  const installing = ref(false)
  const helpOpen = ref(false)
  const installError = ref('')
  let deferred: InstallPromptEvent | null = null
  let snoozeTimer: number | undefined
  let dismissedUntil = 0
  let installedHere = false

  const read = (key: string) => {
    try { return browser.localStorage.getItem(key) } catch { return null }
  }
  const store = (key: string, value: string) => {
    try { browser.localStorage.setItem(key, value) } catch { /* La preferencia sigue funcionando durante esta visita. */ }
  }
  const remove = (key: string) => {
    try { browser.localStorage.removeItem(key) } catch { /* El almacenamiento puede estar bloqueado. */ }
  }
  const refreshMode = () => {
    standalone.value = displayMode.matches || nav.standalone === true
    if (standalone.value) {
      installedHere = true
      knownInstalled.value = true
      store(INSTALLED_KEY, '1')
      helpOpen.value = false
    }
  }
  const refreshPreferences = () => {
    knownInstalled.value = standalone.value || installedHere || read(INSTALLED_KEY) === '1'
    const until = Number(read(SNOOZE_KEY) ?? dismissedUntil)
    const remaining = Number.isFinite(until) ? until - now() : 0
    snoozed.value = remaining > 0
    browser.clearTimeout(snoozeTimer)
    if (remaining > 0) snoozeTimer = browser.setTimeout(() => { snoozed.value = false }, Math.min(remaining, SNOOZE_MS))
  }
  const dismiss = () => {
    dismissedUntil = now() + SNOOZE_MS
    store(SNOOZE_KEY, String(dismissedUntil))
    snoozed.value = true
    browser.clearTimeout(snoozeTimer)
    snoozeTimer = browser.setTimeout(() => { snoozed.value = false }, SNOOZE_MS)
  }
  const onPrompt = (event: Event) => {
    // Solo ofrecemos instalación directa si el navegador entrega esta capacidad.
    if (!('prompt' in event) || standalone.value) return
    event.preventDefault()
    deferred = event as InstallPromptEvent
    canInstall.value = true
    knownInstalled.value = false
    installedHere = false
    remove(INSTALLED_KEY)
  }
  const onInstalled = () => {
    deferred = null
    canInstall.value = false
    knownInstalled.value = true
    installedHere = true
    helpOpen.value = false
    store(INSTALLED_KEY, '1')
  }
  const onPageShow = () => { refreshMode(); refreshPreferences() }
  const onStorage = (event: StorageEvent) => {
    if (!event.key || [SNOOZE_KEY, INSTALLED_KEY].includes(event.key)) refreshPreferences()
  }
  const openHelp = () => { installError.value = ''; helpOpen.value = true }
  const closeHelp = () => { helpOpen.value = false; dismiss() }
  const install = async () => {
    if (installing.value || standalone.value || knownInstalled.value) return
    if (!deferred) { openHelp(); return }
    const prompt = deferred
    deferred = null
    canInstall.value = false
    installing.value = true
    installError.value = ''
    try {
      // prompt() se invoca dentro del clic del usuario y solo una vez por evento.
      await prompt.prompt()
      const choice = await prompt.userChoice
      dismiss()
      if (choice.outcome === 'accepted') helpOpen.value = false
    } catch {
      installError.value = 'No se pudo abrir el instalador. Puedes seguir estos pasos para añadir MiRuta.'
      helpOpen.value = true
    } finally {
      installing.value = false
    }
  }

  refreshMode()
  refreshPreferences()
  const delayTimer = browser.setTimeout(() => { delayed.value = true }, 6000)
  browser.addEventListener('beforeinstallprompt', onPrompt)
  browser.addEventListener('appinstalled', onInstalled)
  browser.addEventListener('pageshow', onPageShow)
  browser.addEventListener('storage', onStorage)
  displayMode.addEventListener('change', refreshMode)

  const showRecommendation = computed(() => mobile && browser.isSecureContext && delayed.value && !standalone.value && !knownInstalled.value && !snoozed.value && !helpOpen.value)
  const dispose = () => {
    browser.clearTimeout(delayTimer)
    browser.clearTimeout(snoozeTimer)
    browser.removeEventListener('beforeinstallprompt', onPrompt)
    browser.removeEventListener('appinstalled', onInstalled)
    browser.removeEventListener('pageshow', onPageShow)
    browser.removeEventListener('storage', onStorage)
    displayMode.removeEventListener('change', refreshMode)
  }
  return { ios, mobile, embedded, secure: browser.isSecureContext, standalone, knownInstalled, canInstall, installing, helpOpen, installError, showRecommendation, dismiss, install, openHelp, closeHelp, dispose }
}
