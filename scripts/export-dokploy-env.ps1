param([string]$OutputPath = ".env.dokploy.local")

$ErrorActionPreference = "Stop"

function Get-RailwayVariables {
    param([Parameter(Mandatory)][string]$Service)
    $json = & railway.cmd variables --service $Service --json
    if ($LASTEXITCODE -ne 0) { throw "Railway variables could not be read for '$Service'." }
    $object = $json | ConvertFrom-Json
    $variables = @{}
    foreach ($property in $object.PSObject.Properties) {
        $variables[$property.Name] = $property.Value
    }
    return $variables
}

function New-RandomSecret {
    param([int]$Bytes = 32)
    $buffer = New-Object byte[] $Bytes
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
    return -join ($buffer | ForEach-Object { $_.ToString("x2") })
}

function ConvertTo-DotEnvValue {
    param([AllowNull()][object]$Value)
    if ($null -eq $Value) { return "" }
    $text = [string]$Value
    if ($text.Contains("`r") -or $text.Contains("`n")) { throw "Multiline environment values are unsupported." }
    if ($text -match '[\s#"''`$\\]') {
        $escaped = $text.Replace('\', '\\').Replace('"', '\"').Replace('$', '$$')
        return '"' + $escaped + '"'
    }
    return $text
}

$backend = Get-RailwayVariables -Service "backend"
$frontend = Get-RailwayVariables -Service "frontend"
$bot = Get-RailwayVariables -Service "telegram-bot"
$renderer = Get-RailwayVariables -Service "media-renderer"

$postgresUser = "bestteam"
$postgresDatabase = "best_team_news"
$postgresPassword = New-RandomSecret -Bytes 24

$variables = [ordered]@{
    POSTGRES_USER = $postgresUser
    POSTGRES_PASSWORD = $postgresPassword
    POSTGRES_DB = $postgresDatabase
    DATABASE_URL = "postgresql://${postgresUser}:${postgresPassword}@postgres:5432/${postgresDatabase}?schema=public"
    REDIS_URL = "redis://redis:6379"
    NODE_ENV = "production"
    JWT_ACCESS_SECRET = $backend.JWT_ACCESS_SECRET
    JWT_REFRESH_SECRET = $backend.JWT_REFRESH_SECRET
    BOT_SERVICE_SECRET = $backend.BOT_SERVICE_SECRET
    ADMIN_EMAIL = $backend.ADMIN_EMAIL
    ADMIN_PASSWORD = $backend.ADMIN_PASSWORD
    EDITOR_PASSWORD = $backend.EDITOR_PASSWORD
    BOT_ADMIN_IDS = if ($bot.BOT_ADMIN_IDS) { $bot.BOT_ADMIN_IDS } else { $backend.BOT_ADMIN_IDS }
    FRONTEND_URL = "https://jahonxabarlari.uz"
    FRONTEND_URLS = "https://jahonxabarlari.uz,https://www.jahonxabarlari.uz"
    BACKEND_PUBLIC_URL = "https://api.jahonxabarlari.uz"
    NEXT_PUBLIC_API_URL = "https://api.jahonxabarlari.uz/api"
    NEXT_PUBLIC_SITE_URL = "https://jahonxabarlari.uz"
    ADMIN_PANEL_URL = "https://jahonxabarlari.uz/admin"
    GOOGLE_SITE_VERIFICATION = $frontend.GOOGLE_SITE_VERIFICATION
    NEXT_PUBLIC_GA_MEASUREMENT_ID = $frontend.NEXT_PUBLIC_GA_MEASUREMENT_ID
    VAPID_PUBLIC_KEY = $backend.VAPID_PUBLIC_KEY
    VAPID_PRIVATE_KEY = $backend.VAPID_PRIVATE_KEY
    VAPID_SUBJECT = $backend.VAPID_SUBJECT
    WEATHERAPI_API_KEY = $backend.WEATHERAPI_API_KEY
    OPENWEATHER_API_KEY = $backend.OPENWEATHER_API_KEY
    OPENAI_API_KEY = if ($bot.OPENAI_API_KEY) { $bot.OPENAI_API_KEY } else { $backend.OPENAI_API_KEY }
    BOT_TOKEN = $bot.BOT_TOKEN
    TELEGRAM_CHANNEL_BOT_TOKEN = $backend.TELEGRAM_CHANNEL_BOT_TOKEN
    TELEGRAM_CHANNEL_POSTING_ENABLED = $backend.TELEGRAM_CHANNEL_POSTING_ENABLED
    TELEGRAM_NEWS_CHANNEL = $backend.TELEGRAM_NEWS_CHANNEL
    TELEGRAM_CHANNEL_CUSTOM_EMOJI_ID = $backend.TELEGRAM_CHANNEL_CUSTOM_EMOJI_ID
    TELEGRAM_CHANNEL_CUSTOM_EMOJI_ALT = $backend.TELEGRAM_CHANNEL_CUSTOM_EMOJI_ALT
    FORWARD_CONCURRENCY = if ($bot.FORWARD_CONCURRENCY) { $bot.FORWARD_CONCURRENCY } else { "5" }
    MEDIA_GROUP_DELAY_SECONDS = if ($bot.MEDIA_GROUP_DELAY_SECONDS) { $bot.MEDIA_GROUP_DELAY_SECONDS } else { "2.5" }
    INSTAGRAM_POSTING_ENABLED = $backend.INSTAGRAM_POSTING_ENABLED
    INSTAGRAM_ACCESS_TOKEN = $backend.INSTAGRAM_ACCESS_TOKEN
    INSTAGRAM_USER_ID = $backend.INSTAGRAM_USER_ID
    INSTAGRAM_API_MODE = if ($backend.INSTAGRAM_API_MODE) { $backend.INSTAGRAM_API_MODE } else { "instagram_login" }
    INSTAGRAM_GRAPH_API_VERSION = if ($backend.INSTAGRAM_GRAPH_API_VERSION) { $backend.INSTAGRAM_GRAPH_API_VERSION } else { "v24.0" }
    INSTAGRAM_WORKER_CONCURRENCY = "1"
    MEDIA_RENDERER_URL = "https://media.jahonxabarlari.uz"
    MEDIA_RENDERER_SECRET = if ($renderer.MEDIA_RENDERER_SECRET) { $renderer.MEDIA_RENDERER_SECRET } else { $backend.MEDIA_RENDERER_SECRET }
    MAX_CONCURRENT_RENDERS = "1"
    NEWS_AGGREGATOR_ENABLED = $backend.NEWS_AGGREGATOR_ENABLED
    NEWS_AGGREGATOR_INTERVAL_MINUTES = if ($backend.NEWS_AGGREGATOR_INTERVAL_MINUTES) { $backend.NEWS_AGGREGATOR_INTERVAL_MINUTES } else { "5" }
    SEED_DEMO_CONTENT = "false"
}

$required = @("JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "BOT_SERVICE_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD", "BOT_ADMIN_IDS", "BOT_TOKEN", "MEDIA_RENDERER_SECRET")
$missing = $required | Where-Object { [string]::IsNullOrWhiteSpace([string]$variables[$_]) }
if ($missing.Count -gt 0) { throw "Required variables are missing: $($missing -join ', ')" }

$lines = foreach ($entry in $variables.GetEnumerator()) {
    "$($entry.Key)=$(ConvertTo-DotEnvValue $entry.Value)"
}
$resolvedPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
[System.IO.File]::WriteAllLines($resolvedPath, $lines, [System.Text.UTF8Encoding]::new($false))
Write-Host "Dokploy environment exported to $resolvedPath"
