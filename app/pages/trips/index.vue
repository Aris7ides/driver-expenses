<script setup lang="ts">
import { Plus, Search, Route } from 'lucide-vue-next'
import type { Trip } from '~/types/models'
const db = useDb(), items = ref<Trip[]>([]), busy = ref(true), error = ref(''), search = ref(''), status = ref('')
const filtered = computed(() => items.value.filter(t => (!status.value || t.status === status.value) && `${t.origin} ${t.destination} ${t.platform?.name || ''}`.toLowerCase().includes(search.value.toLowerCase())))
onMounted(async () => { try { items.value = await db.trips() } catch(e) { error.value = message(e) } finally { busy.value = false } })
const labels: Record<string,string> = { planificado: 'Planificado', en_curso: 'En curso', finalizado: 'Finalizado', cancelado: 'Cancelado' }
</script>
<template><div class="page-heading"><div><h1>Viajes</h1><p class="muted">Gestiona todos tus traslados.</p></div><NuxtLink to="/trips/new" class="button primary"><Plus :size="18"/> Nuevo viaje</NuxtLink></div>
<div class="card filters"><div class="searchbox"><Search :size="18"/><input v-model="search" placeholder="Buscar origen, destino o plataforma..." /></div><select v-model="status" class="filter-select"><option value="">Todos los estados</option><option v-for="(label,key) in labels" :key="key" :value="key">{{label}}</option></select></div>
<div v-if="error" class="alert danger">{{error}}</div><div v-if="busy" class="empty">Cargando viajes...</div><div v-else-if="!filtered.length" class="card empty"><Route :size="32"/><h3>No hay viajes</h3><p>Registra tu primer viaje para empezar.</p><NuxtLink to="/trips/new" class="button primary">Crear viaje</NuxtLink></div>
<div v-else class="card table-wrap"><table><thead><tr><th>Trayecto</th><th>Plataforma</th><th>Fecha</th><th>Precio</th><th>Cobrado</th><th>Estado</th><th></th></tr></thead><tbody><tr v-for="t in filtered" :key="t.id"><td><b>{{t.origin}} → {{t.destination}}</b></td><td>{{t.platform?.name || '—'}}</td><td>{{shortDate(t.start_at)}}</td><td>{{euro(t.service_price)}}</td><td>{{euro(t.service_collected)}}</td><td><span class="pill" :class="t.status">{{labels[t.status]}}</span></td><td><NuxtLink :to="`/trips/${t.id}`" class="text-link">Ver detalle →</NuxtLink></td></tr></tbody></table></div>
</template>
