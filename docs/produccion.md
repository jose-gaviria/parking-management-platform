# Producción

## Checklist antes de salir a producción

1. **Secretos**: genera valores propios en `.env`:
   ```bash
   # JWT_SECRET y TICKET_SIGNING_SECRET
   openssl rand -hex 32
   ```
2. **BD**: contraseña real en `POSTGRES_PASSWORD` + `DATABASE_URL`.
3. **CORS**: `CORS_ORIGIN` = URL real del frontend.
4. **HTTPS**: coloca un reverse proxy (Caddy o Nginx) delante de web (3001) y API (4000).
5. **Zona horaria**: el servidor debe tener la TZ del parqueadero (los cálculos de
   franjas y días usan hora local del servidor).
6. Ejecuta migraciones con `prisma migrate deploy` (nunca `migrate dev` en producción).
7. NO ejecutes el seed de demostración en producción; crea el usuario admin real
   y cambia su contraseña.

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

```powershell
# Respaldo (scripts/backup.ps1)
.\scripts\backup.ps1           # crea backups/parking_YYYYMMDD_HHmm.sql

# Restauración (scripts/restore.ps1)
.\scripts\restore.ps1 backups\parking_20260718_0800.sql
```

Programa el backup diario (Task Scheduler / cron) y copia los archivos a otro equipo
o nube. Los respaldos contienen datos financieros: protégelos y cífralos si salen
de la sede.

## Operación sin internet

El sistema opera 100 % en red local (entradas, cobros, caja, impresión). Si hay
facturación electrónica real configurada y no hay internet, las facturas quedan
`PENDING` y se reenvían con **Administración → Facturas → Reintentar pendientes**
(o automatizable con una tarea programada llamando `POST /billing/retry-pending`).

## Monitoreo mínimo

- Logs del API (stdout) — rota con el servicio.
- `GET /settings/public` como healthcheck básico de API + BD.
- Vigila el volumen Docker `parking_db_data` (espacio en disco).
