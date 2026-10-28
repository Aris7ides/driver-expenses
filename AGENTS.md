# Normas del proyecto MiRuta
- Stack: Nuxt 4, Vue 3, TypeScript, Supabase Auth/PostgreSQL, CSS nativo.
- Usuario objetivo: conductor autónomo individual; nunca introducir datos compartidos entre usuarios.
- Toda consulta a datos privados debe respetar RLS; todas las escrituras llevan user_id derivado de auth.getUser(), jamás del formulario.
- Migraciones SQL versionadas y FKs compuestas para impedir referencias cruzadas.
- Centraliza cálculos en app/composables/useHelpers.ts; dinero = numeric(12,2) SQL, mostrar con euro().
- El MVP no incluye justificantes, horas, kilómetros extra, equipos ni offline.
- Usa campos mobile-first y componentes reutilizables. No introducir infraestructura sin necesidad.
- Verificar npm run build antes de entregar cambios importantes.
