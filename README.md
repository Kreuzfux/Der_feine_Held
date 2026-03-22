# Der feine Held

Webbasiertes Tool zur digitalen Erfassung von Heldenbögen für **Das Schwarze Auge 4.0** (reines HTML/CSS/Vanilla-JavaScript). Es unterstützt **mehrere Charaktere**, **LocalStorage**, **JSON-Import/Export**, **Tesseract.js-OCR** für gescannte Bögen sowie optional einen kleinen **Node.js/Express**-Server für eine REST-API.

> Hinweis: Kein offizielles Ulisses-/DSA-Produkt. Abgeleitete Werte und Plausibilitätsprüfungen orientieren sich an gängiger DSA-4.0-Praxis; Hausregeln können abweichen.

## Funktionen

- **Heldenbogen-UI** im Stil eines klassischen DSA-Bogens (responsive)
- **Eigenschaften** (MU–KK), **Kampfwerte**, **LE/AE/AU**, **Talente** (Tabelle), **Inventar**
- **Abgeleitete Werte** (AT-/PA-/FK-/Zauber-Basis, MR-Basis, AU-Maximum, LE-Vorschlag Mensch)
- **Validierung** mit Hinweisen (z. B. AT/PA vs. Basis, LE vs. Vorschlag)
- **Bild-Upload** und **OCR** (Deutsch) mit **Korrekturdialog** vor Übernahme in Felder
- **Mehrere Helden**, Auswahl in der Seitenleiste, Duplizieren/Löschen
- **Export/Import** einzelner Helden als JSON sowie **Bundle** (`dsa4_alle_helden.json` mit Feld `helden: [...]`)
- **Optional**: Express-API (`GET/POST/DELETE /api/characters`) mit Datei-Backend

## GitHub Pages (Frontend-only)

Das statische Frontend liegt im **Repository-Root** (`index.html`, `css/`, `js/`, `data/`) und ist **ohne Backend** voll nutzbar (Speicherung im Browser).

1. Repository auf GitHub pushen.
2. **Settings → Pages**.
3. **Build and deployment**: Quelle **Deploy from a branch**.
4. Branch **`main`**, Ordner **`/ (root)`**, speichern.
5. Nach dem Build: `https://<dein-name>.github.io/<repo-name>/` (exakte URL steht auf der Pages-Seite).

Die leere Datei **`.nojekyll`** im Root verhindert, dass GitHub Pages die Site mit Jekyll verarbeitet (reines statisches HTML bleibt stabil).

**OCR:** Tesseract.js wird per **jsDelivr-CDN** geladen; eine Internetverbindung ist für die erste Erkennung nötig.

## Lokaler Start (optional API)

```bash
cd server
npm install
npm start
```

- API: `http://localhost:3000`
- Im Browser-Tool **„Express-API nutzen“** aktivieren und Basis-URL `http://localhost:3000` eintragen.
- **Hinweis:** Eine **HTTPS**-GitHub-Page darf aus Sicherheitsgründen typischerweise **keine** Anfragen an `http://localhost` senden. Die API ist für **lokale Nutzung** oder ein eigenes HTTPS-Backend gedacht.

## Beispiel-Held

Die Datei [`data/example-hero.json`](data/example-hero.json) kann über **JSON importieren** geladen werden.

## Projektstruktur

```
index.html            → Einstieg (GitHub Pages aus Root)
css/style.css
js/script.js
data/example-hero.json
.nojekyll             → Jekyll für Pages deaktivieren
server/               → optionale REST-API
  server.js
  package.json
  data/               → wird bei Start mit characters.json befüllt
README.md
```

## Technik

- **Frontend:** semantisches HTML, CSS-Variablen, kein Framework
- **OCR:** [Tesseract.js v5](https://github.com/naptha/tesseract.js) (`deu`)
- **Speicher:** `localStorage` unter dem Schlüssel `dsa4_helden_v1`

## Lizenz

Code dieses Repositories kannst du für private und eigene Projekte frei verwenden. DSA ist eine eingetragene Marke der Ulisses Spiele GmbH; dieses Projekt steht in keiner offiziellen Verbindung dazu.
