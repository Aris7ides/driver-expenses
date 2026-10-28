import { createPwaInstaller } from '~/utils/pwaInstall'

export default defineNuxtPlugin(() => {
  const pwaInstall = createPwaInstaller(window)
  const register = () => { navigator.serviceWorker.register('/sw.js').catch(console.warn) }
  if ('serviceWorker' in navigator && window.isSecureContext) {
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }
  if (import.meta.hot) import.meta.hot.dispose(() => {
    pwaInstall.dispose()
    window.removeEventListener('load', register)
  })
  return { provide: { pwaInstall } }
})
