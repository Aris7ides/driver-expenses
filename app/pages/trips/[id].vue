<script setup lang="ts">
import { Plus, Trash2, Pencil, ArrowLeft } from 'lucide-vue-next'
import type { Trip, Expense } from '~/types/models'
import TripForm from '~/components/TripForm.vue'
import ExpenseForm from '~/components/ExpenseForm.vue'
const route = useRoute(), db = useDb(), record = ref<Trip | null>(null), expenses = ref<Expense[]>([])
const busy = ref(true), actionBusy = ref(false), error = ref(''), editing = ref(false), expenseEditor = ref(false), currentExpense = ref<Expense | null>(null)
const tripForm = ref<InstanceType<typeof TripForm> | null>(null), expenseForm = ref<InstanceType<typeof ExpenseForm> | null>(null)
const id = computed(() => String(route.params.id))
async function load() { busy.value = true; error.value = ''; try { [record.value, expenses.value] = await Promise.all([db.trip(id.value), db.expenses(id.value)]) } catch (value) { error.value = message(value) } finally { busy.value = false } }
onMounted(load)
const total = computed(() => expensesTotal(expenses.value))
const profit = computed(() => routeProfit(record.value?.status === 'cancelado' ? 0 : record.value?.service_price || 0, expenses.value))
const outstanding = computed(() => pendingCollection(record.value ? [record.value] : [], expenses.value))
function toggleEditing() { if (editing.value && !tripForm.value?.confirmLeave()) return; editing.value = !editing.value }
function editExpense(expense: Expense | null) { if (expenseEditor.value && !expenseForm.value?.confirmLeave()) return; currentExpense.value = expense; expenseEditor.value = true }
async function savedExpense(_tripId: string, another: boolean) { expenseEditor.value = another; await load() }
async function deleteExpense(expense: Expense) { if (actionBusy.value || !confirm('¿Eliminar este gasto?')) return; actionBusy.value = true; try { await db.remove('expenses', expense.id); await load() } catch (value) { error.value = message(value) } finally { actionBusy.value = false } }
async function deleteTrip() { if (actionBusy.value || !confirm('¿Eliminar este viaje y todos sus gastos? Esta acción no se puede deshacer.')) return; actionBusy.value = true; try { await db.remove('trips', id.value); await navigateTo('/trips') } catch (value) { error.value = message(value) } finally { actionBusy.value = false } }
</script>
<template>
  <div v-if="error" class="alert danger" role="alert">{{ error }} <button class="button secondary small" @click="load">Reintentar</button></div><p v-if="busy" class="helper-text" role="status">Actualizando detalle…</p>
  <template v-if="record">
    <div class="page-heading"><div><NuxtLink class="backlink" to="/trips"><ArrowLeft :size="16" /> Volver a viajes</NuxtLink><h1>{{ record.origin }} → {{ record.destination }}</h1><p class="muted">{{ record.platform?.name || 'Sin plataforma' }} · {{ tripStatusLabel[record.status] }}</p></div><div class="heading-actions"><button class="button secondary" :disabled="busy || actionBusy" @click="toggleEditing"><Pencil :size="17" /> {{ editing ? 'Cerrar edición' : 'Editar' }}</button><button class="button danger-button" :disabled="busy || actionBusy" @click="deleteTrip"><Trash2 :size="17" /> Eliminar</button></div></div>
    <TripForm v-if="editing" ref="tripForm" :initial="record" @cancel="editing = false" @saved="async () => { editing = false; await load() }" />
    <template v-else>
      <div class="stats-grid"><div class="card stat"><span>Servicio acordado</span><strong>{{ euro(record.service_price) }}</strong></div><div class="card stat"><span>Gastos registrados</span><strong>{{ euro(total) }}</strong></div><div class="card stat"><span>{{ record.status === 'finalizado' || record.status === 'cancelado' ? 'Resultado operativo' : 'Resultado provisional' }}</span><strong :class="profit < 0 ? 'negative' : 'green'">{{ euro(profit) }}</strong></div><NuxtLink class="card stat" :to="`/collections?trip_id=${id}`"><span>Pendiente de cobrar</span><strong>{{ euro(outstanding) }}</strong><small>Registrar cobros →</small></NuxtLink></div>
      <div class="card summary-grid"><div><span class="muted">Inicio</span><b>{{ localDateTime(record.start_at).replace('T', ' ') }}</b></div><div><span class="muted">Fin</span><b>{{ record.end_at ? localDateTime(record.end_at).replace('T', ' ') : '—' }}</b></div><div><span class="muted">Kilómetros</span><b>{{ record.kilometers ?? '—' }}</b></div><div><span class="muted">Presupuesto de gastos</span><b>{{ euro(record.estimated_budget) }}</b></div><div><span class="muted">Disponible del presupuesto</span><b :class="budgetDifference(record.estimated_budget, expenses) < 0 ? 'negative' : ''">{{ euro(budgetDifference(record.estimated_budget, expenses)) }}</b></div><div><span class="muted">Servicio cobrado</span><b>{{ euro(record.service_collected) }}</b></div><div><span class="muted">Referencia</span><b>{{ record.external_reference || '—' }}</b></div><div class="wide"><span class="muted">Observaciones</span><p>{{ record.notes || 'Sin observaciones.' }}</p></div></div>
      <div class="section-heading"><h2>Gastos asociados ({{ expenses.length }})</h2><button class="button primary" @click="editExpense(null)"><Plus :size="17" /> Añadir gasto</button></div>
      <ExpenseForm v-if="expenseEditor" ref="expenseForm" :key="currentExpense?.id || 'new'" :trip-id="id" :initial="currentExpense" @cancel="expenseEditor = false" @saved="savedExpense" />
      <p v-if="!expenses.length" class="card empty">No has registrado gastos para este viaje.</p>
      <template v-else><div class="mobile-records"><ExpenseCard v-for="expense in expenses" :key="expense.id" :expense="expense"><button class="button secondary small" @click="editExpense(expense)">Editar gasto</button><button class="button danger-button small" :disabled="actionBusy" @click="deleteExpense(expense)">Eliminar</button></ExpenseCard></div><div class="card table-wrap desktop-records"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Importe</th><th>Reembolsable</th><th>Reembolsado</th><th></th></tr></thead><tbody><tr v-for="expense in expenses" :key="expense.id"><td>{{ shortDate(expense.spent_at) }}</td><td>{{ expense.description || '—' }}</td><td>{{ expense.expense_type?.name || 'Otros' }}</td><td>{{ euro(expense.amount) }}</td><td>{{ euro(expense.refundable_amount) }}</td><td>{{ euro(expense.reimbursed_amount) }}</td><td><button class="icon-button" aria-label="Editar gasto" @click="editExpense(expense)"><Pencil :size="18" /></button><button class="icon-button" aria-label="Eliminar gasto" :disabled="actionBusy" @click="deleteExpense(expense)"><Trash2 :size="18" /></button></td></tr></tbody></table></div></template>
    </template>
  </template>
</template>
