# Producción

## Cómo está desplegado hoy (2026-08-14)

| Pieza | Dónde | Notas |
|---|---|---|
| Web | Vercel — proyecto `parqueadero-demo` | Next.js, preset nativo |
| API | Vercel — proyecto `parqueadero-demo-api` | NestJS; región `gru1` (São Paulo) |
| Base de datos | Neon (Postgres serverless) | `DATABASE_URL` con pooling; `DATABASE_URL_UNPOOLED` para migraciones y respaldos |
| Postgres de Docker | **solo desarrollo** | `docker-compose.yml` define únicamente el servicio `db`. No hay Dockerfile de API ni web |

Variables que deben existir en **ambos** proyectos de Vercel:

| Variable | Proyecto | Por qué |
|---|---|---|
| `JWT_SECRET` (≥ 32 car.) | api | **Sin ella la API no arranca.** Verificar antes de cada despliegue |
| `TICKET_SIGNING_SECRET` | api | Sin ella fallan la entrada y el escaneo |
| `DATABASE_URL` | api | Cadena de Neon **con pooling** (serverless abre muchas conexiones) |
| `CORS_ORIGIN` | api | URL exacta de la web desplegada |
| `TRUST_PROXY=1` | api | Vercel siempre está detrás de proxy: sin esto el rate limiting y la auditoría ven una sola IP |
| `DATABASE_URL_UNPOOLED` | api | Conexión directa para las migraciones (la crea la integración de Neon) |
| `NEXT_PUBLIC_API_URL` | web | URL de la API desplegada |

### Acceso de demostración

El proyecto `parqueadero-demo-api` define `DEMO_USERNAME` y `DEMO_PASSWORD`. Con ellas:

- cada despliegue deja ese usuario (rol ADMIN) con esa contraseña (`prisma/demo-user.ts`, dentro de `vercel-build`);
- `GET /auth/demo` las publica y el inicio de sesión las muestra y las deja escritas;
- la API rechaza cualquier cambio a ese usuario (contraseña, estado o roles).

Son credenciales **públicas a propósito**. Una instalación real no define esas variables: no hay usuario demo y `/auth/demo` responde 404.

`ENABLE_SWAGGER` se deja **sin definir**: Vercel pone `NODE_ENV=production` y
`/docs` queda oculto, que es lo correcto.

### Migraciones

Las aplica el propio despliegue: `apps/api/package.json` define

```
"vercel-build": "prisma generate && prisma migrate deploy && ts-node --transpile-only prisma/demo-user.ts && nest build"
```

Vercel usa ese script automáticamente. Si una migración falla, el despliegue falla
y no llega a producción. `prisma migrate deploy` usa `directUrl`
(`DATABASE_URL_UNPOOLED`) porque el pooler de Neon en modo transacción no sirve
para DDL.

### Estado compartido, no estado en el proceso

En Vercel cada instancia tiene su propia memoria, así que un contador en una
variable no protege nada. Lo que hay:

| Control | Dónde vive | Sirve en serverless |
|---|---|---|
| Bloqueo de login (8 fallos → 5 min) | tabla `auth_attempts` | sí |
| Bloqueo de PIN (5 fallos → 5 min) | tabla `auth_attempts` | sí |
| Bloqueo por placa duplicada | `pg_advisory_xact_lock` | sí |
| `ThrottlerModule` (10 logins/min) | memoria | **no** — primera barrera barata, nada depende de ella |
| Caché de permisos del guard (15 s) | memoria | sí, degradada a N cachés; sin riesgo |

### Monitoreo

`GET /health` comprueba que la función arrancó **y** que alcanza la base de datos —
el fallo más probable en serverless. Devuelve `200` con la latencia, o `503` si la
base no responde. Apuntar ahí cualquier monitor externo.

### Pendiente: los *preview* escriben en producción

`DATABASE_URL` es la misma en Production, Preview y Development. Un despliegue de
preview opera contra los datos reales. La solución es una rama de Neon con su
propia `DATABASE_URL` en el ámbito Preview (A10 en [auditoria.md](auditoria.md)).

---

## Alternativa: instalación en la sede

Lo que sigue aplica si el sistema se instala en un servidor propio de la sede en
lugar de Vercel — modo que además funciona sin internet.

## Checklist antes de salir a producción

1. **Secretos**: genera valores propios en `.env`:
   ```bash
   # JWT_SECRET y TICKET_SIGNING_SECRET
   openssl rand -hex 32
   ```
   Ambas son obligatorias y `JWT_SECRET` debe tener ≥ 32 caracteres: si faltan
   o son cortas, la API se niega a arrancar en lugar de usar un valor por defecto.
2. **BD**: contraseña real en `POSTGRES_PASSWORD` + `DATABASE_URL`.
3. **CORS**: `CORS_ORIGIN` = URL real del frontend.
4. **HTTPS**: coloca un reverse proxy (Caddy o Nginx) delante de web (3001) y API (4000).
   Con proxy delante, pon `TRUST_PROXY=1`: sin eso el rate limiting y la auditoría
   registran siempre la IP del proxy y dejan de distinguir terminales.
5. **`NODE_ENV=production`**: además de optimizar, oculta Swagger (`/docs`), que
   expone el mapa completo de endpoints y permisos. Para publicarlo aun así:
   `ENABLE_SWAGGER=1`.
6. **Zona horaria**: el servidor debe tener la TZ del parqueadero (los cálculos de
   franjas y días usan hora local del servidor).
7. Ejecuta migraciones con `prisma migrate deploy` (nunca `migrate dev` en producción).
8. **Siembra de permisos**: el catálogo de permisos vive en la BD. Al actualizar el
   sistema, vuelve a aplicar los permisos y roles (bloque de permisos del seed) o
   los permisos nuevos quedarán sin asignar a ningún rol.
9. NO ejecutes el seed de demostración en producción; crea el usuario admin real
   y cambia su contraseña.

En este modo, el bloqueo de PIN, el `ThrottlerModule` y la caché del guard sí
funcionan como se espera: hay un solo proceso. Es la diferencia principal frente al
despliegue serverless descrito arriba.

## Build y arranque

```bash
npm ci
npm run build
# API
cd apps/api && npx prisma migrate deploy && node dist/main.js
# Web
cd apps/web && npm run start   # sirve .next standalone en :3001
```

Para servicio de Windows usa NSSM o Tareas Programadas; en Linux, systemd.

## Copias de seguridad

### Instalación en la sede (Docker)

```powershell
# Respaldo (scripts/backup.ps1)
.\scripts\backup.ps1           # crea backups/parking_YYYYMMDD_HHmm.sql

# Restauración (scripts/restore.ps1)
.\scripts\restore.ps1 backups\parking_20260718_0800.sql
```

Programa el backup diario (Task Scheduler / cron) y copia los archivos a otro equipo
o nube. Los respaldos contienen datos financieros: protégelos y cífralos si salen
de la sede.

### Despliegue en Vercel + Neon — **pendiente**

⚠️ `scripts/backup.ps1` ejecuta `docker exec parking-db pg_dump`: respalda el
contenedor local, **no la base de producción**. Hoy el despliegue en Neon no tiene
ningún respaldo propio.

Neon ofrece restauración a un punto en el tiempo dentro de la ventana de retención
del plan, lo cual cubre el borrado accidental — pero no cubre perder el acceso a la
cuenta. Hace falta un volcado propio, contra la cadena **sin pooling**:

```bash
pg_dump "$DATABASE_URL_UNPOOLED" --no-owner --format=custom \
  --file "parking_$(date +%Y%m%d_%H%M).dump"
```

Programarlo fuera de Vercel (equipo de la sede, GitHub Actions con secreto, o
cualquier máquina con `cron`) y guardar los archivos en otro proveedor. Contienen
datos financieros: cifrarlos.

## Operación sin internet

El sistema opera 100 % en red local (entradas, cobros, caja, impresión). Si hay
facturación electrónica real configurada y no hay internet, las facturas quedan
`PENDING` y se reenvían con **Administración → Facturas → Reintentar pendientes**
(o automatizable con una tarea programada llamando `POST /billing/retry-pending`).

## Monitoreo mínimo

- Logs del API (stdout) — rota con el servicio.
- `GET /settings/public` como healthcheck básico de API + BD.
- Vigila el volumen Docker `parking_db_data` (espacio en disco).
