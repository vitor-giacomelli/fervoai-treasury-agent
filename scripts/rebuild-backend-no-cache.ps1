param(
    [string]$ServiceName = "backend"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

Push-Location $RepoRoot
try {
    Write-Host "[1/4] Stopping and removing service container: $ServiceName"
    try {
        docker compose rm -fsv $ServiceName | Out-Host
    } catch {
        Write-Host "No existing container to remove for service '$ServiceName'. Continuing..."
    }

    Write-Host "[2/4] Rebuilding service image with no cache: $ServiceName"
    docker compose build --no-cache $ServiceName | Out-Host

    Write-Host "[3/4] Starting service: $ServiceName"
    docker compose up -d $ServiceName | Out-Host

    Write-Host "[4/4] Current status:"
    docker compose ps $ServiceName | Out-Host

    Write-Host "Done. Backend service was rebuilt with no cache and restarted."
} finally {
    Pop-Location
}
