# Sistema de Gestión de Parqueadero

Sistema completo para un parqueadero de una sede: entradas, salidas, cobro con lector de código de barras, caja, turnos, tarifas versionadas, clientes, mensualidades, reportes y auditoría.

**Arquitectura:** monolito modular · Next.js (web) + NestJS (API) + PostgreSQL (Prisma) · monorepo npm workspaces.

**Despliegue:** web y API en Vercel (`parqueadero-demo` y `parqueadero-demo-api`), base de datos en Neon. Docker se usa **solo en desarrollo**, y únicamente para el Postgres local. Detalles y variables requeridas en [docs/produccion.md](docs/produccion.md).

---

## Requisitos

- Node.js ≥ 20 (probado con 24)
- npm ≥ 10
- Docker + Docker Compose (para PostgreSQL)
- Windows, macOS o Linux

## Instalación (desarrollo)

```bash
# 1. Instalar dependencias
npm install

# 2. Variables de entorno
copy .env.example .env          # Windows
copy .env.example apps\api\.env
# (Linux/macOS: cp en lugar de copy)

# 3. Base de datos (PostgreSQL en puerto 5433)
docker compose up -d db

# 4. Migraciones y datos semilla
npm run db:migrate --workspace apps/api -- --name init   # primera vez ya existe: usar npx prisma migrate deploy
cd apps/api && npx prisma migrate deploy && npx prisma db seed && cd ../..

# 5. Arrancar todo (API en :4000, web en :3001)
npm run dev
```

- Web: http://localhost:3001
- API + documentación Swagger: http://localhost:4000/docs
- Estado de la API: http://localhost:4000/health

## Usuarios de demostración (SOLO desarrollo)

El seed crea los usuarios `admin`, `supervisor`, `operador1`, `operador2` y
`auditor`. Sus contraseñas y PIN se definen localmente mediante las variables
`SEED_*` incluidas en `.env.example`; el repositorio no contiene credenciales.

El seed crea además: tipos de vehículo, tarifas de ejemplo, medios de pago, un cliente con mensualidad activa (placa `MEN123`), un convenio y estancias activas de prueba (los códigos de ticket se imprimen en la consola del seed).

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | API + web en modo desarrollo |
| `npm run build` | Compila shared + API + web |
| `npm test` | Pruebas unitarias (motor de tarifas y más) |
| `npm run typecheck` | Verificación de tipos en todos los paquetes |
| `npm run db:migrate` | Migraciones Prisma (dev) |
| `npm run db:seed` | Datos semilla |
| `npm run db:studio` | Prisma Studio (explorador de BD) |

## Flujo del operador

```
Escanear → Revisar → Cobrar → Confirmar
```

1. **Abrir turno** (Caja y turno → base inicial).
2. **Registrar entrada**: placa + tipo → imprime ticket con código de barras Code 128.
3. **Cobrar salida**: el campo de escaneo siempre tiene el foco; el lector USB (HID teclado, terminado en Enter) dispara la búsqueda. El sistema calcula tiempo y valor, muestra el resumen, registra el pago (efectivo con cambio, tarjeta, transferencia o mixto) e imprime el comprobante.
4. **Cerrar turno**: efectivo contado → diferencia calculada → resumen imprimible.

Casos cubiertos: ticket pagado (muestra comprobante y bloquea doble cobro), ticket inexistente/ilegible (búsqueda por placa o digitación), ticket perdido (recargo con autorización de supervisor por PIN), lectura duplicada (debounce), descuentos autorizados, mensualidades (detección automática por placa), cortesías.

## Estructura

```
parqueadero/
├── apps/
│   ├── api/          # NestJS + Prisma (módulos: auth, sessions, tariffs, shifts, payments, …)
│   └── web/          # Next.js (operación + administración + impresión 80mm)
├── packages/
│   └── shared/       # Tipos y constantes compartidas
├── docs/             # Documentación técnica y manuales
├── scripts/          # Backup / restauración
└── docker-compose.yml
```

## Documentación

- [docs/arquitectura.md](docs/arquitectura.md) — decisiones, modelo de datos, estados
- [docs/impresion.md](docs/impresion.md) — estrategia de impresión térmica y alternativas
- [docs/operacion.md](docs/operacion.md) — manual del operador y del administrador
- [docs/produccion.md](docs/produccion.md) — despliegue, seguridad, respaldos
- [docs/pendientes.md](docs/pendientes.md) — información pendiente del negocio e integraciones futuras
- [docs/auditoria.md](docs/auditoria.md) — auditoría técnica y de seguridad (2026-08-14)

## Seguridad

- Contraseñas y PIN con bcrypt. JWT con expiración (8 h por defecto).
- `JWT_SECRET` y `TICKET_SIGNING_SECRET` son obligatorias: sin ellas el proceso no arranca (no hay valor por defecto que se pueda adivinar).
- Permisos por acción validados en el backend (guards), no solo en la UI. El guard los relee de la base de datos cada 15 s: desactivar un usuario o quitarle un rol surte efecto sin esperar a que expire su token.
- Acciones sensibles (descuento, anulación, ticket perdido, corrección de placa, segundo ingreso de una placa ya activa) exigen credencial de supervisor. Tras 5 PIN fallidos, el autorizador queda bloqueado 5 minutos; cada intento fallido queda en auditoría.
- Rate limiting (10 inicios de sesión por minuto), Helmet, validación de entrada en todos los endpoints, CORS restringido. Swagger (`/docs`) no se publica en producción salvo `ENABLE_SWAGGER=1`.
- El código de barras lleva checksum HMAC: un código **escaneado** inventado o alterado no valida. El código corto digitado a mano (sin checksum) se acepta a propósito para tickets ilegibles: identifica una estancia existente, no prueba autenticidad.
- Idempotencia en pagos: doble clic o reintento de red jamás genera dos cobros. Cierre de estancia con guardia de concurrencia y aislamiento serializable.
- Nunca se eliminan movimientos financieros: anulaciones y ajustes conservan el historial. Anular un pago devuelve la estancia a *pendiente de cobro* para que no quede como ingreso cerrado sin respaldo.

⚠️ En producción: genera `JWT_SECRET` y `TICKET_SIGNING_SECRET` propios, usa contraseñas reales de BD, HTTPS y `TRUST_PROXY=1` si hay proxy inverso. Ver [docs/produccion.md](docs/produccion.md) y [docs/auditoria.md](docs/auditoria.md).
