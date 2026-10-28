<script setup lang="ts">
import { Plus, ArrowRight } from 'lucide-vue-next'
import type { Trip, Expense } from '~/types/models'
const db = useDb(), trips = ref<Trip[]>([]), expenses = ref<Expense[]>([]), error = ref(''), busy = ref(true)
const month = ref(localDate().slice(0, 7))
async function load() { busy.value = true; error.value = ''; try { [trips.value, expenses.value] = await Promise.all([db.trips(), db.expenses()]) } catch (value) { error.value = message(value) } finally { busy.value = false } }
onMounted(load)
const summary = computed(() => monthlySummary(trips.value, expenses.value, month.value))
const categories = computed(() => {
  const groups = new Map<string, Expense[]>()
  for (const expense of summary.value.monthExpenses) { const name = expense.expense_type?.name || 'Sin categoría'; const rows = groups.get(name) || []; rows.push(expense); groups.set(name, rows) }
  return [...groups].map(([name, values]) => ({ name, amount: expensesTotal(values) })).sort((a, b) => b.amount - a.amount).slice(0, 6)
})
</script>
<template>
  <div class="page-heading"><div><h1>Tu actividad</h1><p class="muted">Resultados realizados, previsión y dinero pendiente.</p></div><label class="month-label">Mes<input v-model="month" type="month" /></label></div>
  <div class="quick-actions"><NuxtLink class="button primary" to="/expenses/new"><Plus :size="18" /> Añadir gasto</NuxtLink><NuxtLink class="button secondary" to="/trips/new">Nuevo viaje</NuxtLink><NuxtLink class="button secondary" to="/collections">Ver cobros</NuxtLink></div>
  <div v-if="error" class="alert danger" role="alert">{{ error }} <button class="button secondary small" @click="load">Reintentar</button></div><p v-if="busy" class="empty" role="status">Actualizando resumen…</p>
  <template v-if="!busy && !error">
    <div class="stats-grid"><div class="card stat"><span>Servicios finalizados del mes</span><strong>{{ euro(summary.income) }}</strong><small>{{ summary.completed.length }} viajes finalizados</small></div><div class="card stat"><span>Resultado de viajes cerrados</span><strong :class="summary.profit < 0 ? 'negative' : 'green'">{{ euro(summary.profit) }}</strong><small>Incluye costes propios de cancelaciones</small></div><div class="card stat"><span>Gastos registrados del mes</span><strong>{{ euro(summary.spending) }}</strong><small>Todos los estados y pagadores</small></div><NuxtLink class="card stat" to="/collections"><span>Pendiente de cobrar global</span><strong>{{ euro(summary.outstanding) }}</strong><small>Todos los periodos · Ver cobros →</small></NuxtLink></div>
    <section class="card forecast-panel"><h2>Previsión del mes</h2><div class="summary-strip"><span>Servicios planificados o en curso: <strong>{{ euro(summary.forecastServices) }}</strong></span><span>Presupuesto de esos viajes: <strong>{{ euro(summary.forecastBudget) }}</strong></span></div><p class="helper-text">Estos servicios aún no se incluyen en el resultado de viajes cerrados. El presupuesto es gasto previsto, sin distinguir la parte reembolsable.</p></section>
    <div class="dashboard-grid"><section class="card panel"><h2>Gastos por categoría</h2><p v-if="!categories.length" class="empty compact">Sin gastos asociados a viajes de este mes.</p><div v-for="category in categories" :key="category.name" class="bar-line"><span>{{ category.name }}</span><strong>{{ euro(category.amount) }}</strong><div class="bar-track"><div class="bar-fill" :style="{ width: `${summary.spending ? category.amount / summary.spending * 100 : 0}%`, background: '#2469ed' }" /></div></div></section><section class="card panel"><div class="panel-header"><h2>Viajes del mes</h2><NuxtLink class="text-link" to="/trips">Ver todos <ArrowRight :size="15" /></NuxtLink></div><p v-if="!summary.monthTrips.length" class="empty compact">Aún no hay viajes de este mes.</p><NuxtLink v-for="trip in summary.monthTrips.slice(0, 6)" :key="trip.id" class="recent-row" :to="`/trips/${trip.id}`"><span class="recent-label"><b>{{ trip.origin }} → {{ trip.destination }}</b><small>{{ trip.platform?.name || 'Sin plataforma' }} · {{ shortDate(trip.start_at) }}</small></span><span class="pill" :class="trip.status">{{ tripStatusLabel[trip.status] }}</span></NuxtLink></section></div>
    <p class="footer-note">El mes se asigna por el inicio local del viaje. El resultado usa los servicios finalizados y resta sus gastos propios y los de viajes cancelados del mes. No incluye impuestos ni costes generales. Los reembolsos de viajes cancelados permanecen en cobros pendientes.</p>
  </template>
</template>
