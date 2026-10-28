import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { computed, reactive, ref } from 'vue'
import { compileScript, parse } from '@vue/compiler-sfc'
import { evaluate, loadModule } from './load-module.mjs'

const { createPwaInstaller } = loadModule('app/utils/pwaInstall.ts')
const DAY = 24 * 60 * 60 * 1000

function browser({ ios = false, standalone = false, desktop = false, secure = true, blockedStorage = false, storage = new Map(), initialTime = 1000 } = {}) {
  const window = new EventTarget()
  const mode = new EventTarget()
  mode.matches = standalone
  let time = initialTime
  let id = 0
  const timers = new Map()
  window.navigator = {
    userAgent: desktop ? 'Mozilla/5.0 Windows NT 10.0 Chrome/140.0' : ios ? 'Mozilla/5.0 iPhone Safari/604.1' : 'Mozilla/5.0 Linux Android 15 Chrome/140.0 Mobile',
    platform: ios ? 'iPhone' : desktop ? 'Win32' : 'Linux', maxTouchPoints: desktop ? 0 : 5,
  }
  window.isSecureContext = secure
  window.matchMedia = () => mode
  window.localStorage = Object.fromEntries(['getItem', 'setItem', 'removeItem'].map(method => [method, (...args) => {
    if (blockedStorage) throw Error('Storage blocked')
    if (method === 'getItem') return storage.get(args[0]) ?? null
    if (method === 'setItem') storage.set(...args)
    if (method === 'removeItem') storage.delete(args[0])
  }]))
  window.setTimeout = (callback, delay) => { const timerId = ++id; timers.set(timerId, { callback, at: time + delay }); return timerId }
  window.clearTimeout = timerId => timers.delete(timerId)
  const advance = ms => {
    const end = time + ms
    while (true) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at).find(([, timer]) => timer.at <= end)
      if (!next) break
      timers.delete(next[0]); time = next[1].at; next[1].callback()
    }
    time = end
  }
  const installer = createPwaInstaller(window, () => time)
  return { window, mode, storage, installer, advance, now: () => time, timers }
}

function promptEvent(window, { outcome = 'accepted', fail = false } = {}) {
  let calls = 0
  const event = new Event('beforeinstallprompt', { cancelable: true })
  event.prompt = async () => { calls++; if (fail) throw Error('Unavailable') }
  event.userChoice = Promise.resolve({ outcome })
  window.dispatchEvent(event)
  return { event, calls: () => calls }
}

test('el aviso móvil espera seis segundos y no aparece en escritorio o HTTP inseguro', () => {
  const phone = browser()
  assert.equal(phone.installer.showRecommendation.value, false)
  phone.advance(5999)
  assert.equal(phone.installer.showRecommendation.value, false)
  phone.advance(1)
  assert.equal(phone.installer.showRecommendation.value, true)
  for (const options of [{ desktop: true }, { secure: false }]) {
    const state = browser(options)
    state.advance(6000)
    assert.equal(state.installer.showRecommendation.value, false)
  }
})

test('detecta el modo standalone estándar, el de iPhone y los cambios de modo', () => {
  const standard = browser({ standalone: true })
  standard.advance(6000)
  assert.equal(standard.installer.showRecommendation.value, false)
  const iphone = browser({ ios: true })
  iphone.window.navigator.standalone = true
  iphone.window.dispatchEvent(new Event('pageshow'))
  iphone.advance(6000)
  assert.equal(iphone.installer.standalone.value, true)
  assert.equal(iphone.installer.showRecommendation.value, false)
  const phone = browser()
  phone.mode.matches = true
  phone.mode.dispatchEvent(new Event('change'))
  phone.advance(6000)
  assert.equal(phone.installer.showRecommendation.value, false)
})

test('Ahora no persiste siete días entre visitas y después permite recomendar otra vez', () => {
  const first = browser()
  first.advance(6000)
  first.installer.dismiss()
  assert.equal(first.installer.showRecommendation.value, false)
  first.installer.dispose()
  const next = browser({ storage: first.storage, initialTime: first.now() + DAY })
  next.advance(6000)
  assert.equal(next.installer.showRecommendation.value, false)
  next.advance(6 * DAY)
  assert.equal(next.installer.showRecommendation.value, true)
})

test('sin localStorage se puede descartar el aviso durante la visita', () => {
  const phone = browser({ blockedStorage: true })
  phone.advance(6000)
  phone.installer.dismiss()
  phone.window.dispatchEvent(new Event('pageshow'))
  assert.equal(phone.installer.showRecommendation.value, false)
  phone.installer.openHelp()
  assert.equal(phone.installer.helpOpen.value, true)
})

test('instalar abre el diálogo nativo una sola vez por evento y appinstalled oculta el aviso', async () => {
  const phone = browser()
  const native = promptEvent(phone.window)
  assert.equal(native.event.defaultPrevented, true)
  assert.equal(phone.installer.canInstall.value, true)
  assert.equal(native.calls(), 0)
  await phone.installer.install()
  assert.equal(native.calls(), 1)
  assert.equal(phone.installer.canInstall.value, false)
  assert.equal(phone.installer.installing.value, false)
  phone.window.dispatchEvent(new Event('appinstalled'))
  phone.advance(6000)
  await phone.installer.install()
  assert.equal(native.calls(), 1)
  assert.equal(phone.installer.showRecommendation.value, false)
  const reopened = browser({ storage: phone.storage })
  reopened.advance(6000)
  assert.equal(reopened.installer.knownInstalled.value, true)
  assert.equal(reopened.installer.showRecommendation.value, false)
})

test('rechazar el diálogo nativo aplaza la recomendación y espera un evento nuevo', async () => {
  const phone = browser()
  const native = promptEvent(phone.window, { outcome: 'dismissed' })
  await phone.installer.install()
  phone.advance(6000)
  assert.equal(phone.installer.showRecommendation.value, false)
  await phone.installer.install()
  assert.equal(native.calls(), 1)
  assert.equal(phone.installer.helpOpen.value, true)
  const next = promptEvent(phone.window)
  await phone.installer.install()
  assert.equal(next.calls(), 1)
})

test('iPhone y navegadores sin evento abren la guía; Ajustes puede abrirla aunque se descartara', async () => {
  const phone = browser({ ios: true })
  phone.installer.dismiss()
  await phone.installer.install()
  assert.equal(phone.installer.ios, true)
  assert.equal(phone.installer.helpOpen.value, true)
  phone.installer.closeHelp()
  assert.equal(phone.installer.helpOpen.value, false)
  phone.installer.openHelp()
  assert.equal(phone.installer.helpOpen.value, true)
})

test('si falla el diálogo nativo se ofrecen instrucciones y se puede reintentar con otro evento', async () => {
  const phone = browser()
  promptEvent(phone.window, { fail: true })
  await phone.installer.install()
  assert.equal(phone.installer.helpOpen.value, true)
  assert.match(phone.installer.installError.value, /No se pudo abrir/)
  assert.equal(phone.installer.installing.value, false)
  phone.installer.closeHelp()
  const next = promptEvent(phone.window)
  await phone.installer.install()
  assert.equal(next.calls(), 1)
  assert.equal(phone.installer.installError.value, '')
})

test('un nuevo evento de instalación permite reinstalar tras una instalación registrada', () => {
  const phone = browser({ storage: new Map([['miruta:pwa-installed', '1']]) })
  assert.equal(phone.installer.knownInstalled.value, true)
  promptEvent(phone.window)
  assert.equal(phone.installer.knownInstalled.value, false)
  assert.equal(phone.installer.canInstall.value, true)
})

test('la limpieza elimina listeners y temporizadores', () => {
  const phone = browser()
  phone.installer.dismiss()
  phone.installer.dispose()
  assert.equal(phone.timers.size, 0)
  promptEvent(phone.window)
  assert.equal(phone.installer.canInstall.value, false)
})

test('el aviso se limita al login y al inicio y se oculta al editar campos', () => {
  const pwa = browser()
  pwa.advance(6000)
  const route = reactive({ path: '/login' })
  const hooks = []
  const listeners = new Map()
  const document = {
    activeElement: null,
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: name => listeners.delete(name),
  }
  const { descriptor } = parse(fs.readFileSync('app/components/PwaInstallBanner.vue', 'utf8'))
  const { content } = compileScript(descriptor, { id: 'pwa-banner-test' })
  const component = evaluate(content, 'PwaInstallBanner.ts', {
    usePwaInstall: () => pwa.installer, useRoute: () => route, ref, computed, document, queueMicrotask,
    onMounted: hook => hooks.push(hook), onBeforeUnmount: () => {},
  }).default
  const view = component.setup({}, { expose() {} })
  hooks.forEach(hook => hook())
  assert.equal(view.visible.value, true)
  document.activeElement = { closest: () => ({}) }
  listeners.get('focusin')()
  assert.equal(view.visible.value, false)
  document.activeElement = null
  listeners.get('focusin')()
  route.path = '/trips/new'
  assert.equal(view.visible.value, false)
})
