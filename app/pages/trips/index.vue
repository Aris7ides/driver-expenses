<script setup lang="ts">
import { Plus, Download } from 'lucide-vue-next'
import type { Trip, Platform } from '~/types/models'
import { downloadCsv } from '~/utils/csv'
const db = useDb(), items = ref<Trip[]>([]), platforms = ref<Platform[]>([])
const busy = ref(true), error = ref(''), search = ref(''), page = ref(1)
const filters = reactive({ from: '', to: '', platformId: '', status: '' })
let request = 0
async function load() {
  const current = ++request; busy.value = true; error.value = ''
  if (filters.from && filters.to && filters.to < filters.from) { error.value = 'La fecha final no puede ser anterior al inicio.'; busy.value = false; return }
  try { const result = await db.trips({ ...filters }); if (current === request) { items.value = result; page.value = 1 } } catch (value) { if (current === request) error.value = message(value) } finally { if (current === request) busy.value = false }
}
onMounted(async () => { await load(); try { platforms.value = await db.platforms() } catch (value) { error.value = message(value) } })
const filtered = computed(() => items.value.filter(trip => `${trip.origin} ${trip.destination} ${trip.external_reference || ''} ${trip.platform?.name || ''}`.toLowerCase().includes(search.value.toLowerCase())))
const visible = computed(() => filtered.value.slice((page.value - 1) * 25, page.value * 25))
watch(search, () => { page.value = 1 })
function clear() { Object.assign(filters, { from: '', to: '', platformId: '', status: '' }); search.value = ''; void load() }
function exportData() { downloadCsv('miruta-viajes.csv', [['Origen', 'Destino', 'Plataforma', 'Inicio local', 'Estado', 'Servicio EUR', 'Cobrado EUR', 'Pendiente servicio EUR', 'Presupuesto EUR', 'Kilómetros', 'Referencia'], ...filtered.value.map(trip => [trip.origin, trip.destination, trip.platform?.name, localDateTime(trip.start_at), tripStatusLabel[trip.status], trip.service_price, trip.service_collected, servicePending(trip), trip.estimated_budget, trip.kilometers, trip.external_reference])]) }
</script>
<template>
  <div class="page-heading"><div><h1>Viajes</h1><p class="muted">Tus traslados, importes y estados.</p></div><div class="heading-actions"><button class="button secondary" :disabled="busy || !!error || !filtered.length" @click="exportData"><Download :size="17" /> CSV</button><NuxtLink class="button primary" to="/trips/new"><Plus :size="17" /> Nuevo viaje</NuxtLink></div></div>
  <form class="card filters filter-grid" @submit.prevent="load"><label class="field">Desde<input v-model="filters.from" type="date" /></label><label class="field">Hasta<input v-model="filters.to" type="date" /></label><label class="field">Plataforma<select v-model="filters.platformId"><option value="">Todas</option><option v-for="platform in platforms" :key="platform.id" :value="platform.id">{{ platform.name }}</option></select></label><label class="field">Estado<select v-model="filters.status"><option value="">Todos</option><option v-for="(label, key) in tripStatusLabel" :key="key" :value="key">{{ label }}</option></select></label><div class="filter-actions"><button class="button primary" type="submit" :disabled="busy">Aplicar</button><button class="button secondary" type="button" @click="clear">Limpiar</button></div></form>
  <label class="field search-field">Buscar en los resultados<input v-model="search" type="search" placeholder="Origen, destino, plataforma o referencia" /></label>
  <div v-if="error" class="alert danger" role="alert">{{ error }} <button class="button secondary small" @click="load">Reintentar</button></div>
  <p v-if="busy" class="empty" role="status">Cargando viajes…</p>
  <div v-else-if="!error && !filtered.length" class="card empty"><h2>{{ search || filters.from || filters.to || filters.platformId || filters.status ? 'Sin resultados para estos filtros' : 'Todavía no tienes viajes' }}</h2><p>Crea un viaje o cambia la selección.</p><NuxtLink class="button primary" to="/trips/new">Crear viaje</NuxtLink></div>
  <template v-if="!busy && filtered.length"><div class="mobile-records"><TripCard v-for="trip in visible" :key="trip.id" :trip="trip" /></div><div class="card table-wrap desktop-records"><table><thead><tr><th>Trayecto</th><th>Plataforma</th><th>Fecha</th><th>Servicio</th><th>Cobrado</th><th>Estado</th><th></th></tr></thead><tbody><tr v-for="trip in visible" :key="trip.id"><td>{{ trip.origin }} → {{ trip.destination }}</td><td>{{ trip.platform?.name || '—' }}</td><td>{{ shortDate(trip.start_at) }}</td><td>{{ euro(trip.service_price) }}</td><td>{{ euro(trip.service_collected) }}</td><td><span class="pill" :class="trip.status">{{ tripStatusLabel[trip.status] }}</span></td><td><NuxtLink class="text-link" :to="`/trips/${trip.id}`">Ver viaje</NuxtLink></td></tr></tbody></table></div><ListPager v-model="page" :total="filtered.length" /></template>
</template>
