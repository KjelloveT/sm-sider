# Git- og deploy-oppsett

Repoet er allereie sett opp og kopla til GitHub og Azure. Denne fila skildrar oppsettet og kva som må gjerast på ei ny maskin.

## Oversikt

| | |
|---|---|
| GitHub | `https://github.com/KjelloveT/smasider` |
| Produksjon | `https://icy-water-0487ac303.2.azurestaticapps.net/` |
| Hosting | Azure Static Web Apps (gratisplan), rein filopplasting utan byggsteg |
| Workflow | `.github/workflows/azure-static-web-apps-icy-water-0487ac303.yml` |
| Hosting-config | `staticwebapp.config.json` (rutar, tryggingsheadarar, CSP) |

`main` er verna: direkte push blir avvist, alt går via pull request. Sjølve arbeidsflyten er dokumentert i **`AGENTS.md` §6.4** — den er fasit, ikkje denne fila.

## Deploy

Deployen er automatisk og treng ingen handpåleggjing:

- **Push til `main`** → produksjon blir oppdatert (typisk 1–2 minutt).
- **Pull request mot `main`** → Azure lagar eit eige preview-miljø på `https://icy-water-0487ac303-<PR-nummer>.2.azurestaticapps.net/` og legg URL-en som kommentar i PR-en. Der skal endringar testast før merge.
- **PR merga eller lukka** → preview-miljøet blir automatisk sletta av `close_pull_request_job`.

Deploy-nøkkelen ligg som repo-hemmelegheit `AZURE_STATIC_WEB_APPS_API_TOKEN_ICY_WATER_0487AC303` på GitHub.

## Oppsett på ei ny maskin

```bash
git clone https://github.com/KjelloveT/smasider.git
cd smasider
git config user.name "Ditt Namn"
git config user.email "din.epost@example.com"
```

GitHub CLI trengst for PR-flyten:

```bash
winget install --id GitHub.cli -e
```

Opne ein **ny** terminal etterpå (installasjonen oppdaterer PATH, men ikkje vindauge som allereie er opne), og logg inn:

```bash
gh auth login
```

Vel GitHub.com → HTTPS → Login with a web browser.

## Lokal utvikling

Repoet har ingen `package.json` og ingen byggsteg — det er rein statisk HTML, CSS og vanilla JS. Start ein lokal filservar med:

```bash
powershell -File serve.ps1
```

Sida ligg då på `http://localhost:8081`. `serve_alt.ps1` og `serve_preview.ps1` gjer det same på andre portar når du vil køyre fleire samtidig.

Merk at den lokale servaren **ikkje** brukar `staticwebapp.config.json`. Rutar, tryggingsheadarar og CSP blir difor berre testa på preview-URL-en frå ein pull request.
