# publish.ps1 — bump version, commit, and push to GitHub Pages
# Usage: Right-click → Run with PowerShell
#        Or in terminal: .\publish.ps1
#        With message:   .\publish.ps1 "what changed"

param([string]$Message = "")

Set-Location $PSScriptRoot

# ── Read current version from sw.js ──
$swContent = Get-Content "sw.js" -Raw
if ($swContent -match "eleague-v(\d+)") {
    $currentNum = [int]$Matches[1]
} else {
    Write-Host "ERROR: Could not find version in sw.js" -ForegroundColor Red
    exit 1
}

$newNum     = $currentNum + 1
$oldVersion = "v$currentNum"
$newVersion = "v$newNum"

Write-Host ""
Write-Host "  Bumping $oldVersion → $newVersion" -ForegroundColor Cyan
Write-Host ""

# ── Update version in all 3 files ──
function Replace-InFile($path, $old, $new) {
    $content = Get-Content $path -Raw
    if ($content -notmatch [regex]::Escape($old)) {
        Write-Host "  WARNING: '$old' not found in $path" -ForegroundColor Yellow
        return
    }
    $content -replace [regex]::Escape($old), $new | Set-Content $path -Encoding UTF8 -NoNewline
    Write-Host "  Updated $path" -ForegroundColor Green
}

Replace-InFile "sw.js"        "eleague-$oldVersion"           "eleague-$newVersion"
Replace-InFile "index.html"   "const APP_VERSION = '$oldVersion'"   "const APP_VERSION = '$newVersion'"
Replace-InFile "admin.html"   "const CURRENT_APP_VERSION = '$oldVersion'" "const CURRENT_APP_VERSION = '$newVersion'"

# ── Build commit message ──
if ($Message -eq "") {
    $Message = Read-Host "`n  Commit message (or press Enter for default)"
}
if ($Message -eq "") {
    $Message = "Release $newVersion"
}
$fullMessage = "$Message — $newVersion`n`nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

# ── Git add, commit, push ──
Write-Host ""
git add sw.js index.html admin.html
git commit -m $fullMessage
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n  ERROR: git commit failed" -ForegroundColor Red
    exit 1
}

git push
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n  ERROR: git push failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  Done! $newVersion is live at league.getgol.in" -ForegroundColor Green
Write-Host ""
