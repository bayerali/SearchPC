# Produktions Dashboard

Statische React-App für Schicht-Aktivitäten mit Eltern/Kind-Gruppierung (MO Start / MO Ende),
Bedienern, Bild-Nachweisen und KPIs. Alle Daten werden lokal im Browser
(`localStorage`) gespeichert — kein Backend nötig.

**Live**: <https://bayerali.github.io/ProduktionsDashboard/>

## Stack

- Vite + React 19 + TypeScript
- LocalStorage als einzige Datenquelle (kein Server, keine Datenbank)
- Hash-Routing (`#/`, `#/shift/:id`, `#/activities`) — funktioniert problemlos
  unter GitHub Pages

## Lokal starten

```bash
npm install
npm run dev
```

Öffnet sich auf <http://localhost:5173>.

## Build

```bash
npm run build
npm run preview
```

## Deploy nach GitHub Pages

Es gibt zwei Wege.

### Option A — Automatisch via GitHub Actions (empfohlen)

1. Push den Code nach `main` auf
   <https://github.com/bayerali/ProduktionsDashboard>.
2. Im Repo: **Settings → Pages → Source: "GitHub Actions"**.
3. Bei jedem Push baut die Action den Code und deployed ihn automatisch.

### Option B — Manuell vom Terminal aus

```bash
npm run deploy
```

Dies baut die App und pusht den Inhalt von `dist/` in den `gh-pages`-Branch.
Anschließend im Repo: **Settings → Pages → Source: "Deploy from a branch" →
Branch: `gh-pages` / `/ (root)`**.

## Daten zurücksetzen

Im Aktivitäten-Tab oben rechts: **⟲ Zurücksetzen** — löscht alle Schichten und
stellt die Standard-Stammliste wieder her.

## Speicherort der Daten

Alle Daten (Schichten, Bedingungsbilder als base64, Aktivitäten) liegen
ausschließlich im `localStorage` des Browsers unter dem Schlüssel
`produktions-dashboard:v1`. Die Daten verbleiben auf dem jeweiligen Gerät und
werden nicht zwischen Geräten oder Browsern synchronisiert.
