# Estrategia de impresión

## Estado actual (v1): impresión por navegador

- Plantillas HTML a 72 mm con CSS `@media print` (ticket de entrada, comprobante de pago,
  cierre de turno) en `apps/web/src/app/print/…`.
- Al registrar entrada / confirmar pago se abre una ventana que llama `window.print()`.
- Código de barras Code 128 renderizado como SVG (JsBarcode) — nítido en térmicas.
- Funciona con cualquier impresora térmica de 80 mm instalada como impresora del sistema
  (driver del fabricante o driver genérico "Generic / Text Only" NO — usar driver gráfico).

**Configuración recomendada del navegador del puesto de trabajo** (Chrome/Edge):
1. Instalar la impresora térmica en Windows.
2. En el diálogo de impresión: seleccionar la térmica, márgenes "Ninguno", desactivar
   encabezados/pies. Chrome recuerda la última configuración.
3. Para eliminar el diálogo por completo, lanzar el navegador del kiosco con
   `--kiosk-printing` (imprime directo a la impresora predeterminada).

## Mejora recomendada: QZ Tray (pendiente de datos de hardware)

Cuando se conozca **modelo exacto de impresora y sistema operativo del puesto**, se puede
integrar [QZ Tray](https://qz.io) para imprimir ESC/POS directo (sin diálogo, corte de
papel, cajón monedero). La arquitectura ya lo permite: las plantillas están separadas y
solo cambiaría la capa de salida.

Alternativas evaluadas:
- **Servicio local Node** con `escpos`/USB — más control, más mantenimiento.
- **Impresión por navegador** (actual) — cero instalación, diálogo o kiosk-printing.

## Reimpresiones

Toda reimpresión exige motivo y queda en auditoría (`TICKET_REPRINT`) — tanto la de
ticket como la de comprobante.
