# Der feine Held

Webbasiertes Tool zur digitalen Erfassung von HeldenbÃ¶gen fÃ¼r **Das Schwarze Auge 4.0** (reines HTML/CSS/Vanilla-JavaScript). Es unterstÃ¼tzt **mehrere Charaktere**, **LocalStorage**, **JSON-Import/Export**, **Tesseract.js-OCR** fÃ¼r gescannte BÃ¶gen sowie optional einen kleinen **Node.js/Express**-Server fÃ¼r eine REST-API.

> Hinweis: Kein offizielles Ulisses-/DSA-Produkt. Abgeleitete Werte und PlausibilitÃ¤tsprÃ¼fungen orientieren sich an gÃ¤ngiger DSA-4.0-Praxis; Hausregeln kÃ¶nnen abweichen.

## Funktionen

- **Heldenbogen-UI** im Stil eines klassischen DSA-Bogens (responsive)
- **Eigenschaften** (MUâ€“KK), **Kampfwerte**, **LE/AE/AU**, **Talente** (Tabelle), **Inventar**
- **Abgeleitete Werte** (AT-/PA-/FK-/Zauber-Basis, MR-Basis, AU-Maximum, LE-Vorschlag Mensch)
- **Validierung** mit Hinweisen (z.â€¯B. AT/PA vs. Basis, LE vs. Vorschlag)
- **Bild-Upload** und **OCR** (Deutsch) mit **Korrekturdialog** vor Ãœbernahme in Felder
- **Mehrere Helden**, Auswahl in der Seitenleiste, Duplizieren/LÃ¶schen
- **Export/Import** einzelner Helden als JSON sowie **Bundle** (`dsa4_alle_helden.json` mit Feld `helden: [...]`)
- **Optional**: Express-API (`GET/POST/DELETE /api/characters`) mit Datei-Backend

## GitHub Pages (Frontend-only)

Das statische Frontend liegt im **Repository-Root** (`index.html`, `css/`, `js/`, `data/`) und ist **ohne Backend** voll nutzbar (Speicherung im Browser).

### Variante A: Nur Branch (ohne Actions)

1. **Settings â†’ Pages â†’ Build and deployment**
2. Quelle **Deploy from a branch**
3. Branch **`main`**, Ordner **`/ (root)`** **oder** **`/docs`**
   - **`/docs`:** Im Repo liegt ein **Spiegel** der gleichen Dateien wie im Root (fÃ¼r Ã¤ltere Einstellungen, die noch auf `docs/` zeigen). **Empfehlung:** auf **`/ (root)`** umstellen und den Ordner `docs/` langfristig wieder entfernen, damit es nur **eine** Quelle gibt.

### Variante B: GitHub Actions (empfohlen, wenn der Standard-Workflow fehlschlÃ¤gt)

1. **Settings â†’ Pages â†’ Build and deployment**
2. Quelle **GitHub Actions**
3. Im Repo ist [`.github/workflows/pages.yml`](.github/workflows/pages.yml) hinterlegt (ein Job: Checkout â†’ Artifact â†’ Deploy). Nach dem Push auf `main` lÃ¤uft der Workflow automatisch.
4. Beim **ersten** Deploy kann GitHub nach **Freigabe der Umgebung `github-pages`** fragen (einmalig bestÃ¤tigen unter Actions / Environment).

Die Datei **`.nojekyll`** im Root verhindert bei der **Branch-Variante**, dass die Site mit Jekyll gebaut wird. Die **Actions-Variante** lÃ¤dt die Dateien unverÃ¤ndert hoch.

Nach erfolgreichem Build: `https://<dein-name>.github.io/<repo-name>/` (exakte URL unter **Settings â†’ Pages**).

**OCR:** Tesseract.js wird per **jsDelivr-CDN** geladen; eine Internetverbindung ist fÃ¼r die erste Erkennung nÃ¶tig.

## Lokaler Start (optional API)

```bash
cd server
npm install
npm start
```

- API: `http://localhost:3000`
- Im Browser-Tool **â€žExpress-API nutzenâ€œ** aktivieren und Basis-URL `http://localhost:3000` eintragen.
- **Hinweis:** Eine **HTTPS**-GitHub-Page darf aus SicherheitsgrÃ¼nden typischerweise **keine** Anfragen an `http://localhost` senden. Die API ist fÃ¼r **lokale Nutzung** oder ein eigenes HTTPS-Backend gedacht.

## Beispiel-Held

Die Datei [`data/example-hero.json`](data/example-hero.json) kann Ã¼ber **JSON importieren** geladen werden.

## Projektstruktur

```
index.html            â†’ Einstieg (GitHub Pages aus Root)
css/style.css
js/script.js
data/example-hero.json
.nojekyll             â†’ bei Branch-Deploy: Jekyll aus
.github/workflows/pages.yml â†’ optional: GitHub Actions Deploy
server/               â†’ optionale REST-API
  server.js
  package.json
  data/               â†’ wird bei Start mit characters.json befÃ¼llt
README.md
```

## Technik

- **Frontend:** semantisches HTML, CSS-Variablen, kein Framework
- **OCR:** [Tesseract.js v5](https://github.com/naptha/tesseract.js) (`deu`)
- **Speicher:** `localStorage` unter dem SchlÃ¼ssel `dsa4_helden_v1`

## Lizenz

Code dieses Repositories kannst du fÃ¼r private und eigene Projekte frei verwenden. DSA ist eine eingetragene Marke der Ulisses Spiele GmbH; dieses Projekt steht in keiner offiziellen Verbindung dazu.

