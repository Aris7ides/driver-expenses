<script setup lang="ts">
import type { Trip } from '~/types/models'
defineProps<{ trip: Trip }>()
</script>
<template><article class="card mobile-record"><div class="record-heading"><NuxtLink :to="`/trips/${trip.id}`"><strong>{{ trip.origin }} → {{ trip.destination }}</strong></NuxtLink><span class="pill" :class="trip.status">{{ tripStatusLabel[trip.status] }}</span></div><p class="muted">{{ trip.platform?.name || 'Sin plataforma' }} · {{ shortDate(trip.start_at) }}</p><dl class="record-amounts"><div><dt>Servicio</dt><dd>{{ euro(trip.service_price) }}</dd></div><div><dt>Pendiente servicio</dt><dd>{{ euro(servicePending(trip)) }}</dd></div></dl><div class="record-actions"><NuxtLink class="button secondary small" :to="`/trips/${trip.id}`">Ver viaje</NuxtLink><NuxtLink class="button primary small" :to="`/expenses/new?trip_id=${trip.id}`">Añadir gasto</NuxtLink></div></article></template>
