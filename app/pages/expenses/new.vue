<script setup lang="ts">
const route = useRoute()
const initialTrip = typeof route.query.trip_id === 'string' ? route.query.trip_id : undefined
async function saved(tripId: string, another: boolean) { if (!another) await navigateTo(`/trips/${tripId}`) }
</script>
<template><div class="page-heading"><div><h1>Añadir gasto</h1><p class="muted">Registra un gasto sin salir de tu actividad.</p></div></div><ExpenseForm :trip-id="initialTrip" choose-trip @saved="saved" @cancel="navigateTo('/expenses')" /></template>
