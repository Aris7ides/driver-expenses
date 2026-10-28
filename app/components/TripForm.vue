<script setup lang="ts">
import type { Platform, Trip, TripStatus } from '~/types/models'
const props = defineProps<{ initial?: Trip | null }>()
const emit = defineEmits<{ saved: [id: string] }>()
const db = useDb()
const options = ref<Platform[]>([])
const busy = ref(false), error = ref('')
const form = reactive({ platform_id: '', origin: '', destination: '', start_at: localDateTime(), end_at: '', status: 'planificado' as TripStatus, estimated_budget: 0, service_price: 0, service_collected: 0, kilometers: null as number | null, external_reference: '', notes: '' })
watch(() => props.initial, v => {
  if (!v) return
  Object.assign(form, {
    platform_id: v.platform_id || '', origin: v.origin, destination: v.destination,
    start_at: localDateTime(v.start_at), end_at: v.end_at ? localDateTime(v.end_at) : '',
    status: v.status, estimated_budget: Number(v.estimated_budget), service_price: Number(v.service_price),
    service_collected: Number(v.service_collected), kilometers: v.kilometers,
    external_reference: v.external_reference || '', notes: v.notes || '',
  })
}, { immediate: true })
const availablePlatforms = computed(() => options.value.filter(p => p.active || p.id === props.initial?.platform_id))
onMounted(async () => { try { options.value = await db.platforms() } catch (e) { error.value = message(e) } })
async function submit() {
  error.value = ''
  if (form.end_at && new Date(form.end_at) < new Date(form.start_at)) { error.value = 'La fecha de fin no puede ser anterior al inicio.'; return }
  if (form.service_collected > form.service_price) { error.value = 'El importe cobrado no puede superar el precio del servicio.'; return }
  busy.value = true
  try {
    const data = { ...form, platform_id: form.platform_id || null, start_at: new Date(form.start_at).toISOString(), end_at: form.end_at ? new Date(form.end_at).toISOString() : null, external_reference: form.external_reference || null, notes: form.notes || null, kilometers: form.kilometers === null || String(form.kilometers) === '' ? null : Number(form.kilometers) }
    emit('saved', await db.saveTrip(data, props.initial?.id))
  } catch (e) { error.value = message(e) } finally { busy.value = false }
}
</script>
<template><form class="card form-card" @submit.prevent="submit">
  <div v-if="error" class="alert danger">{{ error }}</div>
  <div class="section-title">Información principal</div>
  <div class="form-grid"><label class="field">Origen *<input v-model.trim="form.origin" required placeholder="Valencia" /></label><label class="field">Destino *<input v-model.trim="form.destination" required placeholder="Madrid" /></label><label class="field">Plataforma<select v-model="form.platform_id"><option value="">Sin plataforma</option><option v-for="p in availablePlatforms" :key="p.id" :value="p.id">{{ p.name }}</option></select></label>
  <label class="field">Fecha y hora de inicio *<input v-model="form.start_at" required type="datetime-local" /></label><label class="field">Fecha y hora de fin<input v-model="form.end_at" type="datetime-local" /></label><label class="field">Estado<select v-model="form.status"><option value="planificado">Planificado</option><option value="en_curso">En curso</option><option value="finalizado">Finalizado</option><option value="cancelado">Cancelado</option></select></label>
  <label class="field">Precio del servicio (€) *<input v-model.number="form.service_price" required type="number" min="0" step="0.01" /></label><label class="field">Presupuesto de gastos (€)<input v-model.number="form.estimated_budget" type="number" min="0" step="0.01" /></label><label class="field">Kilómetros de traslado<input v-model.number="form.kilometers" type="number" min="0" step="1" /></label><label class="field">Importe del servicio ya cobrado (€)<input v-model.number="form.service_collected" type="number" min="0" step="0.01" /></label><label class="field">Referencia externa<input v-model.trim="form.external_reference" placeholder="Referencia de la plataforma" /></label></div>
  <label class="field">Observaciones<textarea v-model="form.notes" rows="3" placeholder="Información adicional del traslado"></textarea></label>
  <div class="form-actions"><NuxtLink to="/trips" class="button secondary">Cancelar</NuxtLink><button class="button primary" :disabled="busy" type="submit">{{ busy ? 'Guardando...' : props.initial ? 'Guardar cambios' : 'Crear viaje' }}</button></div>
</form></template>
