<script setup lang="ts">
const props = defineProps<{ table: 'trips' | 'expenses'; id: string; pending: number; label: string }>()
const emit = defineEmits<{ saved: [] }>()
const db = useDb()
const expanded = ref(false), busy = ref(false), amount = ref(0), error = ref('')
function open() { amount.value = props.pending; expanded.value = true; error.value = '' }
async function submit(value = amount.value) {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { await db.collect(props.table, props.id, value); expanded.value = false; emit('saved') }
  catch (value) { error.value = message(value) } finally { busy.value = false }
}
</script>
<template><div class="collection-form"><p v-if="error" class="alert danger" role="alert">{{ error }}</p><template v-if="pending > 0"><div v-if="!expanded" class="record-actions"><button class="button secondary small" :disabled="busy" @click="open">Registrar cobro</button><button class="button primary small" :disabled="busy" @click="submit(pending)">{{ busy ? 'Guardando…' : 'Cobrar todo' }}</button></div><form v-else class="inline-form collection-input" @submit.prevent="submit()"><label class="field">{{ label }} (€)<input v-model.number="amount" type="number" inputmode="decimal" required min="0.01" :max="pending" step="0.01" /></label><button class="button primary" :disabled="busy" type="submit">Guardar cobro</button><button class="button secondary" :disabled="busy" type="button" @click="expanded = false">Cancelar</button></form></template><span v-else class="pill finalizado">Cobrado</span></div></template>
