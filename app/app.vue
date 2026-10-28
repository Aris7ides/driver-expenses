<script setup lang="ts">
const { user, ready } = useSession()
const route = useRoute()
const router = useRouter()
const visible = computed(() => ready.value && (!!user.value || route.path === '/login'))
watch(() => user.value?.id, (id, previous) => {
  if (!ready.value) return
  if (!id) void router.replace('/login')
  else if (previous && id !== previous) void router.replace('/')
}, { flush: 'post' })
</script>
<template><NuxtLayout v-if="visible" :key="user?.id || 'anonymous'"><NuxtPage :key="user?.id || 'anonymous'" /></NuxtLayout><div v-else class="empty" role="status">Comprobando sesión…</div><ClientOnly><PwaInstallBanner /><PwaInstallHelp /></ClientOnly></template>
