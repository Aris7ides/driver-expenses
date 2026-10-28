<script setup lang="ts">
import type { Expense, ExpenseType, Trip } from '~/types/models'
import { expenseSchema } from '~/utils/validation'
const props = defineProps<{ tripId?: string; initial?: Expense | null; chooseTrip?: boolean }>()
const emit = defineEmits<{ saved: [tripId: string, another: boolean]; cancel: [] }>()
const db = useDb()
const types = ref<ExpenseType[]>([]), trips = ref<Trip[]>([])
const busy = ref(false), loading = ref(true), error = ref(''), success = ref('')
const errors = ref<Record<string, string>>({})
const selectedTrip = ref(props.tripId || props.initial?.trip_id || '')
const form = reactive({ expense_type_id: '', spent_at: localDate(), amount: 0, refundable_amount: 0, reimbursed_amount: 0, description: '', notes: '', paid_by_driver: true })
watch(() => props.initial, value => {
  if (!value) return
  Object.assign(form, { expense_type_id: value.expense_type_id || '', spent_at: value.spent_at, amount: Number(value.amount), refundable_amount: Number(value.refundable_amount), reimbursed_amount: Number(value.reimbursed_amount), description: value.description || '', notes: value.notes || '', paid_by_driver: value.paid_by_driver })
}, { immediate: true })
const refundMode = ref(form.refundable_amount === 0 ? 'none' : form.refundable_amount === form.amount ? 'full' : 'partial')
const advanced = ref(!!props.initial?.notes || Number(props.initial?.reimbursed_amount || 0) > 0)
watch([() => form.amount, refundMode], () => {
  if (refundMode.value === 'full') form.refundable_amount = Number(form.amount || 0)
  if (refundMode.value === 'none') form.refundable_amount = 0
}, { flush: 'sync' })
const { dirty, confirmLeave, markSaved } = useDirtyForm(form)
defineExpose({ dirty, confirmLeave })
const availableTypes = computed(() => types.value.filter(type => type.active || type.id === props.initial?.expense_type_id))
const orderedTrips = computed(() => [...trips.value].sort((a, b) => (a.status === 'en_curso' ? 0 : a.status === 'planificado' ? 1 : 2) - (b.status === 'en_curso' ? 0 : b.status === 'planificado' ? 1 : 2)))
async function load() {
  loading.value = true; error.value = ''
  try {
    types.value = await db.expenseTypes()
    if (props.chooseTrip) {
      trips.value = await db.trips()
      if (!selectedTrip.value) selectedTrip.value = orderedTrips.value.find(trip => trip.status === 'en_curso')?.id || ''
    }
  } catch (value) { error.value = message(value) } finally { loading.value = false }
}
onMounted(load)
async function submit(another = false) {
  if (busy.value || loading.value) return
  errors.value = {}; error.value = ''; success.value = ''
  if (!selectedTrip.value) errors.value.trip_id = 'Selecciona el viaje al que corresponde el gasto.'
  const result = expenseSchema.safeParse({ ...form, expense_type_id: form.expense_type_id || null, refundable_amount: form.paid_by_driver ? form.refundable_amount : 0, reimbursed_amount: form.paid_by_driver ? form.reimbursed_amount : 0 })
  if (!result.success) for (const issue of result.error.issues) errors.value[String(issue.path[0])] = issue.code === 'invalid_type' ? 'Introduce un valor válido.' : issue.message
  if (Object.keys(errors.value).length) { error.value = 'Revisa los campos indicados.'; return }
  if (!result.success) return
  busy.value = true
  try {
    await db.saveExpense(selectedTrip.value, result.data, props.initial?.id, props.initial?.reimbursed_amount)
    if (another && !props.initial) {
      Object.assign(form, { spent_at: localDate(), amount: 0, refundable_amount: 0, reimbursed_amount: 0, description: '', notes: '' })
      success.value = 'Gasto guardado. Puedes añadir el siguiente al mismo viaje.'
    }
    markSaved()
    emit('saved', selectedTrip.value, another && !props.initial)
  } catch (value) { error.value = typeof value === 'object' && value !== null && 'code' in value && value.code === 'PGRST116' ? 'El gasto o su reembolso han cambiado. Actualiza el viaje antes de editarlo de nuevo.' : message(value) } finally { busy.value = false }
}
function cancel() { if (confirmLeave()) { markSaved(); emit('cancel') } }
</script>
<template>
<form class="card form-card" @submit.prevent="submit()">
  <h2>{{ initial ? 'Editar gasto' : 'Nuevo gasto' }}</h2>
  <div v-if="error" class="alert danger" role="alert">{{ error }} <button v-if="loading === false && !types.length" type="button" class="text-link link-button" @click="load">Reintentar carga</button></div>
  <p v-if="success" class="alert success" role="status">{{ success }}</p>
  <p v-if="loading" role="status">Cargando opciones…</p>
  <fieldset class="form-fields" :disabled="busy || loading"><div class="form-grid">
    <label v-if="chooseTrip" class="field full-field">Viaje *<select v-model="selectedTrip" required :disabled="busy || loading"><option value="">Selecciona un viaje</option><option v-for="trip in orderedTrips" :key="trip.id" :value="trip.id">{{ tripStatusLabel[trip.status] }} · {{ trip.origin }} → {{ trip.destination }} · {{ shortDate(trip.start_at) }}</option></select><small v-if="errors.trip_id" class="field-error">{{ errors.trip_id }}</small></label>
    <label class="field">Importe (€) *<input v-model.number="form.amount" type="number" inputmode="decimal" min="0.01" step="0.01" required :aria-invalid="!!errors.amount" /><small v-if="errors.amount" class="field-error">{{ errors.amount }}</small></label>
    <label class="field">Tipo de gasto<select v-model="form.expense_type_id"><option value="">Sin categoría</option><option v-for="type in availableTypes" :key="type.id" :value="type.id">{{ type.name }}</option></select></label>
    <label class="field">Fecha *<input v-model="form.spent_at" type="date" required /><small v-if="errors.spent_at" class="field-error">{{ errors.spent_at }}</small></label>
    <label class="field">¿Quién lo pagó?<select v-model="form.paid_by_driver"><option :value="true">Yo, el conductor</option><option :value="false">La plataforma</option></select></label>
    <label v-if="form.paid_by_driver" class="field">Reembolso<select v-model="refundMode"><option value="none">No reembolsable</option><option value="full">Reembolsable completo</option><option value="partial">Reembolsable parcial</option></select></label>
    <label v-if="form.paid_by_driver && refundMode === 'partial'" class="field">Importe reembolsable (€)<input v-model.number="form.refundable_amount" type="number" inputmode="decimal" min="0" :max="form.amount" step="0.01" /><small v-if="errors.refundable_amount" class="field-error">{{ errors.refundable_amount }}</small></label>
    <label class="field full-field">Concepto<input v-model.trim="form.description" placeholder="Por ejemplo, tren de regreso" /></label>
  </div>
  <p v-if="!form.paid_by_driver" class="helper-text">El gasto se conserva en el total registrado. No supone un coste propio ni un reembolso pendiente del conductor.</p>
  <button class="link-button" type="button" :aria-expanded="advanced" @click="advanced = !advanced">{{ advanced ? 'Ocultar detalles' : 'Añadir notas o reembolso ya recibido' }}</button>
  <div v-if="advanced" class="form-grid">
    <label v-if="form.paid_by_driver" class="field">Reembolso recibido acumulado (€)<input v-model.number="form.reimbursed_amount" type="number" inputmode="decimal" min="0" :max="form.refundable_amount" step="0.01" /><small v-if="errors.reimbursed_amount" class="field-error">{{ errors.reimbursed_amount }}</small></label>
    <label class="field full-field">Notas<textarea v-model="form.notes" rows="3" /></label>
  </div>
  <p v-if="errors.reimbursed_amount && !advanced" class="field-error">{{ errors.reimbursed_amount }} Abre los detalles para revisarlo.</p>
  <div class="form-actions"><button type="button" class="button secondary" :disabled="busy" @click="cancel">Cancelar</button><button v-if="!initial" class="button secondary" type="button" :disabled="busy || loading" @click="submit(true)">Guardar y añadir otro</button><button class="button primary" type="submit" :disabled="busy || loading">{{ busy ? 'Guardando…' : 'Guardar gasto' }}</button></div></fieldset>
</form>
</template>
