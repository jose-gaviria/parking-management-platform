# Auditoría técnica — 2026-08-14

Revisión completa del backend (NestJS + Prisma), el frontend (Next.js), el modelo
de datos y la configuración de despliegue. Criterios: manejo de dinero, control de
fraude interno, y el playbook OWASP (Top 10 2025 / API Top 10 2023).

Estado del árbol al momento de la revisión: `npm run typecheck` limpio,
`npm test` 27/27 en verde, `npm run build` correcto.

---

## 1. Resumen

El sistema estaba bien construido en lo esencial: recálculo del cobro **siempre**
en servidor, idempotencia real en pagos, aislamiento serializable y guardia de
concurrencia al cerrar la estancia, tarifas versionadas con copia inmutable del
cálculo, auditoría transaccional. Eso es lo difícil y estaba resuelto.

Los hallazgos se concentraron en tres frentes:

1. **Arranque inseguro por omisión** — un secreto con valor por defecto.
2. **Revocación y autorización** — el token sobrevivía a la desactivación del
   usuario; el PIN de supervisor no tenía freno ante fuerza bruta; una acción
   sensible viajaba sin ninguna validación de permiso.
3. **Anulación de pagos** — la estancia quedaba cerrada y contabilizada aunque el
   pago que la respaldaba ya no existiera.

15 hallazgos corregidos y desplegados a producción el 2026-08-14; 9 documentados y
abiertos.

**Corrección de método**: la primera pasada dio por hecho, leyendo los archivos,
que el despliegue en Vercel no funcionaba. Era falso — llevaba semanas sirviendo.
Ese error importaba: al suponer "un solo proceso" se escribieron controles
anti-fuerza-bruta en memoria que en serverless no protegían nada (A2). Desde
entonces el entorno de ejecución se comprueba con una petición real, no se deduce.

---

## 2. Hallazgos corregidos

### C1 · Crítico — `JWT_SECRET` tenía valor por defecto

`auth.module.ts` firmaba con `process.env.JWT_SECRET ?? 'dev_only_secret'`. Un
despliegue con la variable mal configurada arrancaba **sin fallar**, firmando
tokens con un secreto público: cualquiera podía forjar un token de administrador.

**Corrección:** el secreto es obligatorio y debe medir ≥ 32 caracteres; si falta,
el proceso no arranca. Mismo criterio que ya seguía `TICKET_SIGNING_SECRET`.
Fallar cerrado, no seguir con un valor adivinable.

> ⚠️ **Antes del próximo despliegue**: la comprobación corre al cargar el módulo,
> así que si `JWT_SECRET` no está definida en las variables de entorno del proyecto
> de Vercel, o mide menos de 32 caracteres, **la API dejará de arrancar**. Verificar
> en Vercel → `parqueadero-demo-api` → Settings → Environment Variables antes de
> desplegar. Es el comportamiento deseado (mejor fallar en el despliegue que servir
> con un secreto débil), pero hay que saberlo de antemano.
> Añadir también `TRUST_PROXY=1`: Vercel siempre está detrás de proxy.

### C2 · Alto — el token sobrevivía a la revocación

Roles y permisos se leían del JWT (vigencia 8 h). Desactivar a un operador o
quitarle un rol no surtía efecto hasta que su token expirara: hasta 8 horas de
acceso con permisos ya retirados.

**Corrección:** `JwtAuthGuard` resuelve el usuario contra la base de datos —
rechaza inactivos y usa los permisos vigentes — con caché de 15 s por usuario para
no pagar una consulta por petición.

### C3 · Alto — el PIN de supervisor admitía fuerza bruta

`validateSupervisor` no limitaba intentos. Con el rate limit global (300/min) y un
PIN corto, un operador podía barrer el espacio de PIN desde la propia caja y
auto-autorizarse descuentos, cortesías y anulaciones.

**Corrección:** bloqueo de 5 minutos tras 5 intentos fallidos por usuario
autorizador, y registro en auditoría de **cada** intento fallido
(`AUTHORIZATION_FAILED`) y de las autorizaciones denegadas por falta de permiso
(`AUTHORIZATION_DENIED`). Los inicios de sesión fallidos también quedan en
auditoría (`LOGIN_FAILED`).

### C4 · Alto — `allowDuplicate` no exigía nada

El endpoint de entrada aceptaba `allowDuplicate: true` de cualquier operador con
`sessions.create`, saltándose el bloqueo de placa ya activa. El comentario del
código decía "requiere permiso especial"; ese permiso no existía.

**Corrección:** nuevo permiso `sessions.allow_duplicate` (concedido a SUPERVISOR y
ADMIN en el seed) + autorización de supervisor con usuario y PIN, igual que las
demás acciones sensibles. Queda en auditoría con el autorizador. La pantalla de
entrada ahora ofrece ese camino en lugar de dejar al operador sin salida.

> Al actualizar una instalación existente hay que volver a aplicar el bloque de
> permisos y roles del seed, o el permiso nuevo queda sin asignar (falla cerrado:
> nadie puede autorizar duplicados hasta entonces).

### C5 · Alto — anular un pago dejaba el dinero en los reportes

`voidPayment` marcaba el pago `VOIDED` pero no tocaba la estancia: seguía `CLOSED`
con `total` liquidado. Consecuencias: el vehículo no se podía volver a cobrar, y
`sales-by-vehicle-type` sumaba ese `total` porque lee de la estancia, no del pago.

**Corrección:** si al anular no queda ningún pago confirmado, la estancia vuelve a
`PENDING_PAYMENT` y se limpian los campos de liquidación; la factura asociada pasa
a `CANCELLED`. El pago anulado nunca se borra. Con un proveedor real de facturación
electrónica esto exige nota crédito, no un cambio de estado local (ver
`docs/pendientes.md`).

### C6 · Medio — carrera en el ingreso de placas duplicadas

Dos terminales registrando la misma placa a la vez pasaban ambas la comprobación
de "ya está adentro" y creaban dos estancias activas.

**Corrección:** `pg_advisory_xact_lock(hashtext(placa))` dentro de la transacción
de entrada. No se usó índice único parcial a propósito: el segundo ingreso
autorizado es una función legítima del negocio (C4).

### C7 · Medio — inyección de fórmulas y campos sin escapar en el CSV

`sessions.csv` unía los campos con comas sin comillas ni escapado. Un nombre de
tipo de vehículo con coma rompía las columnas, y uno que empezara por `=` o `+` se
ejecutaba como fórmula al abrir el archivo en Excel o Sheets.

**Corrección:** escapado RFC 4180 (comillas dobladas, campos entrecomillados),
prefijo `'` en valores que empiezan por `= + - @`, saltos `\r\n` y BOM UTF-8 para
que Excel en Windows muestre bien los acentos.

### C8 · Medio — Swagger publicado siempre (exposición **confirmada** en producción)

`/docs` exponía el mapa completo de endpoints y su modelo de permisos en cualquier
entorno. No era hipotético: `https://parqueadero-demo-api.vercel.app/docs` servía
Swagger UI abiertamente el 2026-08-14.

**Corrección:** se publica solo fuera de producción, o con `ENABLE_SWAGGER=1`.
Vercel define `NODE_ENV=production`, así que desaparece en el próximo despliegue.

### C9 · Medio — IP real detrás de proxy

Con un proxy inverso delante, `req.ip` es la IP del proxy: el rate limiting trata a
todos los clientes como uno y la auditoría registra siempre la misma terminal.

**Corrección:** `TRUST_PROXY=1` activa `trust proxy` en Express.

### C10 · Medio — el PIN del supervisor quedaba cargado en el formulario

En la pantalla de cobro, `authorizer` conservaba usuario y PIN después de usarlos.
El supervisor se iba y el operador podía seguir autorizando descuentos y ticket
perdido con los campos ya llenos.

**Corrección:** el PIN se limpia después de cada autorización, en cobro y en
entrada; tras confirmar el pago también se descarta la credencial guardada para el
descuento.

### C11 · Medio — política de contraseñas y PIN por debajo del playbook

Contraseñas de 6 caracteres, PIN sin validación (se aceptaba uno de un dígito), y
bcrypt con costo 10.

**Corrección:** contraseña ≥ 8, PIN numérico de ≥ 4 dígitos, bcrypt costo 12
(mínimo OWASP), centralizado en `src/common/hashing.ts`. Nota de rendimiento allí:
`bcryptjs` es JavaScript puro; si el volumen crece, mover a `bcrypt` nativo o
argon2id antes que bajar el costo.

### C12 · Bajo — `flatDiscount` se perdía y los query params podían ser `NaN`

`GET /sessions/:id/quote` no leía `flatDiscount` (sí lo leía `POST /sessions/scan`),
y `Number('abc')` producía `NaN`, que se propagaba al motor de tarifas.

**Corrección:** se acepta `flatDiscount` y los enteros se parsean con validación.

### Además

- Pruebas nuevas para el código de ticket (7 casos: checksum alterado, consecutivo
  alterado, basura del lector, camino de digitación manual). 34 pruebas en verde.
- `test:e2e` apuntaba a `apps/api/test/jest-e2e.json`, que no existe: el script se
  retiró hasta que existan E2E reales.
- README corregido: afirmaba que "códigos inventados o alterados no validan", sin
  matizar que el código corto digitado a mano se acepta a propósito y solo
  identifica una estancia, no prueba autenticidad.

---

## 3. Hallazgos abiertos

### A1 · Los convenios no se aplican en ningún cobro

`Agreement` existe en el esquema con `discountPct` y `flatDiscount`, hay endpoints
para crearlos y listarlos, `ParkingSession.agreementId` está modelado y el medio de
pago `AGREEMENT` está sembrado — pero **nada** asigna un convenio a una estancia ni
lo aplica en `calculateCharge`. El seed crea un "Convenio Empresa 20%" que no
descuenta nada.

Es la funcionalidad más grande a medias del sistema. Falta decidir la regla de
negocio: ¿el convenio se detecta por placa (como la mensualidad), por cliente
identificado en la entrada, o lo elige el operador al cobrar? Hasta responder eso
no tiene sentido escribir el código.

### ~~A2~~ · RESUELTO el 2026-08-14 — controles anti-fuerza-bruta con estado compartido

El sistema **está desplegado y funcionando en Vercel** (verificado el 2026-08-14):

| Proyecto | URL | Estado |
|---|---|---|
| `parqueadero-demo-api` | `parqueadero-demo-api.vercel.app` | responde `200` con JSON real desde Neon |
| `parqueadero-demo` | `parqueadero-demo.vercel.app` | login renderizado |

Docker cubre **solo** el Postgres de desarrollo (`docker-compose.yml` define un
único servicio, `db`). No hay Dockerfile para API ni web. La base de producción es
Neon, no el contenedor.

Eso cambia la naturaleza de tres controles que viven en **memoria del proceso**:

| Control | En un servidor | En Vercel |
|---|---|---|
| `ThrottlerModule` (10 inicios de sesión/min) | funciona | por instancia — el atacante reparte los intentos y el límite deja de existir |
| Bloqueo de PIN tras 5 fallos (C3) | funciona | por instancia — se elude cambiando de lambda |
| Caché de permisos del guard (C2) | una caché | N cachés de 15 s — molesto, no peligroso |

**Corrección aplicada.** El contador pasó a la base de datos (tabla
`auth_attempts`, migración `20260814145301_auth_attempts`), servida por
`AuthAttemptsService` con un único `INSERT … ON CONFLICT` para que dos intentos
simultáneos no puedan pisarse:

| Clave | Política |
|---|---|
| `login:<usuario>` | 8 fallos → 5 min de bloqueo |
| `pin:<usuario>` | 5 fallos → 5 min de bloqueo |

Verificado **en producción** el 2026-08-14: nueve intentos consecutivos contra
`/auth/login`; el noveno devolvió `TOO_MANY_ATTEMPTS`. Como las peticiones se
reparten entre instancias, eso prueba que el contador es compartido. Los ocho
fallos quedaron en `audit_logs` con la IP real del cliente (confirma que
`TRUST_PROXY=1` surte efecto).

El `ThrottlerModule` sigue siendo por instancia: se mantiene como primera barrera
barata, pero ya no es el control del que depende nada.

El bloqueo por placa (C6) **sí** sobrevivía desde el principio:
`pg_advisory_xact_lock` vive en Postgres, no en el proceso.

### A2-bis · Las migraciones no corrían en el despliegue

`vercel.json` no definía comando de build: el preset de NestJS compilaba, pero
nadie aplicaba las migraciones de Prisma. Cualquier cambio de esquema habría
llegado a producción con el código nuevo y la base vieja.

**Corrección:** script `vercel-build` en `apps/api/package.json` —
`prisma generate && prisma migrate deploy && nest build`. Vercel lo usa
automáticamente. Además, el `datasource` gana `directUrl` (`DATABASE_URL_UNPOOLED`):
el pooler de Neon en modo transacción no sirve para DDL. Verificado en el despliegue
del 2026-08-14, que aplicó `20260814145301_auth_attempts` correctamente.

### A2-ter · `@nestjs/platform-express` no resolvía en local

Defecto preexistente, ajeno al despliegue: npm izaba `@nestjs/core` a la raíz del
monorepo y dejaba `@nestjs/platform-express` anidado en `apps/api/node_modules`.
Como el buscador de drivers resuelve desde `@nestjs/core`, no lo encontraba y
`npm run dev` —el arranque documentado en el README— moría con
*"No driver (HTTP) has been selected"*. En Vercel no se notaba porque allí se
instala solo `apps/api`, con un único árbol de dependencias.

**Corrección:** `@nestjs/platform-express` fijado en `devDependencies` y en
`overrides` de la raíz, como ya estaban `@nestjs/common` y `@nestjs/core`.

### A2b · La documentación de producción describe un despliegue que no es el real

`docs/produccion.md` describía un proceso único detrás de un proxy inverso, con
`docker compose` y respaldos vía `docker exec`. El despliegue real es serverless
sobre Vercel + Neon. Corregido en esta pasada, pero conviene revisarlo entero: la
guía y la realidad llevaban tiempo separadas.

### A2c · Producción no tiene respaldo

`scripts/backup.ps1` ejecuta `docker exec parking-db pg_dump`: respalda el
contenedor **local**. La base de producción está en Neon y no tiene ningún respaldo
documentado ni programado.

Neon trae *history retention* (restauración a un punto en el tiempo dentro de la
ventana del plan), que ayuda pero no sustituye a un volcado propio: si se pierde el
acceso a la cuenta, se pierde todo. Falta un `pg_dump` contra la cadena de conexión
sin pooling (`DATABASE_URL_UNPOOLED`), programado y guardado fuera de Vercel.

### A3 · El motor de tarifas recorre minuto a minuto

Con franjas horarias u overrides, `PER_MINUTE` itera una vez por minuto facturado y
`PER_FRACTION`/`PER_HOUR` una vez por unidad. Una estancia olvidada de varios meses
son cientos de miles de iteraciones **por cada cotización**, y la pantalla de cobro
cotiza en cada escaneo. Conviene un cálculo cerrado por tramos, o un tope de
iteraciones que caiga al modo simple.

### A4 · Precedencia ambigua entre franjas y fechas especiales

En `unitPriceAt`, si el instante cae dentro de una franja horaria, esa franja gana y
se ignoran `weekdayOverrides` y `specialDates`. Puede ser lo deseado o justo lo
contrario en un festivo con tarifa especial. No está documentado ni cubierto por
pruebas: hay que decidir la regla y fijarla con un test.

### A5 · El descuento se aplica también sobre el recargo por ticket perdido

`lostTicketFee` se suma al subtotal antes de calcular el descuento, así que un 20 %
también rebaja el recargo. Probablemente no es lo que se quiere de una penalización.

### A6 · Los reportes cargan todo en memoria

`sales`, `occupancyByHour` y `salesByVehicleType` traen todas las filas del periodo
y agregan en JavaScript. Con un año de operación son cientos de miles de filas por
consulta. Corresponde agregar en SQL (`groupBy` de Prisma o `$queryRaw`).

### A7 · Carrera al cerrar turno

`closeShift` calcula el resumen y después actualiza el turno en otra transacción. Un
pago que entre en ese hueco queda fuera del `expectedCash` guardado. Ventana
pequeña, pero es dinero: cabe dentro de una sola transacción.

### A8 · Cobertura de pruebas limitada a funciones puras

Solo hay pruebas del motor de tarifas y del código de ticket. Lo que mueve dinero —
`confirmPayment`, `voidPayment`, cierre de turno, permisos de los guards — no tiene
ninguna. Es la brecha más grande de calidad. El stack de referencia usa Vitest para
unit e integración y Playwright para los flujos de operador; NestJS v11 ya trae
Vitest por defecto (el proyecto sigue en Jest).

### A10 · Los despliegues de *preview* escriben en la base de producción

`DATABASE_URL` está definida para Production, Preview y Development con la **misma**
cadena de Neon. Cualquier despliegue de preview —una rama, una prueba— opera contra
los datos reales: puede registrar entradas, cobrar y cerrar turnos de verdad.

Neon soporta *branching*: una rama de la base por entorno, con su propia
`DATABASE_URL` en el ámbito Preview. Es la solución correcta y no cuesta nada en el
plan gratuito. No se aplicó en esta pasada porque cambia infraestructura y merece
decisión explícita.

Mitigación parcial ya en pie: Preview tiene sus propios `JWT_SECRET` y
`TICKET_SIGNING_SECRET`, de modo que sus sesiones y sus códigos de ticket no valen
en producción.

### A9 · El token vive en `localStorage`

Un XSS en el frontend se lleva el token. La alternativa es cookie `httpOnly` +
`SameSite`, que exige mover la sesión a cookies en API y web. Riesgo acotado en una
red local cerrada; decisión consciente a dejar registrada, no un descuido.

---

## 4. Alineación con el stack de referencia

Comparado con la base de conocimiento del vault (`Software Engineering Knowledge Base`):

| Pieza | En el proyecto | Referencia | Lectura |
|---|---|---|---|
| NestJS | v11.1.28 | v11 | Al día |
| Next.js | 16.2.10 | 16.3.1 | Al día, un parche por detrás |
| Node | ≥ 20 declarado | v24 LTS | Subir el mínimo a 22 o 24 |
| PostgreSQL | 16-alpine | 18.6 | v16 con soporte; planear el salto |
| Validación | class-validator | Zod v4 | Válido en Nest; Zod unificaría tipos y validación |
| Tests | Jest | Vitest v4 (+ Playwright) | Ver A8 |
| Hash | bcryptjs costo 12 | argon2id o bcrypt ≥ 12 | Cumple; `bcryptjs` es JS puro (ver C11) |

Ninguna de estas diferencias es urgente. La única con impacto real a corto plazo es
la de pruebas (A8).

---

## 5. Estado del despliegue (2026-08-14)

Desplegado y verificado en caliente contra `parqueadero-demo-api.vercel.app`:

| Comprobación | Resultado |
|---|---|
| `GET /health` | `200` · base de datos `ok` · 18 ms |
| `GET /docs` | `404` — Swagger cerrado en producción |
| `GET /settings/public` | `200` |
| CORS desde `parqueadero-demo.vercel.app` | `Access-Control-Allow-Origin` correcto |
| Bloqueo de login (9 intentos) | el 9.º devuelve `TOO_MANY_ATTEMPTS` |
| IP en auditoría | IP real del cliente, no la del proxy |
| Migración `auth_attempts` | aplicada durante el build |
| Web `/login` | `200` |

`JWT_SECRET` de producción se rotó a 64 caracteres, porque Vercel no permite leer
el valor anterior para comprobar su longitud. **Efecto: las sesiones abiertas antes
del 2026-08-14 quedaron invalidadas y los operadores tuvieron que volver a entrar.**
`TICKET_SIGNING_SECRET` no se tocó: rotarlo invalidaría el código de barras de los
vehículos que estuvieran dentro.

## 6. Qué haría a continuación

1. **A2c — respaldo real de la base de producción.** Hoy no existe; es lo único
   pendiente cuya ausencia puede costar todo.
2. **A10 — rama de Neon para *preview***, para que dejen de escribir sobre datos
   reales.
3. **A1 — convenios**: decidir la regla de negocio. Hoy hay una funcionalidad
   visible que no hace nada.
4. **A8 — pruebas de pagos y turnos**: un error ahí es dinero real y no hay red.
5. **A3/A6 — rendimiento** cuando el volumen lo justifique, no antes.
