# Der feine Held

Webbasiertes Tool zur digitalen Erfassung von Heldenbögen für **Das Schwarze Auge 4.0** (reines HTML/CSS/Vanilla-JavaScript). Es unterstützt **mehrere Charaktere**, **JSON-Import/Export**, **Tesseract.js-OCR** für gescannte Bögen sowie **Supabase-Online-Speicherung**.

> Hinweis: Kein offizielles Ulisses-/DSA-Produkt. Abgeleitete Werte und Plausibilitätsprüfungen orientieren sich an gängiger DSA-4.0-Praxis; Hausregeln können abweichen.

## Funktionen

- **Heldenbogen-UI** im Stil eines klassischen DSA-Bogens (responsive)
- **Eigenschaften** (MU–KK), **Kampfwerte**, **LE/AE/AU**, **Talente** (Tabelle), **Inventar**
- **Abgeleitete Werte** (AT-/PA-/FK-/Zauber-Basis, MR-Basis, AU-Maximum, LE-Vorschlag Mensch)
- **Validierung** mit Hinweisen (z. B. AT/PA vs. Basis, LE vs. Vorschlag)
- **Bild-Upload** und **OCR** (Deutsch) mit **Korrekturdialog** vor Übernahme in Felder
- **Mehrere Helden**, Auswahl in der Seitenleiste, Duplizieren/Löschen
- **Import** von Helden über JSON-Datei
- **Optional**: Supabase Online-Speicherung (REST über `heroes`-Tabelle)

## GitHub Pages (Frontend-only)

Das statische Frontend liegt im **Repository-Root** (`index.html`, `css/`, `js/`, `data/`) und ist **ohne Backend** voll nutzbar (Speicherung im Browser).

### Variante A: Nur Branch (ohne Actions)

1. **Settings → Pages → Build and deployment**
2. Quelle **Deploy from a branch**
3. Branch **`main`**, Ordner **`/ (root)`** **oder** **`/docs`**
   - **`/docs`:** Im Repo liegt ein **Spiegel** der gleichen Dateien wie im Root (für ältere Einstellungen, die noch auf `docs/` zeigen). **Empfehlung:** auf **`/ (root)`** umstellen und den Ordner `docs/` langfristig wieder entfernen, damit es nur **eine** Quelle gibt.

### Variante B: GitHub Actions (empfohlen, wenn der Standard-Workflow fehlschlägt)

1. **Settings → Pages → Build and deployment**
2. Quelle **GitHub Actions**
3. Im Repo ist [`.github/workflows/pages.yml`](.github/workflows/pages.yml) hinterlegt (ein Job: Checkout → Artifact → Deploy). Nach dem Push auf `main` läuft der Workflow automatisch.
4. Beim **ersten** Deploy kann GitHub nach **Freigabe der Umgebung `github-pages`** fragen (einmalig bestätigen unter Actions / Environment).

Die Datei **`.nojekyll`** im Root verhindert bei der **Branch-Variante**, dass die Site mit Jekyll gebaut wird. Die **Actions-Variante** lädt die Dateien unverändert hoch.

Nach erfolgreichem Build: `https://<dein-name>.github.io/<repo-name>/` (exakte URL unter **Settings → Pages**).

**OCR:** Tesseract.js wird per **jsDelivr-CDN** geladen; eine Internetverbindung ist für die erste Erkennung nötig.

## Online-Speicher mit Supabase (empfohlen)

1. In Supabase ein Projekt anlegen.
2. SQL im Supabase SQL-Editor ausführen:

```sql
create table if not exists public.heroes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.heroes enable row level security;

create policy "anon can read heroes"
on public.heroes for select
to anon
using (true);

create policy "anon can write heroes"
on public.heroes for insert
to anon
with check (true);

create policy "anon can update heroes"
on public.heroes for update
to anon
using (true)
with check (true);
```

3. In der App oben:
   - **Supabase Online-Speicher** aktivieren
   - **Supabase URL** eintragen (`https://...supabase.co`)
   - **anon key** eintragen
4. Mit **Online speichern** den aktiven Helden hochladen, mit **Online laden** alle Online-Helden lokal übernehmen.

Hinweis: Für produktive Nutzung solltest du Auth/Rollen härter absichern; die obigen Policies sind bewusst einfach für den schnellen Start.

## Beispiel-Held

Die Datei [`data/example-hero.json`](data/example-hero.json) kann über **JSON importieren** geladen werden.

## Projektstruktur

```
index.html            → Einstieg (GitHub Pages aus Root)
css/style.css
js/script.js
data/example-hero.json
.nojekyll             → bei Branch-Deploy: Jekyll aus
.github/workflows/pages.yml → optional: GitHub Actions Deploy
README.md
```

## Technik

- **Frontend:** semantisches HTML, CSS-Variablen, kein Framework
- **OCR:** [Tesseract.js v5](https://github.com/naptha/tesseract.js) (`deu`)
- **Speicher:** Supabase (`heroes`-Tabelle) und optional JSON-Dateien

## Lizenz

Code dieses Repositories kannst du für private und eigene Projekte frei verwenden. DSA ist eine eingetragene Marke der Ulisses Spiele GmbH; dieses Projekt steht in keiner offiziellen Verbindung dazu.


