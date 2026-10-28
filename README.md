# MiRuta — PWA de viajes y gastos para conductores autónomos

MVP en Nuxt 4 + Vue 3 + TypeScript + Supabase (PostgreSQL y Auth). Diseño responsive para móvil y escritorio.

## Funcionalidades
- Inicio de sesión, registro, recuperación de contraseña.
- Datos privados por usuario mediante políticas PostgreSQL RLS.
- Dashboard mensual: viajes, precio de servicios, gastos, beneficio operativo y pendiente de cobrar.
- CRUD de viajes: plataforma, fechas, origen/destino, precio, presupuesto, kilómetros, estado, cobros, observaciones.
- CRUD de gastos asociados: categoría, importe, fecha, concepto, reembolsable parcial, reembolsado parcial y notas.
- Listados y búsquedas; catálogos administrables con categorías precargadas.
- Manifest PWA, iconos y service worker mínimo que cachea solo iconos públicos; interfaz adaptable a móvil. **No hay modo offline para datos privados**.

## Arranque
1. Instala Node.js 22 o superior.
2. Ejecuta `npm install`.
3. Crea un proyecto en [Supabase](https://supabase.com) y aplica los archivos de `supabase/migrations/` en orden de nombre desde el SQL Editor, cada uno una sola vez. Alternativamente usa Supabase CLI y sus migraciones.
4. Copia `.env.example` a `.env` y rellena las variables públicas con la URL y clave *publishable/anon* del proyecto. **Nunca añadas la service_role key al frontend**.
5. En Supabase → Authentication → URL Configuration, configura la Site URL y las Redirect URLs de localhost y tu dominio real (para recuperación y confirmaciones).
6. Ejecuta `npm run dev` y abre http://localhost:3000.
7. Registra un usuario. Se crean automáticamente las plataformas y categorías predeterminadas.

## Despliegue en Vercel
1. Publica el proyecto en un repositorio GitHub privado.
2. Importa el repositorio en Vercel, framework Nuxt (automático).
3. Añade `NUXT_PUBLIC_SUPABASE_URL` y `NUXT_PUBLIC_SUPABASE_ANON_KEY` como variables de entorno.
4. Despliega. Configura después la Site URL y Redirect URLs de Supabase con tu dominio de Vercel o dominio propio.
5. Gestiona los cambios de base de datos mediante migraciones versionadas, aplicadas antes de desplegar código dependiente.

## Comprobaciones
- `npm run typecheck`: comprueba TypeScript y las plantillas Vue.
- `npm run build`: compila la aplicación para producción.
- `npm test`: pruebas locales de formularios, escrituras, validación, fechas y cálculos; no contactan con Supabase.
- `npm run check:supabase`: comprueba Auth y el acceso anónimo con la configuración local. No modifica registros.

Para comprobar también las lecturas autenticadas y el acceso entre usuarios, crea dos cuentas **de prueba**, confirma sus correos y configura un `.env.test` local (está excluido de Git):

```dotenv
MIRUTA_TEST_A_EMAIL=cuenta-prueba-a@example.com
MIRUTA_TEST_A_PASSWORD=contraseña-de-prueba-a
MIRUTA_TEST_B_EMAIL=cuenta-prueba-b@example.com
MIRUTA_TEST_B_PASSWORD=contraseña-de-prueba-b
```

Vuelve a ejecutar `npm run check:supabase`. Para verificar además el CRUD real, las relaciones, RLS y el borrado en cascada, añade `MIRUTA_TEST_ALLOW_WRITES=1` a ese archivo y ejecuta `npm run test:supabase`. Esta prueba usa las funciones reales de `useDb`, crea viajes y gastos temporales únicamente en esas cuentas e intenta eliminarlos al terminar. No crea usuarios, no modifica registros previos ni aplica migraciones. Sin las cuentas y la autorización de escritura, la prueba se marca como omitida; eso no equivale a verificar el aislamiento remoto.

En PowerShell con ejecución de scripts deshabilitada, usa `npm.cmd` en lugar de `npm`.

Si el login funciona pero las tablas devuelven `403 / 42501` (`permission denied for table`), aplica la migración `supabase/migrations/202610280002_authenticated_access.sql` en el SQL Editor del proyecto. Concede los permisos CRUD al rol `authenticated`, mantiene RLS habilitado y cierra el acceso anónimo a esas tablas. Después repite las comprobaciones. No vuelvas a ejecutar la migración inicial si las tablas ya existen.

## Cambiar el correo o contraseña de un usuario

El script local `scripts/update-user.mjs` utiliza la API administrativa de Supabase para actualizar una cuenta existente por su UID, conservando sus viajes y gastos. No se ejecuta desde la aplicación web ni forma parte de sus endpoints.

1. Copia `.env.admin.example` a `.env.admin` si no existe. Este archivo está excluido de Git.
2. En `.env.admin`, rellena `SUPABASE_SECRET_KEY` con una clave **secret** (`sb_secret_...`) o **service_role** del proyecto. Nunca uses un nombre de variable `NUXT_PUBLIC_` para esta clave. La URL se toma de `.env`.
3. Copia el UID de la cuenta desde **Authentication → Users** a `MIRUTA_ADMIN_USER_ID`. Puedes rellenar `MIRUTA_ADMIN_EXPECTED_EMAIL` con el correo actual para comprobar la cuenta elegida.
4. Rellena `MIRUTA_ADMIN_NEW_EMAIL`, `MIRUTA_ADMIN_NEW_PASSWORD` o ambos. Deja vacío lo que no quieras cambiar y conserva las comillas si la contraseña contiene `#` o espacios.
5. Ejecuta `npm run admin:user -- --dry-run` para consultar la cuenta y revisar el cambio sin aplicarlo.
6. Ejecuta `npm run admin:user` para aplicar el cambio.

`MIRUTA_ADMIN_CONFIRM_EMAIL=true` marca el nuevo correo como confirmado directamente, sin verificar el buzón mediante un enlace. El cambio es administrativo. Si solo cambias la contraseña, el estado del correo se conserva. El script no imprime la contraseña ni la clave. Después de usarlo, vacía los nuevos valores en `.env.admin` para evitar repetir el cambio por accidente. Para comprobar el script sin tocar cuentas reales: `npm run test:admin`.

## Modelo económico
- Ingresos: precio acordado del servicio (no equivale a importe cobrado).
- Gastos: importe de cada gasto registrado.
- Gasto propio = gasto adelantado por el conductor menos la parte marcada como reembolsable.
- Beneficio operativo = precio del servicio menos gastos propios, **sin impuestos, costes fijos ni comisiones**.
- Pendiente de cobrar = servicio pendiente + gastos adelantados reembolsables todavía no reembolsados.
- `service_collected` y `reimbursed_amount` permiten registrar cobros parciales acumulados, sin historial individual de movimientos (futuro).
- El resumen mensual agrupa por la fecha local de inicio del viaje. Incluye servicios planificados y en curso, excluye cancelados y muestra los importes acordados; el pendiente se limita a esos viajes, no a toda la deuda histórica.

## Limitaciones deliberadas del MVP
No incluye justificantes, OCR, horas, kilómetros de aproximación y regreso, reglas por plataforma, equipos, API externas, facturación, pagos bancarios, importaciones, sincronización offline ni sincronización offline. La instalación PWA está preparada con manifest, iconos PNG y service worker mínimo; la app requiere conexión para gestionar los datos.

## Seguridad
Las 5 tablas de dominio tienen RLS; las claves foráneas compuestas `(user_id, id)` impiden referencias entre usuarios. Evita poner secretos de Supabase en el cliente. Antes de producción: revisar confirmación de correo, habilitar medidas antiabuso en Auth, configurar backups, probar aislamiento entre dos cuentas y publicar una política de privacidad. Este proyecto es un punto de partida funcional, no una auditoría de seguridad.
