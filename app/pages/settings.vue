<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import type { Platform, ExpenseType } from '~/types/models'
const { $supabase } = useNuxtApp(), db = useDb()
const platforms = ref<Platform[]>([]), categories = ref<ExpenseType[]>([]), newPlatform = ref(''), newCategory = ref(''), error = ref(''), info = ref(''), busy = ref(false)
async function load() { try { [platforms.value, categories.value] = await Promise.all([db.platforms(),db.expenseTypes()]) } catch(e) { error.value = message(e) } }
onMounted(load)
async function add(kind: 'platforms'|'expense_types') {
  const name = (kind === 'platforms' ? newPlatform.value : newCategory.value).trim(); if (!name) return
  error.value = ''; busy.value = true
  try { const user_id = await db.own(); const {error: err} = await $supabase.from(kind).insert({user_id,name}); if(err) throw err; if(kind==='platforms') newPlatform.value=''; else newCategory.value=''; await load() } catch(e) {error.value=message(e)} finally {busy.value=false}
}
async function toggle(kind: 'platforms'|'expense_types', item: Platform|ExpenseType) {
  error.value = ''; const {error:err} = await $supabase.from(kind).update({active:!item.active}).eq('id',item.id).eq('user_id',await db.own()); if(err) error.value=message(err); else await load()
}
async function remove(kind: 'platforms'|'expense_types', id: string) {
  if(!confirm('¿Eliminar este elemento? Si está en uso, debes desactivarlo en lugar de eliminarlo.'))return
  try { await db.remove(kind,id); await load() } catch(e){ error.value='No se puede eliminar un elemento utilizado en viajes o gastos. Desactívalo. ' + message(e) }
}
</script>
<template><div class="page-heading"><div><h1>Ajustes</h1><p class="muted">Personaliza plataformas y tipos de gasto.</p></div></div><div v-if="error" class="alert danger">{{error}}</div><div v-if="info" class="alert success">{{info}}</div><div class="dashboard-grid"><div class="card panel"><h2>Plataformas</h2><p class="muted">Personaliza las plataformas para tus traslados.</p><form class="inline-form" @submit.prevent="add('platforms')"><input v-model="newPlatform" required placeholder="Nombre de plataforma" /><button class="button primary" :disabled="busy" type="submit"><Plus :size="16"/> Añadir</button></form><div v-for="p in platforms" :key="p.id" class="setting-row"><b :class="{'inactive':!p.active}">{{p.name}}</b><div class="action-row"><button class="button tiny secondary" @click="toggle('platforms',p)">{{p.active ? 'Desactivar':'Activar'}}</button><button class="icon-button" title="Eliminar" @click="remove('platforms',p.id)"><Trash2 :size="17"/></button></div></div></div><div class="card panel"><h2>Tipos de gasto</h2><p class="muted">Organiza los gastos con tus propias categorías.</p><form class="inline-form" @submit.prevent="add('expense_types')"><input v-model="newCategory" required placeholder="Nombre de categoría"/><button class="button primary" :disabled="busy" type="submit"><Plus :size="16"/> Añadir</button></form><div v-for="t in categories" :key="t.id" class="setting-row"><b :class="{'inactive':!t.active}">{{t.name}}</b><div class="action-row"><button class="button tiny secondary" @click="toggle('expense_types',t)">{{t.active ? 'Desactivar':'Activar'}}</button><button class="icon-button" title="Eliminar" @click="remove('expense_types',t.id)"><Trash2 :size="17"/></button></div></div></div></div><p class="footer-note">Al crear una cuenta se cargan automáticamente las plataformas y categorías iniciales. Desactivar una opción mantiene el histórico de viajes y gastos.</p><PwaInstallCard /></template>
