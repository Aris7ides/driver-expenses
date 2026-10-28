<script setup lang="ts">
import type { Trip, Expense } from '~/types/models'
const db = useDb(), trips = ref<Trip[]>([]), expenses = ref<Expense[]>([])
const busy = ref(true), error = ref(''), info = ref(''), platform = ref(''), search = ref('')
const route = useRoute()
const selectedTrip = ref(typeof route.query.trip_id === 'string' ? route.query.trip_id : '')
async function load() { busy.value = true; error.value = ''; try { [trips.value, expenses.value] = await Promise.all([db.trips(), db.expenses()]) } catch (value) { error.value = message(value) } finally { busy.value = false } }
onMounted(load)
const totalServices = computed(() => sumMoney(trips.value.map(servicePending)))
const totalRefunds = computed(() => pendingReimbursements(expenses.value))
const platforms = computed(() => [...new Map(trips.value.map(trip => [trip.platform_id || '', trip.platform?.name || 'Sin plataforma'])).entries()])
const expensesByTrip = computed(() => { const map = new Map<string, Expense[]>(); for (const expense of expenses.value) { const rows = map.get(expense.trip_id) || []; rows.push(expense); map.set(expense.trip_id, rows) } return map })
const rows = computed(() => trips.value.filter(trip => (!platform.value || (trip.platform_id || 'none') === platform.value) && (!selectedTrip.value || trip.id === selectedTrip.value) && `${trip.origin} ${trip.destination} ${trip.platform?.name || ''}`.toLowerCase().includes(search.value.toLowerCase())).map(trip => ({ trip, expenses: (expensesByTrip.value.get(trip.id) || []).filter(expense => refundPending(expense) > 0) })).filter(row => servicePending(row.trip) > 0 || row.expenses.length))
const groups = computed(() => { const map = new Map<string, typeof rows.value>(); for (const row of rows.value) { const key = row.trip.platform?.name || 'Sin plataforma'; const values = map.get(key) || []; values.push(row); map.set(key, values) } return [...map.entries()] })
async function saved() { info.value = 'Cobro guardado correctamente.'; await load() }
</script>
<template>
  <div class="page-heading"><div><h1>Cobros pendientes</h1><p class="muted">Servicio y reembolsos de todos los periodos.</p></div><button class="button secondary" :disabled="busy" @click="load">Actualizar</button></div>
  <div v-if="error" class="alert danger" role="alert">{{ error }} <button class="button secondary small" @click="load">Reintentar</button></div><p v-if="info" class="alert success" role="status">{{ info }}</p>
  <div class="stats-grid"><div class="card stat"><span>Servicio pendiente</span><strong>{{ euro(totalServices) }}</strong></div><div class="card stat"><span>Reembolsos pendientes</span><strong>{{ euro(totalRefunds) }}</strong></div><div class="card stat"><span>Total pendiente</span><strong>{{ euro(sumMoney([totalServices, totalRefunds])) }}</strong></div></div>
  <div class="card filters filter-grid"><label class="field">Buscar<input v-model="search" placeholder="Trayecto o plataforma" /></label><label class="field">Plataforma<select v-model="platform"><option value="">Todas</option><option v-for="[id, name] in platforms" :key="id" :value="id || 'none'">{{ name }}</option></select></label><button v-if="selectedTrip" class="button secondary" @click="selectedTrip = ''">Ver todos los viajes</button></div>
  <p v-if="busy" class="empty" role="status">Actualizando cobros…</p>
  <div v-if="!busy && !error && !rows.length" class="card empty"><h2>Sin cobros pendientes para esta selección</h2><p>Puedes cambiar los filtros o consultar tus viajes.</p></div>
  <section v-for="[name, items] in groups" :key="name" class="collection-group"><h2>{{ name }}</h2>
    <article v-for="row in items" :key="row.trip.id" class="card collection-trip">
      <div class="record-heading"><NuxtLink :to="`/trips/${row.trip.id}`"><h3>{{ row.trip.origin }} → {{ row.trip.destination }}</h3></NuxtLink><span class="pill" :class="row.trip.status">{{ tripStatusLabel[row.trip.status] }}</span></div><p class="muted">{{ shortDate(row.trip.start_at) }}</p>
      <div v-if="servicePending(row.trip) > 0" class="collection-line"><div><strong>Servicio · {{ euro(servicePending(row.trip)) }} pendientes</strong><p>{{ collectionLabel(row.trip.service_price, row.trip.service_collected) }} · Recibido {{ euro(row.trip.service_collected) }} de {{ euro(row.trip.service_price) }}</p></div><CollectionForm table="trips" :id="row.trip.id" :pending="servicePending(row.trip)" label="Importe recibido del servicio" @saved="saved" /></div>
      <div v-for="expense in row.expenses" :key="expense.id" class="collection-line"><div><strong>{{ expense.expense_type?.name || 'Reembolso' }} · {{ euro(refundPending(expense)) }} pendientes</strong><p>{{ expense.description || 'Gasto' }} · Recibido {{ euro(expense.reimbursed_amount) }} de {{ euro(expense.refundable_amount) }}</p></div><CollectionForm table="expenses" :id="expense.id" :pending="refundPending(expense)" label="Reembolso recibido" @saved="saved" /></div>
    </article>
  </section>
  <p class="footer-note">Los cobros se acumulan en cada servicio o gasto. Los servicios cancelados no generan un cobro pendiente; sus reembolsos adelantados sí se conservan.</p>
</template>
