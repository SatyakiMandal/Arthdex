# Free online deployment

| Part | Host | Why |
|---|---|---|
| Website (Next.js) | Vercel Hobby | Free, built for Next.js. Hobby is for non-commercial use, which covers a development phase |
| Data service (FastAPI + torch) | Hugging Face Space, Docker, CPU Basic | Free with 2 vCPU, 16 GB RAM and 50 GB disk. The service needs torch and about 940 MB of models, so 512 MB hosts (Render, Koyeb free) cannot run it |

Oracle Cloud's free VM was rejected: its Always Free Arm allowance was cut to 2 OCPU / 12 GB in 2026 and idle instances can be reclaimed.

## Limits to accept

- **Sleep.** A free Space sleeps after 48 hours without traffic. The next visit wakes it in about a minute; the in-memory cache is cold and the unlisted/IPO warm-ups (30 to 60 s) run again.
- **Ephemeral disk.** Analyzer runs are lost whenever the Space restarts or sleeps. The 19 bundled sample reports (`backend/analyzer_samples`) are in the image and survive. Persistent storage is a paid add-on.
- **Upstream blocking.** NSE and Yahoo may throttle or block cloud IP ranges (see `operations.md`). Test after deploying: `/api/v1/market/indices` and a company quote. If the Space is blocked, the fix is a different host, not a code change.
- **Open analyzer.** Anyone who can reach the website can start analyzer runs (each takes minutes of CPU). Fine for a handful of testers; share the URL only with them, or add Vercel password protection later (a paid feature) or an app-level login.

## 1. Deploy the data service

1. Create a Hugging Face account, then **New Space**: SDK **Docker**, hardware **CPU basic (free)**, visibility **Private**. Note `<username>/<space-name>`.
2. Create a **write** access token (Settings, Access Tokens) for pushing, and a separate **fine-grained read** token for the website to call the private Space.
3. From the repo root:

   ```powershell
   powershell -File deploy/huggingface/push.ps1 -Space <username>/<space-name>
   ```

   Git asks for credentials: username is your HF username, password is the write token.
4. Watch the Space's **Logs** tab. The first build takes roughly 10 to 20 minutes (torch install plus the model download and verification).
5. The service URL is `https://<username>-<space-name>.hf.space`. Check it (the read token is needed because the Space is private):

   ```bash
   curl -H "Authorization: Bearer <read-token>" https://<username>-<space-name>.hf.space/api/v1/health
   ```

## 2. Deploy the website

1. Vercel, **Add New Project**, import `SatyakiMandal/Arthdex` from GitHub. Framework is detected as Next.js; keep the defaults.
2. Environment variables:

   | Name | Value |
   |---|---|
   | `ARTHDEX_API_URL` | `https://<username>-<space-name>.hf.space` |
   | `ARTHDEX_API_TOKEN` | the fine-grained **read** token |
   | `NEXT_PUBLIC_SITE_URL` | the Vercel URL, for example `https://arthdex.vercel.app` |

3. Deploy. Every push to `main` redeploys the website; the data service redeploys by re-running `push.ps1`.

`ARTHDEX_API_TOKEN` is optional in code: unset, no header is sent, which is what local development uses.

## 3. Verify

Follow the checklist at the end of `operations.md` against the Vercel URL. Pay particular attention to `/`, a company page with all tabs, `/ipo`, `/news` and `/analyzer` (run one analysis end to end).
