<script setup lang="ts">
const props = defineProps<{ modelValue: number; total: number; size?: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const pages = computed(() => Math.max(1, Math.ceil(props.total / (props.size || 25))))
watch(pages, value => { if (props.modelValue > value) emit('update:modelValue', value) })
</script>
<template><nav v-if="total" class="list-pager" aria-label="Paginación"><button class="button secondary small" :disabled="modelValue <= 1" @click="emit('update:modelValue', modelValue - 1)">Anterior</button><span>Página {{ modelValue }} de {{ pages }} · {{ total }} resultados</span><button class="button secondary small" :disabled="modelValue >= pages" @click="emit('update:modelValue', modelValue + 1)">Siguiente</button></nav></template>
