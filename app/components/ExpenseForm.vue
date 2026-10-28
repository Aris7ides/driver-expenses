<script setup lang="ts">
import type { Expense, ExpenseType } from '~/types/models'
const props = defineProps<{ tripId: string; initial?: Expense | null }>()
const emit = defineEmits<{ saved: [] , cancel: [] }>()
const db = useDb(), types = ref<ExpenseType[]>([]), busy = ref(false), error = ref('')
const form = reactive({ expense_type_id: '', spent_at: localDate(), amount: 0, refundable_amount: 0, reimbursed_amount: 0, description: '', notes: '', paid_by_driver: true })
watch(() => props.initial, v => {
  if (!v) return
  Object.assign(form, {
    expense_type_id: v.expense_type_id || '', spent_at: v.spent_at,
    amount: Number(v.amount), refundable_amount: Number(v.refundable_amount), reimbursed_amount: Number(v.reimbursed_amount),
    description: v.description || '', notes: v.notes || '', paid_by_driver: v.paid_by_driver,
  })
}, { immediate: true })
const availableTypes = computed(() => types.value.filter(t => t.active || t.id === props.initial?.expense_type_id))
onMounted(async () => { try { types.value = await db.expenseTypes() } catch (e) { error.value = message(e) } })
async function submit() {
  error.value = ''
  if (form.refundable_amount > form.amount || form.reimbursed_amount > form.refundable_amount) { error.value = 'El reembolso debe estar entre 0 y el importe del gasto; lo cobrado no puede superar lo reembolsable.'; return }
  busy.value = true
  try { await db.saveExpense(props.tripId, { ...form, expense_type_id: form.expense_type_id || null }, props.initial?.id); emit('saved') } catch (e) { error.value = message(e) } finally { busy.value = false }
}
</script>
<template><form class="card form-card" @submit.prevent="submit"><h3>{{ initial ? 'Editar gasto' : 'Nuevo gasto' }}</h3><div v-if="error" class="alert danger">{{error}}</div>
<div class="form-grid"><label class="field">Tipo de gasto<select v-model="form.expense_type_id"><option value="">Sin categoría</option><option v-for="t in availableTypes" :key="t.id" :value="t.id">{{t.name}}</option></select></label><label class="field">Importe (€) *<input v-model.number="form.amount" required type="number" min="0.01" step="0.01" /></label><label class="field">Fecha *<input v-model="form.spent_at" required type="date" /></label><label class="field">Concepto<input v-model.trim="form.description" placeholder="Descripción breve" /></label><label class="field">Importe reembolsable (€)<input v-model.number="form.refundable_amount" type="number" min="0" step="0.01" /></label><label class="field">Reembolso ya recibido (€)<input v-model.number="form.reimbursed_amount" type="number" min="0" step="0.01" /></label></div>
<label class="checkline"><input v-model="form.paid_by_driver" type="checkbox" /> Gasto adelantado por el conductor</label><label class="field">Notas<textarea v-model="form.notes" rows="3" placeholder="Detalles adicionales"></textarea></label>
<div class="form-actions"><button type="button" class="button secondary" @click="emit('cancel')">Cancelar</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? 'Guardando...' : 'Guardar gasto' }}</button></div></form></template>
