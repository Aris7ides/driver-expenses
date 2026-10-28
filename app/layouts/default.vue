<script setup lang="ts">
import { LayoutDashboard, Route, Receipt, Settings, LogOut, Menu, X, Plus } from 'lucide-vue-next'
const { user, logout } = useSession()
const opened = ref(false)
const links = [{ to: '/', label: 'Inicio', icon: LayoutDashboard }, { to: '/trips', label: 'Viajes', icon: Route }, { to: '/expenses', label: 'Gastos', icon: Receipt }, { to: '/settings', label: 'Ajustes', icon: Settings }]
const route = useRoute()
watch(() => route.path, () => { opened.value = false })
</script>
<template>
  <div class="shell">
    <aside class="sidebar" :class="{ 'is-open': opened }">
      <div class="brand"><div class="brand-icon">M</div><div><strong>MiRuta</strong><small>Viajes y gastos</small></div><button class="mobile-close" @click="opened = false"><X :size="22" /></button></div>
      <nav class="nav"><NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="nav-item"><component :is="link.icon" :size="19" />{{ link.label }}</NuxtLink></nav>
      <div class="sidebar-bottom"><div class="avatar">{{ (user?.email || 'U').slice(0, 1).toUpperCase() }}</div><div class="identity"><b>Mi cuenta</b><small>{{ user?.email }}</small></div><button class="icon-button" title="Cerrar sesión" @click="logout"><LogOut :size="18" /></button></div>
    </aside>
    <div v-if="opened" class="mobile-overlay" @click="opened = false"></div>
    <main class="workspace"><header class="topbar"><button class="icon-button menu-button" @click="opened = true"><Menu :size="22" /></button><span class="topbar-brand">MiRuta</span><div class="topbar-actions"><NuxtLink to="/trips/new" class="button primary small"><Plus :size="17" /> Nuevo viaje</NuxtLink></div></header><div class="content"><slot /></div></main>
    <nav class="bottom-nav"><NuxtLink v-for="link in links" :key="link.to" :to="link.to"><component :is="link.icon" :size="20" /><span>{{ link.label }}</span></NuxtLink></nav>
  </div>
</template>
