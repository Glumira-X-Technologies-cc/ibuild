# GluMira Production Builder: AI Studio interface (apps/ais-builder)

The AI Studio "GluMira Production Builder" screen design, wired to the real Production Builder server
(`server.js` in Vault 5, Row 5.13, Page-Prog-Production-Builder). Screen to route map: `SCREEN-MAP.md`.
One file per screen in `src/screens/`.

## One Builder

One process: `server.js` on http://127.0.0.1:3001 serves this page (built into `dist/`) and the API.
It runs as the Windows service `GlumiraProxy` from the main checkout `C:\Glumira-7.2`. There is no second
server on 3007, and daily use needs no Vite. The old dark page (`production-builder/index.html`) is retired
and no longer served. `dist/` is built on the machine and never committed: when it is missing, the Builder
shows a short notice with the build command.

After a pull on main, from `C:\Glumira-7.2` in PowerShell:

```powershell
cd apps\ais-builder; npm ci; npm run build
```

The service serves the new build at once (it reads `dist/` on every request). When `server.js` changed,
the service restarts itself (`PROXY_SELF_RELOAD=1`). If the header pill says "Builder offline", run the
command it shows, `Start-Service GlumiraProxy`, in PowerShell as administrator.

## Without the service

`start-ais-builder.cmd` builds the page, then opens the Builder on 3001. If the service already answers
there it only opens the browser; otherwise it starts `server.js` in that window.

## Editing the page

`npm run dev` starts Vite on http://127.0.0.1:5173 for live editing. It proxies `/api`, `/health` and `/v1`
to the Builder on 3001 (`BUILDER_URL` overrides it). Check before a pull request:

```powershell
npm ci; npm run lint; npm run build
```

## Desktop shortcut

The GlumiraProxy service starts the Builder with Windows and keeps it running on 3001, so the shortcut only
opens the page. It never starts a server: a second server on 3001 would clash with the service. The header
pill only shows whether the Builder answers.

The founder's shortcut, made 2026-10-15, opens the page as its own Chrome window:

```powershell
$app = 'C:\Glumira-7.2\apps\ais-builder'
$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Glumira Production Builder.lnk'
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$s.TargetPath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$s.Arguments = '--app=http://127.0.0.1:3001/'
$s.IconLocation = "$app\public\pb.ico,0"
$s.Save()
```

`start-ais-builder.cmd` stays for a machine without the service (see "Without the service" above). Do not
point a shortcut at it where the service runs.
