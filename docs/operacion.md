# Manual de operación

## Operador

### Empezar el día
1. Inicia sesión con tu usuario.
2. Ve a **Caja y turno** → escribe la base inicial de efectivo → **Abrir turno**.
   Sin turno abierto no puedes cobrar.

### Registrar una entrada
1. **Registrar entrada** → digita la placa (o déjala vacía si el vehículo no tiene:
   el sistema asigna un código temporal TMP-####).
2. Toca el tipo de vehículo.
   - **Moto hotel** y **Carro hotel** usan una tarifa especial con 50 % de descuento
     frente a la categoría normal correspondiente.
3. **Registrar e imprimir ticket** → entrega el ticket al cliente.
   (Color, marca, espacio y observación son opcionales — botón "+ Agregar datos opcionales".)

### Cobrar una salida
1. **Cobrar salida** — el campo de escaneo ya está listo, no toques nada.
2. Escanea el ticket. El sistema muestra placa, tiempo y total.
3. Elige el medio de pago:
   - **Efectivo**: escribe cuánto te entregan → el sistema calcula el cambio.
   - **Tarjeta / Transferencia**: directo.
   - **Pago mixto**: marca la casilla y reparte el valor entre dos medios.
4. **Confirmar pago** → se imprime el comprobante → **Listo — siguiente vehículo**.

Si el vehículo tiene **mensualidad activa**, el total sale en $0 automáticamente:
solo confirma la salida.

### Problemas frecuentes
| Situación | Qué hacer |
|---|---|
| El código no lee | Reintenta, o digítalo tal como aparece bajo el código de barras, o usa **Buscar por placa** |
| "Este ticket ya fue pagado" | El sistema muestra fecha y comprobante del pago. No se puede cobrar dos veces |
| Ticket perdido | Busca por placa → abre la estancia → **Ticket perdido** → pide a tu supervisor usuario y PIN. Se aplica el recargo configurado |
| Descuento | **Aplicar descuento** → requiere usuario y PIN de supervisor |
| Placa mal digitada | Abre la estancia (Vehículos dentro) → **Corregir placa** (supervisor) |
| No salió la impresión | El pago SÍ quedó registrado. Usa **Reimprimir comprobante** |

### Terminar el día
**Caja y turno** → cuenta el efectivo → **Cerrar turno** → escribe el efectivo contado →
el sistema calcula la diferencia → se imprime el resumen. Fírmalo y entrégalo.

## Supervisor

- Tu **PIN** autoriza: descuentos, cortesías, ticket perdido, anulaciones, corrección de placa
  y anulación de pagos. Cada autorización queda en auditoría con tu nombre.
- Revisa cierres en **Administración → Turnos** (diferencias marcadas en amarillo/rojo).

## Administrador

- **Tarifas**: cada modificación crea una versión nueva; lo ya cobrado nunca cambia.
- **Usuarios**: crea operadores con contraseña; a supervisores asígnales PIN.
- **Mensualidades**: se validan automáticamente al cobrar por placa. Alerta de vencimiento a 7 días.
- **Reportes**: filtros por fecha, agrupación por día/operador/medio, exportación CSV.
- **Auditoría**: todas las acciones sensibles con quién, cuándo, qué cambió y quién autorizó.
- **Facturas**: proveedor simulado activo; pendientes se reintentan con un clic.
