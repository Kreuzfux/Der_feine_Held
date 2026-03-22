/**
 * Der feine Held – DSA 4.0 Heldenbogen (Vanilla JS)
 * LocalStorage, JSON Import/Export, Tesseract-OCR, optionale Express-API
 */

(function () {
  'use strict';

  /** @const Schlüssel für LocalStorage */
  const STORAGE_KEY = 'dsa4_helden_v1';

  /** Eigenschaftskürzel DSA 4.0 */
  const ATTR_KEYS = ['MU', 'KL', 'IN', 'CH', 'FF', 'GE', 'KO', 'KK'];

  /** Langbezeichnungen für OCR / Anzeige */
  const ATTR_LABELS = {
    MU: 'Mut',
    KL: 'Klugheit',
    IN: 'Intuition',
    CH: 'Charisma',
    FF: 'Fingerfertigkeit',
    GE: 'Gewandtheit',
    KO: 'Konstitution',
    KK: 'Körperkraft',
  };

  let characters = [];
  let currentId = null;
  /** @type {string|null} Data-URL des aktuellen Uploads (nur Sitzung) */
  let currentImageDataUrl = null;

  // ——— DOM ———
  const el = (id) => document.getElementById(id);

  const characterList = el('characterList');
  const heroForm = el('heroForm');
  const imageUpload = el('imageUpload');
  const uploadPreview = el('uploadPreview');
  const uploadPlaceholder = el('uploadPlaceholder');
  const btnRunOcr = el('btnRunOcr');
  const btnClearImage = el('btnClearImage');
  const ocrStatus = el('ocrStatus');
  const attrsContainer = el('attrsContainer');
  const talentsBody = el('talentsBody');
  const inventoryBody = el('inventoryBody');
  const ocrModal = el('ocrModal');
  const ocrRawPreview = el('ocrRawPreview');
  const ocrMapBody = el('ocrMapBody');
  const useBackendApi = el('useBackendApi');
  const apiBaseUrl = el('apiBaseUrl');

  /** Letzte OCR-Zeile für Modal */
  let lastOcrMappings = [];

  /**
   * Leeres Helden-Objekt (strukturierte Datenhaltung).
   * @returns {object} Held gemäß internem Schema (id, stammdaten, eigenschaften, …)
   */
  function createEmptyHero() {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    return {
      id,
      version: 1,
      stammdaten: {
        name: '',
        rasse: '',
        geschlecht: '',
        profession: '',
        stand: '',
        gp: null,
        groesse: null,
        gewicht: '',
        alter: '',
        haarfarbe: '',
        augenfarbe: '',
      },
      eigenschaften: Object.fromEntries(ATTR_KEYS.map((k) => [k, null])),
      kampf: {
        at: null,
        pa: null,
        wk: '',
        rs: null,
        bewegung: null,
        ini: null,
      },
      energien: {
        leAktuell: null,
        leMax: null,
        aeAktuell: null,
        aeMax: null,
        auAktuell: null,
        auMax: null,
      },
      talente: [],
      inventar: [],
      notizen: '',
    };
  }

  /**
   * Migration älterer gespeicherter Objekte
   * @param {object} raw
   */
  function normalizeHero(raw) {
    if (!raw || typeof raw !== 'object') return createEmptyHero();
    const h = createEmptyHero();
    h.id = raw.id || h.id;
    h.version = raw.version || 1;
    const s = raw.stammdaten || {};
    h.stammdaten = {
      name: s.name ?? raw.name ?? '',
      rasse: s.rasse ?? raw.rasse ?? '',
      geschlecht: s.geschlecht ?? '',
      profession: s.profession ?? '',
      stand: s.stand ?? '',
      gp: numOrNull(s.gp ?? raw.gp),
      groesse: numOrNull(s.groesse ?? raw.groesse),
      gewicht: s.gewicht ?? '',
      alter: s.alter ?? '',
      haarfarbe: s.haarfarbe ?? '',
      augenfarbe: s.augenfarbe ?? '',
    };
    const e = raw.eigenschaften || {};
    ATTR_KEYS.forEach((k) => {
      h.eigenschaften[k] = numOrNull(e[k] ?? raw[k]);
    });
    const k = raw.kampf || {};
    h.kampf = {
      at: numOrNull(k.at ?? raw.at),
      pa: numOrNull(k.pa ?? raw.pa),
      wk: k.wk ?? raw.wk ?? '',
      rs: numOrNull(k.rs ?? raw.rs),
      bewegung: numOrNull(k.bewegung ?? k.be ?? raw.bewegung),
      ini: numOrNull(k.ini ?? raw.ini),
    };
    const en = raw.energien || {};
    h.energien = {
      leAktuell: numOrNull(en.leAktuell ?? raw.leAktuell),
      leMax: numOrNull(en.leMax ?? raw.leMax),
      aeAktuell: numOrNull(en.aeAktuell ?? raw.aeAktuell),
      aeMax: numOrNull(en.aeMax ?? raw.aeMax),
      auAktuell: numOrNull(en.auAktuell ?? raw.auAktuell),
      auMax: numOrNull(en.auMax ?? raw.auMax),
    };
    h.talente = Array.isArray(raw.talente) ? raw.talente.map((t) => ({
      name: String(t.name || ''),
      probe: String(t.probe || ''),
      wert: numOrNull(t.wert),
    })) : [];
    h.inventar = Array.isArray(raw.inventar) ? raw.inventar.map((i) => ({
      name: String(i.name || ''),
      anzahl: numOrNull(i.anzahl) ?? 1,
      gewicht: String(i.gewicht || i.notiz || ''),
    })) : [];
    h.notizen = raw.notizen || '';
    return h;
  }

  function numOrNull(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        characters = [createEmptyHero()];
        currentId = characters[0].id;
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Ungültiges Format');
      characters = parsed.map(normalizeHero);
      if (characters.length === 0) {
        characters = [createEmptyHero()];
      }
      currentId = characters[0].id;
    } catch (e) {
      console.warn('LocalStorage konnte nicht gelesen werden:', e);
      characters = [createEmptyHero()];
      currentId = characters[0].id;
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
    } catch (e) {
      console.error('Speichern fehlgeschlagen:', e);
      alert('Speichern im Browser fehlgeschlagen (Speicher voll?).');
    }
  }

  function getCurrentHero() {
    return characters.find((c) => c.id === currentId) || characters[0];
  }

  /**
   * DSA 4.0: übliche Basiswerte (Halbierung kaufmännisch = .5 aufgerundet → Math.round in JS entspricht oft Spieltisch)
   * Hinweis: Exakte Rundungsregeln können je nach Regelwerk variieren.
   */
  function berechneAbgeleitete(e) {
    const g = (k) => (e[k] != null && !Number.isNaN(e[k]) ? e[k] : null);
    const mu = g('MU');
    const kl = g('KL');
    const inn = g('IN');
    const ch = g('CH');
    const ff = g('FF');
    const ge = g('GE');
    const ko = g('KO');
    const kk = g('KK');

    const teile5 = (a, b, c) => {
      if (a == null || b == null || c == null) return null;
      return Math.round((a + b + c) / 5);
    };

    return {
      atBasis: teile5(mu, inn, ge),
      paBasis: teile5(inn, ge, kk),
      fkBasis: teile5(inn, ff, kk),
      zfBasis: teile5(mu, inn, ch),
      mrBasis: teile5(mu, kl, ch),
      /** AU-Maximum: 2×KO + GE (Standard DSA 4) */
      auMax: ko != null && ge != null ? 2 * ko + ge : null,
      /** LE-Vorschlag Mensch: 20 + 2×KO + KK (Grundwert, ohne Modifikatoren) */
      leMensch: ko != null && kk != null ? 20 + 2 * ko + kk : null,
    };
  }

  /**
   * Validierung nach plausibler DSA-4.0-Logik (Hinweise, keine harten Blockaden)
   */
  function validateHero(h) {
    const msgs = { eigenschaften: [], kampf: [], energien: [] };
    ATTR_KEYS.forEach((k) => {
      const v = h.eigenschaften[k];
      if (v != null && (v < 1 || v > 25)) {
        msgs.eigenschaften.push(`${k} außerhalb üblichen Bereichs 1–25 (${v}).`);
      }
    });
    const d = berechneAbgeleitete(h.eigenschaften);
    if (h.kampf.at != null && d.atBasis != null && Math.abs(h.kampf.at - d.atBasis) > 15) {
      msgs.kampf.push('AT weicht stark von berechneter AT-Basis ab – bitte prüfen.');
    }
    if (h.kampf.pa != null && d.paBasis != null && Math.abs(h.kampf.pa - d.paBasis) > 15) {
      msgs.kampf.push('PA weicht stark von berechneter PA-Basis ab – bitte prüfen.');
    }
    if (h.energien.leMax != null && d.leMensch != null && h.energien.leMax < d.leMensch - 10) {
      msgs.energien.push('LE max. deutlich unter LE-Vorschlag für Mensch – Rasse/Modifikatoren beachten.');
    }
    if (h.energien.auMax != null && d.auMax != null && h.energien.auMax !== d.auMax) {
      msgs.energien.push('AU max. entspricht nicht 2×KO+GE – kann stimmig sein bei Sonderregeln.');
    }
    return msgs;
  }

  function renderValidation() {
    const h = formToHero();
    const v = validateHero(h);
    setValidation('validationEigenschaften', v.eigenschaften);
    setValidation('validationKampf', v.kampf);
    setValidation('validationEnergien', v.energien);
  }

  function setValidation(id, arr) {
    const node = el(id);
    if (!node) return;
    node.textContent = arr.length ? arr.join(' ') : '';
  }

  function updateDerivedDisplay() {
    const h = getCurrentHero();
    const d = berechneAbgeleitete(h.eigenschaften);
    const set = (id, val) => {
      const n = el(id);
      if (n) n.textContent = val == null ? '–' : String(val);
    };
    set('derivedAtBasis', d.atBasis);
    set('derivedPaBasis', d.paBasis);
    set('derivedFkBasis', d.fkBasis);
    set('derivedZfBasis', d.zfBasis);
    set('derivedMr', d.mrBasis);
    set('derivedAuMax', d.auMax);
    set('derivedLeSuggestion', d.leMensch);
  }

  /** Eigenschaftsfelder einmalig aufbauen */
  function buildAttrInputs() {
    attrsContainer.innerHTML = '';
    ATTR_KEYS.forEach((key) => {
      const wrap = document.createElement('div');
      wrap.className = 'field-group attr-cell';
      wrap.innerHTML = `
        <label for="attr-${key}"><code>${key}</code> ${ATTR_LABELS[key]}</label>
        <input type="number" id="attr-${key}" data-attr="${key}" min="1" max="25" step="1" />
      `;
      attrsContainer.appendChild(wrap);
    });
    attrsContainer.querySelectorAll('input[data-attr]').forEach((inp) => {
      inp.addEventListener('input', () => {
        updateDerivedDisplay();
        renderValidation();
      });
    });
  }

  function renderCharacterList() {
    characterList.innerHTML = '';
    characters.forEach((c) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      const name = c.stammdaten.name || '(Unbenannt)';
      btn.textContent = name;
      btn.classList.toggle('is-active', c.id === currentId);
      btn.addEventListener('click', () => {
        saveFormToCurrent();
        currentId = c.id;
        heroToForm(getCurrentHero());
        renderCharacterList();
        updateDerivedDisplay();
        renderValidation();
      });
      li.appendChild(btn);
      characterList.appendChild(li);
    });
  }

  function heroToForm(h) {
    const s = h.stammdaten;
    el('name').value = s.name || '';
    el('rasse').value = s.rasse || '';
    el('geschlecht').value = s.geschlecht || '';
    el('profession').value = s.profession || '';
    el('stand').value = s.stand || '';
    el('gp').value = s.gp != null ? s.gp : '';
    el('groesse').value = s.groesse != null ? s.groesse : '';
    el('gewicht').value = s.gewicht || '';
    el('alter').value = s.alter || '';
    el('haarfarbe').value = s.haarfarbe || '';
    el('augenfarbe').value = s.augenfarbe || '';

    ATTR_KEYS.forEach((k) => {
      const inp = el('attr-' + k);
      if (inp) inp.value = h.eigenschaften[k] != null ? h.eigenschaften[k] : '';
    });

    el('at').value = h.kampf.at != null ? h.kampf.at : '';
    el('pa').value = h.kampf.pa != null ? h.kampf.pa : '';
    el('wk').value = h.kampf.wk || '';
    el('rs').value = h.kampf.rs != null ? h.kampf.rs : '';
    el('bewegung').value = h.kampf.bewegung != null ? h.kampf.bewegung : '';
    el('ini').value = h.kampf.ini != null ? h.kampf.ini : '';

    el('leAktuell').value = h.energien.leAktuell != null ? h.energien.leAktuell : '';
    el('leMax').value = h.energien.leMax != null ? h.energien.leMax : '';
    el('aeAktuell').value = h.energien.aeAktuell != null ? h.energien.aeAktuell : '';
    el('aeMax').value = h.energien.aeMax != null ? h.energien.aeMax : '';
    el('auAktuell').value = h.energien.auAktuell != null ? h.energien.auAktuell : '';
    el('auMax').value = h.energien.auMax != null ? h.energien.auMax : '';

    el('notizen').value = h.notizen || '';

    renderTalentsTable(h.talente);
    renderInventoryTable(h.inventar);
  }

  function formToHero() {
    const h = normalizeHero(getCurrentHero());
    h.stammdaten.name = el('name').value.trim();
    h.stammdaten.rasse = el('rasse').value.trim();
    h.stammdaten.geschlecht = el('geschlecht').value.trim();
    h.stammdaten.profession = el('profession').value.trim();
    h.stammdaten.stand = el('stand').value.trim();
    h.stammdaten.gp = numOrNull(el('gp').value);
    h.stammdaten.groesse = numOrNull(el('groesse').value);
    h.stammdaten.gewicht = el('gewicht').value.trim();
    h.stammdaten.alter = el('alter').value.trim();
    h.stammdaten.haarfarbe = el('haarfarbe').value.trim();
    h.stammdaten.augenfarbe = el('augenfarbe').value.trim();

    ATTR_KEYS.forEach((k) => {
      const inp = el('attr-' + k);
      h.eigenschaften[k] = inp ? numOrNull(inp.value) : null;
    });

    h.kampf.at = numOrNull(el('at').value);
    h.kampf.pa = numOrNull(el('pa').value);
    h.kampf.wk = el('wk').value.trim();
    h.kampf.rs = numOrNull(el('rs').value);
    h.kampf.bewegung = numOrNull(el('bewegung').value);
    h.kampf.ini = numOrNull(el('ini').value);

    h.energien.leAktuell = numOrNull(el('leAktuell').value);
    h.energien.leMax = numOrNull(el('leMax').value);
    h.energien.aeAktuell = numOrNull(el('aeAktuell').value);
    h.energien.aeMax = numOrNull(el('aeMax').value);
    h.energien.auAktuell = numOrNull(el('auAktuell').value);
    h.energien.auMax = numOrNull(el('auMax').value);

    h.notizen = el('notizen').value;
    h.talente = readTalentsFromTable();
    h.inventar = readInventoryFromTable();
    return h;
  }

  function saveFormToCurrent() {
    const idx = characters.findIndex((c) => c.id === currentId);
    if (idx < 0) return;
    characters[idx] = formToHero();
  }

  function renderTalentsTable(rows) {
    talentsBody.innerHTML = '';
    const data = rows.length ? rows : [{ name: '', probe: '', wert: null }];
    data.forEach((row, i) => addTalentRow(row, i === 0 && data.length === 1));
  }

  function addTalentRow(row, isOnly) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="tal-name" placeholder="z. B. Athletik" value="${escapeAttr(row.name)}" /></td>
      <td><input type="text" class="tal-probe" placeholder="GE/KO/KK" value="${escapeAttr(row.probe)}" /></td>
      <td><input type="number" class="tal-wert" min="0" max="25" step="1" value="${row.wert != null ? row.wert : ''}" /></td>
      <td><button type="button" class="btn btn-ghost btn-icon btn-remove-tal" aria-label="Zeile entfernen">✕</button></td>
    `;
    tr.querySelector('.btn-remove-tal').addEventListener('click', () => {
      if (talentsBody.querySelectorAll('tr').length <= 1) {
        tr.querySelector('.tal-name').value = '';
        tr.querySelector('.tal-probe').value = '';
        tr.querySelector('.tal-wert').value = '';
        return;
      }
      tr.remove();
    });
    talentsBody.appendChild(tr);
  }

  function readTalentsFromTable() {
    const out = [];
    talentsBody.querySelectorAll('tr').forEach((tr) => {
      const name = tr.querySelector('.tal-name')?.value.trim() || '';
      const probe = tr.querySelector('.tal-probe')?.value.trim() || '';
      const wert = numOrNull(tr.querySelector('.tal-wert')?.value);
      if (name || probe || wert != null) out.push({ name, probe, wert });
    });
    return out;
  }

  function renderInventoryTable(rows) {
    inventoryBody.innerHTML = '';
    const data = rows.length ? rows : [{ name: '', anzahl: 1, gewicht: '' }];
    data.forEach((row) => addInventoryRow(row));
  }

  function addInventoryRow(row) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="inv-name" value="${escapeAttr(row.name)}" /></td>
      <td><input type="number" class="inv-anz" min="0" step="1" value="${row.anzahl != null ? row.anzahl : ''}" /></td>
      <td><input type="text" class="inv-gew" placeholder="Stein / Notiz" value="${escapeAttr(row.gewicht)}" /></td>
      <td><button type="button" class="btn btn-ghost btn-icon btn-remove-inv" aria-label="Zeile entfernen">✕</button></td>
    `;
    tr.querySelector('.btn-remove-inv').addEventListener('click', () => {
      if (inventoryBody.querySelectorAll('tr').length <= 1) {
        tr.querySelector('.inv-name').value = '';
        tr.querySelector('.inv-anz').value = '';
        tr.querySelector('.inv-gew').value = '';
        return;
      }
      tr.remove();
    });
    inventoryBody.appendChild(tr);
  }

  function readInventoryFromTable() {
    const out = [];
    inventoryBody.querySelectorAll('tr').forEach((tr) => {
      const name = tr.querySelector('.inv-name')?.value.trim() || '';
      const anzahl = numOrNull(tr.querySelector('.inv-anz')?.value) ?? 1;
      const gewicht = tr.querySelector('.inv-gew')?.value.trim() || '';
      if (name || gewicht || (anzahl != null && anzahl !== 1)) {
        out.push({ name, anzahl: anzahl != null ? anzahl : 1, gewicht });
      }
    });
    return out;
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  // ——— OCR: Regex-Muster für typische Bogen-Beschriftungen (DE) ———

  /**
   * @param {string} text Rohtext von Tesseract
   * @returns {Array<{ key: string, label: string, value: string }>}
   */
  function extractMappingsFromOcr(text) {
    const t = text.replace(/\r/g, '\n');
    const oneLine = t.replace(/\s+/g, ' ');
    const mappings = [];
    const seen = new Set();

    /**
     * @param {string} key
     * @param {string} label
     * @param {RegExp} re
     * @param {string} source
     */
    function tryMatch(key, label, re, source) {
      if (seen.has(key)) return;
      const m = source.match(re);
      if (m && m[1] != null) {
        seen.add(key);
        mappings.push({ key, label, value: String(m[1]).trim() });
      }
    }

    // Eigenschaften: Kürzel oder ausgeschrieben
    const attrRes = [
      ['MU', 'Mut', /(?:^|[^A-ZÄÖÜ])(?:Mut|MU)\b\s*[.:]?\s*(\d{1,2})\b/i],
      ['KL', 'Klugheit', /(?:Klugheit|KL)\b\s*[.:]?\s*(\d{1,2})\b/i],
      ['IN', 'Intuition', /(?:Intuition|IN)\b\s*[.:]?\s*(\d{1,2})\b/i],
      ['CH', 'Charisma', /(?:Charisma|CH)\b\s*[.:]?\s*(\d{1,2})\b/i],
      ['FF', 'Fingerfertigkeit', /(?:Fingerfertigkeit|FF)\b\s*[.:]?\s*(\d{1,2})\b/i],
      ['GE', 'Gewandtheit', /(?:Gewandtheit|GE)\b\s*[.:]?\s*(\d{1,2})\b/i],
      ['KO', 'Konstitution', /(?:Konstitution|KO)\b\s*[.:]?\s*(\d{1,2})\b/i],
      ['KK', 'Körperkraft', /(?:Körperkraft|K[oö]rperkraft|KK)\b\s*[.:]?\s*(\d{1,2})\b/i],
    ];
    attrRes.forEach(([key, label, re]) => tryMatch(key, label, re, oneLine));

    tryMatch('at', 'AT (Angriff)', /\bAT\b\s*[.:]?\s*(-?\d{1,2})\b/i, oneLine);
    tryMatch('pa', 'PA (Parade)', /\bPA\b\s*[.:]?\s*(-?\d{1,2})\b/i, oneLine);
    tryMatch('rs', 'Rüstungsschutz RS', /\bRS\b\s*[.:]?\s*(\d{1,2})\b/i, oneLine);
    tryMatch('bewegung', 'BE (Belastung)', /\bBE\b\s*[.:]?\s*(\d{1,2})\b/i, oneLine);
    tryMatch('ini', 'INI', /\bINI\b\s*[.:]?\s*(-?\d{1,2})\b/i, oneLine);
    tryMatch('leMax', 'LE max.', /\bLE\b\s*[.:]?\s*(\d{1,3})\b/i, oneLine);
    tryMatch('aeMax', 'AE max.', /\bAE\b\s*[.:]?\s*(\d{1,3})\b/i, oneLine);

    // Name: erste Zeile mit Buchstaben
    const firstLine = t.split('\n').map((l) => l.trim()).find((l) => /[A-Za-zÄÖÜäöü]{2,}/.test(l));
    if (firstLine && !seen.has('name')) {
      const cleaned = firstLine.replace(/^[^A-Za-zÄÖÜäöü]+/, '').slice(0, 80);
      if (cleaned.length >= 2) {
        seen.add('name');
        mappings.push({ key: 'name', label: 'Name (heuristisch)', value: cleaned });
      }
    }

    return mappings;
  }

  function openOcrModal(rawText, mappings) {
    lastOcrMappings = mappings.map((m) => ({ ...m }));
    ocrRawPreview.textContent = rawText.slice(0, 4000) + (rawText.length > 4000 ? '\n…' : '');
    ocrMapBody.innerHTML = '';
    lastOcrMappings.forEach((m, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeAttr(m.label)} <small>(${escapeAttr(m.key)})</small></td>
        <td><input type="text" data-ocr-idx="${i}" class="ocr-val-input" value="${escapeAttr(m.value)}" /></td>
        <td><input type="checkbox" data-ocr-chk="${i}" checked /></td>
      `;
      ocrMapBody.appendChild(tr);
    });
    ocrModal.hidden = false;
  }

  function closeOcrModal() {
    ocrModal.hidden = true;
  }

  /**
   * Übernimmt ausgewählte OCR-Felder ins Formular
   */
  function applyOcrSelections() {
    ocrMapBody.querySelectorAll('[data-ocr-idx]').forEach((inp) => {
      const i = Number(inp.getAttribute('data-ocr-idx'));
      const chk = ocrMapBody.querySelector(`[data-ocr-chk="${i}"]`);
      if (!chk || !chk.checked) return;
      const val = inp.value.trim();
      const m = lastOcrMappings[i];
      if (!m) return;
      m.value = val;

      const key = m.key;
      if (ATTR_KEYS.includes(key)) {
        const node = el('attr-' + key);
        if (node) node.value = val.replace(/\D/g, '').slice(0, 2) || '';
      } else if (key === 'name') {
        el('name').value = val;
      } else if (key === 'at') el('at').value = val.replace(/[^\d-]/g, '').slice(0, 4);
      else if (key === 'pa') el('pa').value = val.replace(/[^\d-]/g, '').slice(0, 4);
      else if (key === 'rs') el('rs').value = val.replace(/\D/g, '').slice(0, 2);
      else if (key === 'bewegung') el('bewegung').value = val.replace(/\D/g, '').slice(0, 2);
      else if (key === 'ini') el('ini').value = val.replace(/[^\d-]/g, '').slice(0, 4);
      else if (key === 'leMax') el('leMax').value = val.replace(/\D/g, '').slice(0, 3);
      else if (key === 'aeMax') el('aeMax').value = val.replace(/\D/g, '').slice(0, 3);
    });
    updateDerivedDisplay();
    renderValidation();
    closeOcrModal();
    setOcrStatus('Ausgewählte OCR-Werte übernommen.', 'ok');
  }

  function setOcrStatus(msg, kind) {
    ocrStatus.textContent = msg;
    ocrStatus.classList.remove('is-error', 'is-ok');
    if (kind === 'error') ocrStatus.classList.add('is-error');
    if (kind === 'ok') ocrStatus.classList.add('is-ok');
  }

  async function runOcr() {
    if (!currentImageDataUrl) {
      setOcrStatus('Bitte zuerst ein Bild wählen.', 'error');
      return;
    }
    if (typeof Tesseract === 'undefined') {
      setOcrStatus('Tesseract.js nicht geladen (Netzwerk/CDN prüfen).', 'error');
      return;
    }
    btnRunOcr.disabled = true;
    setOcrStatus('OCR läuft … (kann einige Sekunden dauern)', '');
    try {
      const result = await Tesseract.recognize(currentImageDataUrl, 'deu', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const p = m.progress != null ? Math.round(m.progress * 100) : '';
            setOcrStatus(`OCR: Texterkennung … ${p}%`, '');
          }
        },
      });
      const text = result.data.text || '';
      const mappings = extractMappingsFromOcr(text);
      if (mappings.length === 0) {
        setOcrStatus('Keine typischen Felder erkannt. Rohtext im Dialog prüfen.', 'error');
        openOcrModal(text, [{ key: '_hint', label: 'Hinweis', value: 'Manuell Werte aus dem Text oben ablesen.' }]);
      } else {
        setOcrStatus(`${mappings.length} mögliche Treffer – bitte im Dialog prüfen.`, 'ok');
        openOcrModal(text, mappings);
      }
    } catch (e) {
      console.error(e);
      setOcrStatus('OCR fehlgeschlagen: ' + (e.message || e), 'error');
    } finally {
      btnRunOcr.disabled = false;
    }
  }

  // ——— API (optional) ———

  function apiUrl(path) {
    const base = (apiBaseUrl.value || '').replace(/\/$/, '');
    return base + path;
  }

  async function saveViaApi() {
    if (!useBackendApi.checked) {
      alert('Bitte „Express-API nutzen“ aktivieren.');
      return;
    }
    saveFormToCurrent();
    const h = getCurrentHero();
    try {
      const res = await fetch(apiUrl('/api/characters'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(h),
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Auf dem Server gespeichert.');
    } catch (e) {
      console.error(e);
      alert('API-Speichern fehlgeschlagen: ' + e.message);
    }
  }

  async function loadListFromApi() {
    if (!useBackendApi.checked) return;
    try {
      const res = await fetch(apiUrl('/api/characters'));
      if (!res.ok) throw new Error(await res.text());
      const list = await res.json();
      if (Array.isArray(list) && list.length) {
        characters = list.map(normalizeHero);
        currentId = characters[0].id;
        heroToForm(getCurrentHero());
        renderCharacterList();
        saveToStorage();
      }
    } catch (e) {
      console.warn('API-Liste nicht geladen:', e);
    }
  }

  // ——— Events ———

  function wireEvents() {
    heroForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveFormToCurrent();
      saveToStorage();
      renderCharacterList();
      renderValidation();
      setOcrStatus('Im Browser gespeichert.', 'ok');
    });

    heroForm.addEventListener('input', () => {
      updateDerivedDisplay();
      renderValidation();
    });

    el('btnNewHero').addEventListener('click', () => {
      saveFormToCurrent();
      const n = createEmptyHero();
      characters.push(n);
      currentId = n.id;
      saveToStorage();
      heroToForm(n);
      renderCharacterList();
      updateDerivedDisplay();
      renderValidation();
    });

    el('btnDuplicateHero').addEventListener('click', () => {
      saveFormToCurrent();
      const src = getCurrentHero();
      const copy = JSON.parse(JSON.stringify(src));
      copy.id = createEmptyHero().id;
      if (copy.stammdaten) copy.stammdaten.name = (copy.stammdaten.name || '') + ' (Kopie)';
      characters.push(normalizeHero(copy));
      currentId = characters[characters.length - 1].id;
      saveToStorage();
      heroToForm(getCurrentHero());
      renderCharacterList();
    });

    el('btnDeleteHero').addEventListener('click', () => {
      if (characters.length <= 1) {
        alert('Mindestens ein Held muss bleiben.');
        return;
      }
      if (!confirm('Diesen Helden wirklich löschen?')) return;
      characters = characters.filter((c) => c.id !== currentId);
      currentId = characters[0].id;
      saveToStorage();
      heroToForm(getCurrentHero());
      renderCharacterList();
      updateDerivedDisplay();
      renderValidation();
    });

    el('btnExportJson').addEventListener('click', () => {
      saveFormToCurrent();
      const h = getCurrentHero();
      const blob = new Blob([JSON.stringify(h, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (h.stammdaten.name || 'held').replace(/[^\wäöüÄÖÜß-]+/g, '_') + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    el('btnExportAllJson').addEventListener('click', () => {
      saveFormToCurrent();
      const bundle = {
        version: 1,
        exportiertAm: new Date().toISOString(),
        helden: characters.map((c) => JSON.parse(JSON.stringify(c))),
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'dsa4_alle_helden.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    el('importJson').addEventListener('change', (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result));
          /** @type {object[]} */
          let list = null;
          if (Array.isArray(data)) {
            list = data;
          } else if (data && Array.isArray(data.helden)) {
            list = data.helden;
          } else if (data && Array.isArray(data.characters)) {
            list = data.characters;
          }

          if (list && list.length) {
            if (!confirm(`${list.length} Helden aus Datei laden und die aktuelle Liste ersetzen?`)) {
              ev.target.value = '';
              return;
            }
            characters = list.map(normalizeHero);
            currentId = characters[0].id;
            saveToStorage();
            heroToForm(getCurrentHero());
            renderCharacterList();
            updateDerivedDisplay();
            renderValidation();
            setOcrStatus('Heldenliste aus JSON geladen.', 'ok');
            ev.target.value = '';
            return;
          }

          const h = normalizeHero(data);
          const existing = characters.findIndex((c) => c.id === h.id);
          if (existing >= 0) characters[existing] = h;
          else {
            h.id = createEmptyHero().id;
            characters.push(h);
          }
          currentId = h.id;
          saveToStorage();
          heroToForm(getCurrentHero());
          renderCharacterList();
          updateDerivedDisplay();
          renderValidation();
          setOcrStatus('JSON importiert.', 'ok');
        } catch (err) {
          alert('Import fehlgeschlagen: ' + err.message);
        }
        ev.target.value = '';
      };
      reader.readAsText(file, 'UTF-8');
    });

    el('btnAddTalent').addEventListener('click', () => addTalentRow({ name: '', probe: '', wert: null }));
    el('btnAddItem').addEventListener('click', () => addInventoryRow({ name: '', anzahl: 1, gewicht: '' }));

    imageUpload.addEventListener('change', () => {
      const file = imageUpload.files && imageUpload.files[0];
      if (!file) {
        currentImageDataUrl = null;
        uploadPreview.hidden = true;
        uploadPlaceholder.hidden = false;
        btnRunOcr.disabled = true;
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        currentImageDataUrl = String(reader.result);
        uploadPreview.src = currentImageDataUrl;
        uploadPreview.hidden = false;
        uploadPlaceholder.hidden = true;
        btnRunOcr.disabled = false;
      };
      reader.readAsDataURL(file);
    });

    btnClearImage.addEventListener('click', () => {
      imageUpload.value = '';
      currentImageDataUrl = null;
      uploadPreview.hidden = true;
      uploadPlaceholder.hidden = false;
      btnRunOcr.disabled = true;
      setOcrStatus('', '');
    });

    btnRunOcr.addEventListener('click', () => runOcr());

    ocrModal.querySelectorAll('[data-close-modal]').forEach((n) => {
      n.addEventListener('click', closeOcrModal);
    });
    el('ocrApplySelected').addEventListener('click', applyOcrSelections);

    el('btnSaveApi').addEventListener('click', () => saveViaApi());
    useBackendApi.addEventListener('change', () => {
      if (useBackendApi.checked) loadListFromApi();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !ocrModal.hidden) closeOcrModal();
    });
  }

  function init() {
    buildAttrInputs();
    loadFromStorage();
    wireEvents();
    heroToForm(getCurrentHero());
    renderCharacterList();
    updateDerivedDisplay();
    renderValidation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
