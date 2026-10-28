<script setup lang="ts">
import type { Expense } from '~/types/models'
defineProps<{ expense: Expense }>()
defineEmits<{ edit: []; remove: [] }>()
</script>
<template><article class="card mobile-record"><div class="record-heading"><strong>{{ expense.description || expense.expense_type?.name || 'Gasto' }}</strong><strong>{{ euro(expense.amount) }}</strong></div><p class="muted">{{ expense.expense_type?.name || 'Sin categoría' }} · {{ shortDate(expense.spent_at) }}</p><p v-if="expense.trip" class="record-route">{{ expense.trip.origin }} → {{ expense.trip.destination }}</p><p>{{ expense.paid_by_driver ? `Reembolso pendiente: ${euro(refundPending(expense))}` : 'Pagado por la plataforma' }}</p><div class="record-actions"><slot><NuxtLink class="button secondary small" :to="`/trips/${expense.trip_id}`">Ver viaje</NuxtLink></slot></div></article></template>
