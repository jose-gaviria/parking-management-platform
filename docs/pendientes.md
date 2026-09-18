# Información pendiente del negocio

Estos datos NO se inventaron; el sistema funciona con valores de demostración
configurables. Cuando existan, se configuran sin tocar código (o con integración puntual).

## Para configurar en Administración → Configuración (o seed real)

- [ ] Nombre legal y comercial del parqueadero
- [ ] Dirección y teléfono (aparecen en tickets y comprobantes)
- [ ] Logotipo y colores corporativos (hoy: identidad neutra azul)
- [ ] Texto legal / condiciones del ticket
- [ ] Tarifas reales por tipo de vehículo (hoy: tarifas demo)
- [ ] Recargo real por ticket perdido
- [ ] IVA u otros impuestos aplicables (hoy: 0 %)

## Para integraciones de hardware

- [ ] Modelo exacto de la impresora térmica y SO del puesto → decide integración QZ Tray
      vs impresión de navegador con `--kiosk-printing` (ver docs/impresion.md)
- [ ] Modelo del lector de código de barras (se asume HID teclado con Enter final —
      estándar; cualquier lector USB común funciona ya)
- [ ] ¿Cajón monedero? (se integra junto con la impresora vía ESC/POS)

## Para facturación electrónica

- [ ] Proveedor tecnológico (nombre, documentación, credenciales, ambiente de pruebas)
- [ ] Datos tributarios: NIT, régimen, resolución de facturación, prefijo, numeración
- [ ] Reglas DIAN aplicables (NO se asumieron obligaciones)

La arquitectura de adaptador (`BillingProvider`) está lista: implementar
`createInvoice / getInvoiceStatus / cancelInvoice` para el proveedor real y
registrarlo en `billing.module.ts`.

## Decisión de negocio pendiente: convenios

El modelo, los endpoints y el medio de pago `AGREEMENT` existen, pero **ningún
cobro aplica un convenio todavía**. Falta definir cómo se detecta:

- [ ] ¿Por placa registrada, como la mensualidad?
- [ ] ¿Por cliente identificado en la entrada?
- [ ] ¿Lo elige el operador al cobrar, con autorización?

Hasta responderlo no se implementa. Ver A1 en [auditoria.md](auditoria.md).

## Anulación de pagos y facturación electrónica

Al anular un pago, el sistema marca la factura local como `CANCELLED`. Con un
proveedor real de facturación electrónica eso **no basta**: una factura aceptada se
corrige con nota crédito. Al integrar el proveedor hay que añadir
`createCreditNote` al adaptador `BillingProvider` y llamarlo desde la anulación.

## Mejoras técnicas propuestas (no bloqueantes)

- [ ] Pruebas de servicios de dinero (pagos, anulación, cierre de turno) — hoy solo
      hay pruebas de funciones puras. Prioridad alta: ver A8 en [auditoria.md](auditoria.md)
- [ ] Pruebas E2E con Playwright de los flujos operador
- [ ] Agregar los reportes en SQL en lugar de en memoria (A6)
- [ ] Cálculo cerrado en el motor de tarifas para estancias largas (A3)
- [ ] Fijar la precedencia entre franjas horarias y fechas especiales, con test (A4)
- [ ] Exportación a Excel/PDF en reportes (hoy: CSV)
- [ ] Fotografía del vehículo en la entrada (campo `photoUrl` ya existe en BD)
- [ ] Notificaciones sonoras del lector
- [ ] Cron interno para reintento automático de facturas pendientes
- [ ] Dockerfiles de producción para API y web (hoy: build nativo documentado)
