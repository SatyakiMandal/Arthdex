# Installing and running Arthdex on a fresh Windows machine

PowerShell commands, start to finish: from a bare Windows 10/11 install to the site running in a browser.

**Verified.** These steps were run on a clean clone with a new virtual environment: `pip install -r backend/requirements.txt` (clean, `pip check` reports no conflicts), the backend unit tests pass, the data service boots and answers, the FinBERT and GoEmotions models download into an empty cache and then verify offline, and `npm ci`, `npm run typecheck`, `npm run build` and `npm run start` (production mode) work with the pages `/`, `/market-watch`, `/company/GRSE`, `/unlisted`, `/analyzer` and `/ipo` returning HTTP 200. Not re-run on the test machine: the `winget` installs in step 1 (it already had the tools; the package IDs were confirmed with `winget search`) and development mode (`npm run dev`).

What you are installing:

| Part | Folder | Technology | Port |
|---|---|---|---|
| Data service | `backend/` | Python 3.12+ / FastAPI, dependencies in `backend/requirements.txt` | 8000 |
| Website | repository root | Node.js / Next.js 15, dependencies in `package.json` + `package-lock.json` | 3000 |

The website calls the data service from its own server, so both must be running.

Use a normal (non-administrator) **Windows PowerShell or PowerShell 7** window for everything below. No execution-policy change is needed because the commands call `python.exe` directly instead of activating the virtual environment.

---

## 1. Install the prerequisites (Git, Python, Node.js)

```powershell
winget install -e --id Git.Git
winget install -e --id Python.Python.3.14
winget install -e --id OpenJS.NodeJS.LTS
```

`winget` ships with current Windows 10/11. If it is missing, install "App Installer" from the Microsoft Store, or download the three installers from git-scm.com, python.org and nodejs.org (tick "Add python.exe to PATH" in the Python installer).

**Close PowerShell and open a new window** so the new programs are on the PATH, then check:

```powershell
git --version
python --version      # 3.12 or newer. The project was tested on 3.14.6
node --version        # 18.18 or newer. Tested on v24
npm --version
```

If `python` opens the Microsoft Store or prints nothing, turn off the aliases under *Settings → Apps → Advanced app settings → App execution aliases* ("python.exe" and "python3.exe"), or use the launcher everywhere below: `py -3.14` instead of `python`.

## 2. Get the code

```powershell
New-Item -ItemType Directory -Force C:\Dev | Out-Null
Set-Location C:\Dev
git clone https://github.com/SatyakiMandal/Arthdex.git
Set-Location C:\Dev\Arthdex
```

## 3. Install the data service (Python)

```powershell
Set-Location C:\Dev\Arthdex\backend

# Private virtual environment, so nothing is installed system-wide
python -m venv .venv

# Newer pip, then every pinned dependency from requirements.txt
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

This downloads about 1 GB (almost all of it PyTorch) and takes a few minutes on a first run. Then confirm it:

```powershell
.\.venv\Scripts\python.exe -m pip check                       # expect: No broken requirements found.
.\.venv\Scripts\python.exe -m unittest discover -s tests      # expect: Ran 16 tests ... OK
.\.venv\Scripts\python.exe -c "import app.main, ceia.analyze; print('imports ok')"
```

### Download and verify the language models (do this once)

The Analyzer scores news with two transformer models: **FinBERT** (tone) and **GoEmotions** (emotion tags), about 940 MB in total. Download them now, so the first analysis does not have to, and prove they work:

```powershell
Set-Location C:\Dev\Arthdexackend
.\.venv\Scripts\python.exe scripts\download_models.py
```

Expected ending (the sentence scores will be close to these):

```
finbert     OK  438 MB on disk  ->  negative (0.90), positive (0.93), neutral (0.92)
goemotions  OK  502 MB on disk  ->  top labels: neutral (0.73), excitement (0.08), approval (0.05)

Both models are installed and verified. Analyses will use FinBERT and GoEmotions.
```

What the script does: downloads each model at the exact revision pinned in `backend/ceia/models_registry.py` into `%USERPROFILE%\.cache\huggingface`, then loads it offline and runs a check (FinBERT must read "beat profit expectations but missed guidance on margins" as negative). It exits with a non-zero code and says what is wrong if either model fails. Run it again any time with `--check` to re-verify without downloading, or `--force` to re-download.

**There is no silent downgrade.** When `torch` and `transformers` are installed, the models are *required*: if one cannot be loaded the analysis stops with a clear "Language model unavailable" message instead of quietly scoring with a simple word list. If you skip this step, the data service downloads the models itself before the first run that needs them. The Analyzer page shows which engine the next run will use, and so does `GET http://127.0.0.1:8000/api/v1/analyzer/models`.

### Smaller install without the language models (optional)

Skip this only if you do not need the full Analyzer. Without PyTorch and `transformers` the engine scores news with a simple word list and skips emotion tags (the Analyzer page shows a notice and the run log says so); everything else on the site works. This cuts the install from about 1.1 GB to about 0.4 GB.

```powershell
Set-Location C:\Dev\Arthdex\backend
Get-Content requirements.txt |
  Where-Object { $_ -notmatch '\[ml-only\]' -and $_ -notmatch '^(torch|transformers)==' } |
  Set-Content requirements-light.txt -Encoding utf8
.\.venv\Scripts\python.exe -m pip install -r requirements-light.txt
```

### Development tools (optional)

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt     # adds ruff
.\.venv\Scripts\python.exe -m ruff check app
```

## 4. Install the website (Node)

```powershell
Set-Location C:\Dev\Arthdex

# Exact versions from package-lock.json
npm ci --no-audit --no-fund

# Tell the website where the data service is
Copy-Item .env.example .env.local
Get-Content .env.local      # ARTHDEX_API_URL=http://127.0.0.1:8000
```

`npm` may print "allow-scripts ... unrs-resolver" warnings. They are informational and do not affect the build.

Check the code compiles:

```powershell
npm run typecheck
```

## 5. Run it

Open **two** PowerShell windows, or let one command open them for you:

```powershell
$repo = "C:\Dev\Arthdex"

# Window 1: data service on http://127.0.0.1:8000
Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location '$repo\backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"

# Window 2: website on http://localhost:3000 (development mode, auto-reloads on edits)
Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location '$repo'; npm run dev"
```

Wait about 15 seconds, then verify and open the site:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health      # status : ok
Start-Process "http://localhost:3000"
```

Interactive API documentation is at <http://127.0.0.1:8000/docs>.

### Production mode instead of development mode

```powershell
Set-Location C:\Dev\Arthdex
npm run build          # about 3 minutes the first time
npm run start          # serves the optimised build on http://localhost:3000
```

Do not run `npm run build` while `npm run dev` is running in the same folder; stop the dev server first.

### What to expect the first time

- The data service warms two things in the background after it starts: the IPO pipeline (about a minute) and the unlisted-company directory (about 30 to 55 seconds). The first visit to `/ipo` or `/unlisted` can be slow until they finish.
- If you ran `download_models.py` (step 3), the models are already on disk and load offline. The **first Analyzer run** still crawls news sites without a cache, so expect 15 minutes or more once; later runs for the same company are much faster. If you skipped the download, the run first fetches the models (about 940 MB) and its progress shows "Downloading language models".
- Market data comes from Yahoo Finance and NSE and needs internet access. Prices are delayed about 15 minutes, and outside market hours some panels show the last session.

## 6. Stop, restart, update

```powershell
# Stop (closes whatever is listening on the two ports)
foreach ($port in 8000, 3000) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
}

# Update to the latest code and dependencies
Set-Location C:\Dev\Arthdex
git pull
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
npm ci --no-audit --no-fund
```

## 7. Configuration

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `ARTHDEX_API_URL` | `.env.local` | `http://127.0.0.1:8000` | Address of the data service (website side) |
| `ARTHDEX_ANALYZER_CONCURRENCY` | environment of the data service | `2` | Simultaneous analyses |
| `ARTHDEX_ANALYZER_TIMEOUT` | environment of the data service | `5400` | Seconds before an analysis is killed |
| `ARTHDEX_QUOTE_TTL`, `ARTHDEX_CANDLES_TTL` | environment of the data service | `60`, `900` | Cache lifetimes in seconds |
| `ARTHDEX_ML` | environment of the data service | `auto` | `auto`: use FinBERT/GoEmotions whenever torch + transformers are installed, and refuse to run without them; `required`: always insist; `off`: use the word-list scorer on purpose |
| `HF_HOME` | environment | `%USERPROFILE%\.cache\huggingface` | Where the language models are stored |
| `ALPHAVANTAGE_API_KEY` | environment of the data service | unset | Optional price fallback |

Example: run the data service with a different analyzer limit.

```powershell
Set-Location C:\Dev\Arthdex\backend
$env:ARTHDEX_ANALYZER_CONCURRENCY = "1"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `winget` is not recognised | Install "App Installer" from the Microsoft Store, or use the vendors' installers |
| `python` / `node` not recognised after installing | Open a **new** PowerShell window; check *Environment variables → Path* |
| `python` opens the Microsoft Store | Disable the App execution aliases (step 1) or use `py -3.14` |
| `pip install` fails with a build error or "no matching distribution" | Use 64-bit Python 3.12 or newer (the pins were resolved on 3.14); 32-bit or older Pythons are unsupported |
| Every page says "Cannot reach the data service" | Window 1 is not running, or `.env.local` points to the wrong address. Check `Invoke-RestMethod http://127.0.0.1:8000/api/v1/health` |
| `Port 8000 (or 3000) is already in use` | Find it: `Get-NetTCPConnection -LocalPort 8000 -State Listen`, stop it with `Stop-Process -Id <OwningProcess>`, or pick another port (`--port 8001` and change `.env.local`; `npm run dev -- -p 3001`) |
| Windows Firewall prompt | Allow on private networks; the services only listen on localhost by default |
| Page shows old data after a fix | Stop `npm run dev`, delete the `.next` folder (`Remove-Item -Recurse -Force .next`), start again |
| `__webpack_modules__[moduleId] is not a function` | A production build ran while the dev server was live. Same fix as above |
| First analysis seems stuck | It is downloading the language models (if step 3 was skipped) and crawling; watch the stage and log on the run page |
| Run fails with "Language model unavailable" | The models are missing or damaged. Run `python scripts\download_models.py` from `backend` (needs internet and about 1 GB of free disk). To use the word-list scorer deliberately, set `$env:ARTHDEX_ML = "off"` before starting the service |
| Models must work offline | After `download_models.py` succeeds they load without network access. Set `$env:HF_HUB_OFFLINE = "1"` to enforce it |

## 9. Optional: PDF export of analyses

Not used by the website. If you want it from the engine's command line:

```powershell
Set-Location C:\Dev\Arthdex\backend
.\.venv\Scripts\python.exe -m pip install playwright==1.63.0
.\.venv\Scripts\python.exe -m playwright install chromium
```
