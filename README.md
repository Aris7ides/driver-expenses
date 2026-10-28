# MiRuta — PWA de viajes y gastos para conductores autónomos

MVP en Nuxt 4 + Vue 3 + TypeScript + Supabase (PostgreSQL y Auth). Diseño responsive para móvil y escritorio.

## Funcionalidades
- Inicio de sesión, registro, recuperación de contraseña.
- Datos privados por usuario mediante políticas PostgreSQL RLS.
- Dashboard mensual: resultado de viajes finalizados y cancelados, previsión de servicios pendientes y cobros globales.
- CRUD de viajes: plataforma, fechas, origen/destino, precio, presupuesto, kilómetros, estado, cobros, observaciones.
- CRUD de gastos asociados: categoría, importe, fecha, concepto, reembolsable parcial, reembolsado parcial y notas.
- Tarjetas móviles y tablas de escritorio; filtros por fechas, plataforma, estado o categoría, paginación de pantalla y exportación CSV de todos los resultados filtrados.
- Registro rápido de gastos desde Inicio, con viaje en curso prioritario y «Guardar y añadir otro».
- Pantalla Cobros: servicio y reembolsos por plataforma, cobros parciales e importe pendiente completo.
- Catálogos administrables: alta, renombrado, activación y desactivación con categorías precargadas.
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
- `npm test`: pruebas locales de formularios, escrituras, validación, fechas, cálculos, instalación PWA, script administrativo, consultas completas, cobros, sesiones y CSV; no contactan con Supabase.
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

## Instalación desde el móvil

En una visita móvil por HTTPS, MiRuta recomienda la instalación después de seis segundos en el login o el inicio. El aviso se oculta mientras se editan campos y no aparece en los formularios de viajes o gastos. «Ahora no» y el botón de cierre aplazan la recomendación siete días en ese navegador. La opción de instalación sigue disponible desde Ajustes.

En navegadores que ofrecen `beforeinstallprompt`, «Instalar MiRuta» abre el diálogo nativo tras el clic. En iPhone se muestra la guía de Safari → Compartir → Añadir a pantalla de inicio; en otros navegadores se ofrecen sus pasos de instalación. Si se abre desde un navegador integrado en otra aplicación, se recomienda abrir la dirección en el navegador habitual.

El aviso se suprime al abrir MiRuta en modo `standalone` (incluida la propiedad de Safari en iOS), o si ese navegador ha notificado su instalación. Esta detección no es universal entre navegadores o entre el sitio y la app instalada en iPhone. No se almacenan datos personales para estas preferencias y no se incorpora modo offline. La instalación real debe comprobarse en dispositivos Android e iPhone desde una dirección HTTPS; abrir una IP de la red local por HTTP no ofrece la misma experiencia.

`npm run test:pwa` comprueba las decisiones de instalación, los eventos, el aplazamiento y la visibilidad del aviso con un navegador simulado. Estas pruebas no sustituyen la validación del diálogo nativo en dispositivos reales.

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
- El resumen mensual agrupa por la fecha local de inicio del viaje. Los servicios realizados se limitan a viajes finalizados. El resultado resta sus gastos propios y los de viajes cancelados del mes; los cancelados aportan cero ingresos de servicio.
- Los servicios planificados o en curso y sus presupuestos se muestran como previsión separada. El presupuesto representa gastos totales previstos, sin anticipar qué parte será reembolsable.
- Los gastos registrados y el desglose por categoría incluyen todos los estados y pagadores de los viajes de ese mes. El pendiente de cobrar es global, de todos los periodos: excluye servicios cancelados y conserva sus reembolsos pendientes.
- «Registrar cobro» suma la cantidad recibida al acumulado; «Cobrar todo» aplica el pendiente actual. Las actualizaciones comprueban el saldo y el límite leídos para evitar sobrescribir un cobro concurrente. La edición de los formularios también detecta cambios en los acumulados.

## Datos, navegación y exportación

Las lecturas se recorren en bloques con orden estable hasta agotar los resultados; los totales y los CSV no dependen de la página visible ni del límite por respuesta de Supabase. Las fechas y los filtros de plataforma, estado o categoría se aplican en la consulta, y la búsqueda de texto opera sobre los resultados completos recuperados. Las listas muestran 25 registros por página. Los resúmenes globales siguen recuperando todos los datos del usuario; para historiales muy grandes, una futura mejora sería calcular agregados en PostgreSQL respetando RLS.

Cada consulta sigue protegida por RLS y añade el propietario autenticado. Al cerrar o cambiar de cuenta se desmontan las pantallas privadas y sus formularios. Los formularios avisan antes de descartar cambios, pero no bloquean la salida cuando ha cambiado el propietario de la sesión. No se guardan borradores privados en el navegador.

Los CSV usan UTF-8, separador `;`, coma decimal y escape de celdas de texto que puedan interpretarse como fórmulas. Se descargan localmente y contienen los datos de la selección aplicada.

## Limitaciones deliberadas del MVP
No incluye justificantes, OCR, horas, kilómetros de aproximación y regreso, reglas por plataforma, equipos, API externas, facturación, pagos bancarios, importaciones, sincronización offline ni sincronización offline. La instalación PWA está preparada con manifest, iconos PNG y service worker mínimo; la app requiere conexión para gestionar los datos.

## Seguridad
Las 5 tablas de dominio tienen RLS; las claves foráneas compuestas `(user_id, id)` impiden referencias entre usuarios. Evita poner secretos de Supabase en el cliente. Antes de producción: revisar confirmación de correo, habilitar medidas antiabuso en Auth, configurar backups, probar aislamiento entre dos cuentas y publicar una política de privacidad. Este proyecto es un punto de partida funcional, no una auditoría de seguridad.
