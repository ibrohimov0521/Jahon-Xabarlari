param(
  [string]$Output = (Join-Path $PSScriptRoot "..\backups\railway-production.dump")
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) { throw "$Name topilmadi. PostgreSQL 16 client vositalarini o'rnating." }
  return $command.Source
}

$pgDump = Require-Command "pg_dump"
$pgRestore = Require-Command "pg_restore"
$railway = Require-Command "railway"

$variables = & $railway variables --service Postgres --environment production --json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Railway PostgreSQL sozlamalarini olish amalga oshmadi." }
$databaseUrl = $variables.DATABASE_PUBLIC_URL
if (-not $databaseUrl) { $databaseUrl = $variables.DATABASE_URL }
if (-not $databaseUrl) { throw "Railway DATABASE_PUBLIC_URL topilmadi." }

$outputPath = [System.IO.Path]::GetFullPath($Output)
$outputDirectory = Split-Path -Parent $outputPath
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

Write-Host "Railway bazasi xavfsiz dump qilinmoqda..."
& $pgDump --format=custom --compress=6 --no-owner --no-acl --file=$outputPath $databaseUrl
if ($LASTEXITCODE -ne 0) { throw "pg_dump xato bilan tugadi." }

& $pgRestore --list $outputPath | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Yaratilgan dump tekshiruvdan o'tmadi." }

$sizeMb = [math]::Round((Get-Item $outputPath).Length / 1MB, 2)
Write-Host "Backup tayyor: $outputPath ($sizeMb MB)"
