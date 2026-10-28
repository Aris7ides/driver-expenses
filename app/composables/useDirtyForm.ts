export const useDirtyForm = (form: object) => {
  const baseline = ref(JSON.stringify(form))
  const dirty = computed(() => JSON.stringify(form) !== baseline.value)
  const { user } = useSession()
  const owner = user.value?.id
  const shouldWarn = () => dirty.value && owner === user.value?.id
  const confirmLeave = () => !shouldWarn() || window.confirm('Tienes cambios sin guardar. ¿Quieres descartarlos?')
  const beforeUnload = (event: BeforeUnloadEvent) => { if (shouldWarn()) { event.preventDefault(); event.returnValue = '' } }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
  onBeforeRouteLeave(confirmLeave)
  return { dirty, confirmLeave, markSaved: () => { baseline.value = JSON.stringify(form) } }
}
