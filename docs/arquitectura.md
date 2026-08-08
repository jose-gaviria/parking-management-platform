# Arquitectura

## Decisiones principales

| Tema | Decisión | Razón |
|---|---|---|
| Estilo | Monolito modular (NestJS módulos) | Una sede; simplicidad operativa; preparado para crecer |
| BD | PostgreSQL 16 + Prisma | Transacciones, integridad, migraciones versionadas |
| Dinero | Enteros COP | Sin errores de coma flotante |
| Tiempos | UTC en BD; hora local del servidor para tarifas | El servidor de la sede debe tener la zona horaria del parqueadero |
| Auth | JWT (8 h) + permisos por acción en token | Sencillo, operable sin internet |
| Frontend | Next.js client-side + fetch a la API | Operación en red local; sin dependencia de SSR |

## Módulos del API

auth · users · catalog (tipos de vehículo) · tariffs (motor + versionado) · sessions (entradas/salidas/tickets) · shifts (caja/turnos) · payments · customers (clientes/convenios/mensualidades) · billing (adaptador facturación) · reports · audit · settings

## Estados de una estancia

```
ACTIVE ──(cobro en 1 transacción)──▶ CLOSED
  │                                   (pago + salida + snapshot + auditoría)
  ├──(anulación autorizada)─────────▶ CANCELLED
  └──(incidencia)────────────────────▶ INCIDENT
PENDING_PAYMENT y PAID existen para flujos donde pago y salida se separen en el futuro.
```

Los cambios de estado solo ocurren en el backend, con guardias de concurrencia
(`updateMany … where status IN (…)` dentro de transacción Serializable): dos terminales
no pueden cobrar la misma estancia.

## Motor de tarifas

- Funciones puras en `apps/api/src/modules/tariffs/tariff-engine.ts` (27 pruebas unitarias).
- Modos: por minuto, fracción, hora, día. Gracia, tope diario, franjas horarias (nocturna),
  precios por día de semana y fechas especiales, recargo por ticket perdido, impuesto %.
- **Versionado**: cada modificación crea una `TariffVersion` nueva; las anteriores se
  cierran con `validTo` y nunca se editan. Al cobrar se guarda un snapshot completo del
  cálculo en la estancia (`calculationSnapshot`): los históricos jamás cambian.

## Ticket y código de barras

- Formato: `PK-YYYYMMDD-NNNNNN-CCCC` (Code 128).
- `CCCC` = HMAC-SHA256 truncado con `TICKET_SIGNING_SECRET` → códigos falsificados no validan.
- No contiene precio, tarifa ni datos sensibles; es un identificador opaco.
- Consecutivo diario vía tabla `counters` (upsert con increment, seguro en concurrencia).

## Pago transaccional

`PaymentsService.confirmPayment` ejecuta en UNA transacción Serializable:
1. Releer estancia y validar estado.
2. **Recalcular el valor en el servidor** (nunca se confía en montos del cliente).
3. Validar medios de pago y que la suma coincida con el total.
4. Consecutivo de comprobante (`RC-######`).
5. Crear pago + asignaciones (pago mixto soportado).
6. Cerrar estancia con snapshot (guard de concurrencia).
7. Auditoría.

Idempotencia por `idempotencyKey` única: reintentos devuelven el pago original.
La factura se genera FUERA de la transacción: si el proveedor falla, el pago queda
intacto y la factura queda `PENDING` con cola de reintentos (`POST /billing/retry-pending`).

## Operación local / continuidad

Todo el núcleo (entradas, cobros, caja, impresión) funciona en red local sin internet.
Solo requieren internet: facturación electrónica real (cola de reintentos ya implementada),
respaldos remotos y actualizaciones.

## Entidades

Ver `apps/api/prisma/schema.prisma` — entidad central `parking_sessions` con índices en
placa, estado, fechas, código de ticket y comprobante.
