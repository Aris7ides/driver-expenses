export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  const { user, init, configured } = useSession()
  await init()
  if (!configured && to.path !== '/login') return navigateTo('/login')
  if (!user.value && to.path !== '/login') return navigateTo('/login')
  if (user.value && to.path === '/login') return navigateTo('/')
})
