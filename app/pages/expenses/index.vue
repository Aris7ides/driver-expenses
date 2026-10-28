<script setup lang="ts">
import { Plus, Download } from 'lucide-vue-next'
import type { Expense, ExpenseType } from '~/types/models'
import { downloadCsv } from '~/utils/csv'
const db = useDb(), items = ref<Expense[]>([]), types = ref<ExpenseType[]>([])
const busy = ref(true), error = ref(''), search = ref(''), refund = ref(''), page = ref(1)
const filters = reactive({ from: '', to: '', typeId: '' })
let request = 0
async function load() {
  const current = ++request; busy.value = true; error.value = ''
  if (filters.from && filters.to && filters.to < filters.from) { error.value = 'Revisa el intervalo de fechas.'; busy.value = false; return }
  try { const data = await db.expenses(undefined, { ...filters }); if (current === request) { items.value = data; page.value = 1 } } catch (value) { if (current === request) error.value = message(value) } finally { if (current === request) busy.value = false }
}
onMounted(async () => { await load(); try { types.value = await db.expenseTypes() } catch (value) { error.value = message(value) } })
const filtered = computed(() => items.value.filter(expense => `${expense.description || ''} ${expense.expense_type?.name || ''} ${expense.trip?.origin || ''} ${expense.trip?.destination || ''}`.toLowerCase().includes(search.value.toLowerCase()) && (!refund.value || (refund.value === 'pending' ? refundPending(expense) > 0 : expense.paid_by_driver && Number(expense.refundable_amount) > 0 && refundPending(expense) === 0))))
const visible = computed(() => filtered.value.slice((page.value - 1) * 25, page.value * 25))
watch([search, refund], () => { page.value = 1 })
function clear() { Object.assign(filters, { from: '', to: '', typeId: '' }); search.value = ''; refund.value = ''; void load() }
function exportData() { downloadCsv('miruta-gastos.csv', [['Fecha', 'Origen', 'Destino', 'Categoría', 'Concepto', 'Importe EUR', 'Reembolsable EUR', 'Reembolsado EUR', 'Pendiente EUR', 'Pagado por'], ...filtered.value.map(expense => [expense.spent_at, expense.trip?.origin, expense.trip?.destination, expense.expense_type?.name, expense.description, expense.amount, expense.refundable_amount, expense.reimbursed_amount, refundPending(expense), expense.paid_by_driver ? 'Conductor' : 'Plataforma'])]) }
</script>
<template>
  <div class="page-heading"><div><h1>Gastos</h1><p class="muted">Consulta tus gastos por fecha, categoría y reembolso.</p></div><div class="heading-actions"><button class="button secondary" :disabled="busy || !!error || !filtered.length" @click="exportData"><Download :size="17" /> CSV</button><NuxtLink class="button primary" to="/expenses/new"><Plus :size="17" /> Añadir gasto</NuxtLink></div></div>
  <form class="card filters filter-grid" @submit.prevent="load"><label class="field">Desde<input v-model="filters.from" type="date" /></label><label class="field">Hasta<input v-model="filters.to" type="date" /></label><label class="field">Categoría<select v-model="filters.typeId"><option value="">Todas</option><option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option></select></label><div class="filter-actions"><button class="button primary" type="submit" :disabled="busy">Aplicar</button><button class="button secondary" type="button" @click="clear">Limpiar</button></div></form>
  <div class="filter-grid secondary-filters"><label class="field">Buscar<input v-model="search" type="search" placeholder="Concepto, trayecto o categoría" /></label><label class="field">Reembolso<select v-model="refund"><option value="">Todos</option><option value="pending">Pendiente</option><option value="collected">Recibido completo</option></select></label></div>
  <div v-if="error" class="alert danger" role="alert">{{ error }} <button class="button secondary small" @click="load">Reintentar</button></div><p v-if="busy" class="empty" role="status">Cargando gastos…</p>
  <template v-else-if="!error"><div class="summary-strip"><span>{{ filtered.length }} gastos</span><strong>Total {{ euro(expensesTotal(filtered)) }}</strong><span>Reembolso pendiente {{ euro(pendingReimbursements(filtered)) }}</span></div><div v-if="!filtered.length" class="card empty"><h2>Sin gastos para esta selección</h2><p>Añade un gasto o cambia los filtros.</p></div><template v-else><div class="mobile-records"><ExpenseCard v-for="expense in visible" :key="expense.id" :expense="expense" /></div><div class="card table-wrap desktop-records"><table><thead><tr><th>Fecha</th><th>Viaje</th><th>Tipo</th><th>Concepto</th><th>Importe</th><th>Reembolso pendiente</th><th></th></tr></thead><tbody><tr v-for="expense in visible" :key="expense.id"><td>{{ shortDate(expense.spent_at) }}</td><td>{{ expense.trip?.origin }} → {{ expense.trip?.destination }}</td><td>{{ expense.expense_type?.name || 'Otros' }}</td><td>{{ expense.description || '—' }}</td><td>{{ euro(expense.amount) }}</td><td>{{ euro(refundPending(expense)) }}</td><td><NuxtLink class="text-link" :to="`/trips/${expense.trip_id}`">Ver viaje</NuxtLink></td></tr></tbody></table></div><ListPager v-model="page" :total="filtered.length" /></template></template>
</template>
