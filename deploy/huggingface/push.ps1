<#
  Publish backend/ to a Hugging Face Space.
  Usage (from the repo root):
      powershell -File deploy/huggingface/push.ps1 -Space <hf-username>/<space-name>
  Requires git and a Hugging Face write token (git asks for it as the password).
#>
param([Parameter(Mandatory)][string]$Space)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$work = Join-Path $env:TEMP "arthdex-space"

if (Test-Path $work) { Remove-Item $work -Recurse -Force }
git clone "https://huggingface.co/spaces/$Space" $work

# Local data (app_data, SQLite files) and secrets (.env*, keys) never leave this machine.
# Replace the Space contents with backend/ + Dockerfile + Space card.
Get-ChildItem $work -Force | Where-Object Name -ne ".git" | Remove-Item -Recurse -Force
robocopy "$root\backend" $work /E /XD .venv __pycache__ analyzer_data app_data cache .cache .pytest_cache .ruff_cache tests /XF *.pyc .env .env.* *.db *.sqlite *.sqlite3 *.pem *.key | Out-Null
Copy-Item "$PSScriptRoot\Dockerfile" "$work\Dockerfile"
Copy-Item "$PSScriptRoot\SPACE_README.md" "$work\README.md"

Push-Location $work
git add -A
git commit -m "Deploy Arthdex data service" 2>$null
git push
Pop-Location
