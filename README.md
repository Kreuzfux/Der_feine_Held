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
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.heroes enable row level security;

-- Für bestehende Tabellen:
alter table public.heroes add column if not exists user_id uuid;
-- Optional: alte Datensätze ohne user_id vorher bereinigen/zuordnen.
alter table public.heroes alter column user_id set not null;

drop policy if exists "users can read own heroes" on public.heroes;
drop policy if exists "users can insert own heroes" on public.heroes;
drop policy if exists "users can update own heroes" on public.heroes;

create policy "users can read own heroes"
on public.heroes for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert own heroes"
on public.heroes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update own heroes"
on public.heroes for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

Danach funktionieren die Buttons **Online speichern** und **Online laden**.

## Wichtiger Sicherheitshinweis

Die Supabase-URL und der publishable Key sind aktuell **fest im Frontend-Code** hinterlegt (`js/script.js`). Das ist für einen Prototyp okay, aber nicht für sensible Produktionsdaten.

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


