# Respaldo de la base de datos del parqueadero
# Uso: .\scripts\backup.ps1  (desde la raíz del proyecto)
$ErrorActionPreference = 'Stop'

$stamp = Get-Date -Format 'yyyyMMdd_HHmm'
$backupDir = Join-Path $PSScriptRoot '..\backups'
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
$file = Join-Path $backupDir "parking_$stamp.sql"

docker exec parking-db pg_dump -U parking -d parking > $file

if ($LASTEXITCODE -eq 0) {
  Write-Host "Respaldo creado: $file"
} else {
  Write-Error "Fallo el respaldo. ¿Está corriendo el contenedor parking-db?"
}
