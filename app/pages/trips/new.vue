<script setup lang="ts">
import TripForm from '~/components/TripForm.vue'
</script>
<template><div class="page-heading"><div><NuxtLink to="/trips" class="backlink">← Volver a viajes</NuxtLink><h1>Nuevo viaje</h1><p class="muted">Registra un nuevo traslado de vehículo.</p></div></div><TripForm @saved="id => navigateTo(`/trips/${id}`)" @cancel="navigateTo('/trips')" /></template>
