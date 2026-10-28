<script setup lang="ts">
import type { Platform, Trip, TripStatus } from '~/types/models'
import { tripSchema } from '~/utils/validation'
const props = defineProps<{ initial?: Trip | null }>()
const emit = defineEmits<{ saved: [id: string]; cancel: [] }>()
const db = useDb(), options = ref<Platform[]>([]), busy = ref(false), error = ref(''), details = ref(false)
const errors = ref<Record<string, string>>({})
const form = reactive({ platform_id: '', origin: '', destination: '', start_at: localDateTime(), end_at: '', status: 'planificado' as TripStatus, estimated_budget: 0, service_price: 0, service_collected: 0, kilometers: null as number | null, external_reference: '', notes: '' })
watch(() => props.initial, value => {
  if (!value) return
  Object.assign(form, { platform_id: value.platform_id || '', origin: value.origin, destination: value.destination, start_at: localDateTime(value.start_at), end_at: value.end_at ? localDateTime(value.end_at) : '', status: value.status, estimated_budget: Number(value.estimated_budget), service_price: Number(value.service_price), service_collected: Number(value.service_collected), kilometers: value.kilometers, external_reference: value.external_reference || '', notes: value.notes || '' })
  details.value = !!(value.kilometers || value.external_reference || value.notes)
}, { immediate: true })
const { dirty, confirmLeave, markSaved } = useDirtyForm(form)
defineExpose({ dirty, confirmLeave })
const availablePlatforms = computed(() => options.value.filter(platform => platform.active || platform.id === props.initial?.platform_id))
onMounted(async () => { try { options.value = await db.platforms() } catch (value) { error.value = message(value) } })
async function submit() {
  if (busy.value) return
  errors.value = {}; error.value = ''
  try {
    const values = { ...form, platform_id: form.platform_id || null, start_at: form.start_at ? new Date(form.start_at).toISOString() : '', end_at: form.end_at ? new Date(form.end_at).toISOString() : null, external_reference: form.external_reference || null, notes: form.notes || null, kilometers: form.kilometers === null || String(form.kilometers) === '' ? null : Number(form.kilometers) }
    const result = tripSchema.safeParse(values)
    if (!result.success) { for (const issue of result.error.issues) errors.value[String(issue.path[0])] = issue.code === 'invalid_type' ? 'Introduce un valor válido.' : issue.message; error.value = 'Revisa los campos indicados.'; return }
    busy.value = true
    const id = await db.saveTrip(result.data, props.initial?.id, props.initial?.service_collected)
    markSaved(); emit('saved', id)
  } catch (value) { error.value = typeof value === 'object' && value !== null && 'code' in value && value.code === 'PGRST116' ? 'El viaje o sus cobros han cambiado. Cierra la edición, actualiza y revisa los importes.' : message(value) } finally { busy.value = false }
}
function cancel() { if (confirmLeave()) { markSaved(); emit('cancel') } }
</script>
<template><form class="card form-card" @submit.prevent="submit">
  <div v-if="error" class="alert danger" role="alert">{{ error }}</div>
  <fieldset class="form-fields" :disabled="busy"><legend class="section-title">Trayecto y fechas</legend>
  <div class="form-grid"><label class="field">Origen *<input v-model.trim="form.origin" required placeholder="Valencia" :aria-invalid="!!errors.origin" /><small v-if="errors.origin" class="field-error">{{ errors.origin }}</small></label><label class="field">Destino *<input v-model.trim="form.destination" required placeholder="Madrid" :aria-invalid="!!errors.destination" /><small v-if="errors.destination" class="field-error">{{ errors.destination }}</small></label><label class="field">Plataforma<select v-model="form.platform_id"><option value="">Sin plataforma</option><option v-for="platform in availablePlatforms" :key="platform.id" :value="platform.id">{{ platform.name }}</option></select></label><label class="field">Inicio *<input v-model="form.start_at" required type="datetime-local" /><small v-if="errors.start_at" class="field-error">{{ errors.start_at }}</small></label><label class="field">Fin<input v-model="form.end_at" type="datetime-local" /><small v-if="errors.end_at" class="field-error">{{ errors.end_at }}</small></label><label class="field">Estado<select v-model="form.status"><option v-for="(label, key) in tripStatusLabel" :key="key" :value="key">{{ label }}</option></select></label></div>
  <h2 class="section-title">Importes</h2><div class="form-grid"><label class="field">Precio del servicio (€) *<input v-model.number="form.service_price" required type="number" inputmode="decimal" min="0" step="0.01" /><small v-if="errors.service_price" class="field-error">{{ errors.service_price }}</small></label><label class="field">Presupuesto de gastos (€)<input v-model.number="form.estimated_budget" type="number" inputmode="decimal" min="0" step="0.01" /><small v-if="errors.estimated_budget" class="field-error">{{ errors.estimated_budget }}</small></label><label class="field">Servicio cobrado acumulado (€)<input v-model.number="form.service_collected" type="number" inputmode="decimal" min="0" :max="form.service_price" step="0.01" /><small v-if="errors.service_collected" class="field-error">{{ errors.service_collected }}</small></label></div>
  <button class="link-button" type="button" :aria-expanded="details" @click="details = !details">{{ details ? 'Ocultar detalles opcionales' : 'Añadir kilómetros, referencia u observaciones' }}</button><div v-if="details" class="form-grid"><label class="field">Kilómetros de traslado<input v-model.number="form.kilometers" type="number" inputmode="numeric" min="0" step="1" /><small v-if="errors.kilometers" class="field-error">{{ errors.kilometers }}</small></label><label class="field">Referencia externa<input v-model.trim="form.external_reference" /></label><label class="field full-field">Observaciones<textarea v-model="form.notes" rows="3" /></label></div>
  <div class="form-actions"><button type="button" class="button secondary" @click="cancel">Cancelar</button><button class="button primary" type="submit">{{ busy ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear viaje' }}</button></div></fieldset>
</form></template>
