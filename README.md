# Der feine Held

Webbasiertes Tool zur digitalen Erfassung von Heldenbögen für **Das Schwarze Auge 4.0** (reines HTML/CSS/Vanilla JavaScript).

> Hinweis: Kein offizielles DSA-/Ulisses-Produkt.

## Aktueller Stand

- Responsive Heldenbogen-Oberfläche (Stammdaten, Eigenschaften, Kampf, Energien, Talente, Inventar)
- OCR für Bild/PDF mit Tesseract.js und Korrekturdialog
- Mehrere Helden in der Session verwalten (Neu, Duplizieren, Löschen)
- JSON-Import von Heldendaten
- Online-Speichern/Laden über Supabase (`public.heroes`)

## GitHub Pages Deployment

Die statische Seite liegt im Root (`index.html`, `css/`, `js/`, `data/`) und zusätzlich als Spiegel in `docs/`.

### Branch-Deploy

1. Repository öffnen → **Settings → Pages**
2. **Deploy from a branch**
3. Branch `main` und Ordner `/(root)` oder `/docs`

### Actions-Deploy

Alternativ **GitHub Actions** nutzen (Workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml)).

## Supabase Setup

Führe im Supabase SQL-Editor aus:

```sql
create table if not exists public.heroes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.heroes enable row level security;

drop policy if exists "anon can read heroes" on public.heroes;
drop policy if exists "anon can write heroes" on public.heroes;
drop policy if exists "anon can update heroes" on public.heroes;

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

Danach funktionieren die Buttons **Online speichern** und **Online laden**.

## Wichtiger Sicherheitshinweis

Die Supabase-URL und der publishable Key sind aktuell **fest im Frontend-Code** hinterlegt (`js/script.js`). Das ist für einen Prototyp okay, aber nicht für sensible Produktionsdaten. Für härtere Sicherheit sollte Auth/RLS nutzerbezogen erweitert werden.

## Admin-Zugang

Ein einfacher Admin-Zugang ist implementiert:

- In `js/script.js` die Liste `ADMIN_EMAILS` pflegen.
- Nach Login mit einer gelisteten E-Mail wird in der UI **Admin: alle Helden laden** eingeblendet.
- Diese Funktion lädt alle Datensätze aus `public.heroes` (nur für Admin-Accounts vorgesehen).

## Sichtbarkeit der Helden

- **Normale eingeloggte Nutzer:** sehen und laden nur ihre eigenen Helden (`user_id = aktueller Benutzer`).
- **Admin-Nutzer (Whitelist):** erhalten zusätzlich den Button **Admin: alle Helden laden** und können damit alle Helden laden.

## Projektstruktur

```txt
index.html
css/style.css
js/script.js
data/example-hero.json
docs/...
.github/workflows/pages.yml
README.md
```


