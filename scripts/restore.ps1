# Restauración de un respaldo
# Uso: .\scripts\restore.ps1 backups\parking_20260718_0800.sql
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $BackupFile)) {
  Write-Error "No existe el archivo: $BackupFile"
  exit 1
}

Write-Host "ADVERTENCIA: esto reemplaza TODOS los datos actuales de la base 'parking'." -ForegroundColor Yellow
$confirm = Read-Host "Escribe RESTAURAR para continuar"
if ($confirm -ne 'RESTAURAR') { Write-Host 'Cancelado.'; exit 0 }

docker exec parking-db psql -U parking -d postgres -c "DROP DATABASE IF EXISTS parking WITH (FORCE);"
docker exec parking-db psql -U parking -d postgres -c "CREATE DATABASE parking OWNER parking;"
Get-Content $BackupFile -Raw | docker exec -i parking-db psql -U parking -d parking

Write-Host "Restauración completada desde $BackupFile"
