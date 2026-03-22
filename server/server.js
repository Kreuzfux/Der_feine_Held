/**
 * Einfacher Express-Server für alternative Helden-Speicherung (JSON-Datei).
 * Das GitHub-Pages-Frontend funktioniert ohne diesen Server (LocalStorage).
 *
 * Endpunkte:
 *   GET    /api/characters      – alle Helden
 *   GET    /api/characters/:id – ein Held
 *   POST   /api/characters      – anlegen/aktualisieren (Body = Held-Objekt)
 *   DELETE /api/characters/:id – löschen
 */

const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'characters.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

/**
 * Liest die Heldenliste aus der JSON-Datei (oder liefert []).
 * @returns {Promise<object[]>}
 */
async function readDb() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

/**
 * Schreibt die Heldenliste atomar über eine Temp-Datei.
 * @param {object[]} list
 */
async function writeDb(list) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
  await fs.rename(tmp, DATA_FILE);
}

app.get('/api/characters', async (req, res) => {
  try {
    const list = await readDb();
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lesen fehlgeschlagen' });
  }
});

app.get('/api/characters/:id', async (req, res) => {
  try {
    const list = await readDb();
    const h = list.find((c) => c.id === req.params.id);
    if (!h) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json(h);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lesen fehlgeschlagen' });
  }
});

app.post('/api/characters', async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || !body.id) {
      return res.status(400).json({ error: 'Ungültiger Body (id erforderlich)' });
    }
    const list = await readDb();
    const idx = list.findIndex((c) => c.id === body.id);
    if (idx >= 0) list[idx] = body;
    else list.push(body);
    await writeDb(list);
    res.json({ ok: true, id: body.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Speichern fehlgeschlagen' });
  }
});

app.delete('/api/characters/:id', async (req, res) => {
  try {
    const list = await readDb();
    const next = list.filter((c) => c.id !== req.params.id);
    if (next.length === list.length) {
      return res.status(404).json({ error: 'Nicht gefunden' });
    }
    await writeDb(next);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Löschen fehlgeschlagen' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'der-feine-held-api' });
});

app.listen(PORT, () => {
  console.log(`Der feine Held API auf http://localhost:${PORT}`);
  console.log(`Daten: ${DATA_FILE}`);
});
