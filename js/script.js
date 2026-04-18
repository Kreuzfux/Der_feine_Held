/**
 * Der feine Held – DSA 4.0 Heldenbogen (Vanilla JS)
 * Supabase-Online-Speicher, JSON Import/Export, Tesseract-OCR
 */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://lruinpcervcagkmtvobh.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_B3S1bS6EYgZIDjf6bRJCAA_YgN9QGXz';
  // Admin-Zugriff über E-Mail-Whitelist (nach Bedarf erweitern).
  const ADMIN_EMAILS = [
    'nitzschkepa@yahoo.de',
  ];
  const AUTH_SESSION_KEY = 'dsa4_supabase_auth_session_v1';

  /** Eigenschaftskürzel DSA 4.0 */
  const ATTR_KEYS = ['MU', 'KL', 'IN', 'CH', 'FF', 'GE', 'KK'];

  /** Langbezeichnungen für OCR / Anzeige */
  const ATTR_LABELS = {
    MU: 'Mut',
    KL: 'Klugheit',
    IN: 'Intuition',
    CH: 'Charisma',
    FF: 'Fingerfertigkeit',
    GE: 'Gewandtheit',
    KK: 'Körperkraft',
  };

  let characters = [];
  let currentId = null;
  /** @type {string[]} Data-URLs für OCR (Bild oder gerenderte PDF-Seiten) */
  let currentOcrImageDataUrls = [];

  // ——— DOM ———
  const el = (id) => document.getElementById(id);

  const characterList = el('characterList');
  const heroForm = el('heroForm');
  const tabButtons = Array.from(document.querySelectorAll('[data-tab-target]'));
  const tabPanels = Array.from(document.querySelectorAll('[data-tab-content]'));
  const imageUpload = el('imageUpload');
  const uploadPreview = el('uploadPreview');
  const uploadPlaceholder = el('uploadPlaceholder');
  const btnRunOcr = el('btnRunOcr');
  const btnClearImage = el('btnClearImage');
  const ocrStatus = el('ocrStatus');
  const attrsContainer = el('attrsContainer');
  const talentsBody = el('talentsBody');
  const spellsBody = el('spellsBody');
  const runesBody = el('runesBody');
  const inventoryBody = el('inventoryBody');
  const ocrModal = el('ocrModal');
  const ocrRawPreview = el('ocrRawPreview');
  const ocrMapBody = el('ocrMapBody');
  const authEmail = el('authEmail');
  const authPassword = el('authPassword');
  const btnSignUp = el('btnSignUp');
  const btnSignIn = el('btnSignIn');
  const btnSignOut = el('btnSignOut');
  const authStatus = el('authStatus');
  const loginOnlyElements = Array.from(document.querySelectorAll('.auth-login-only'));
  const btnLoadAllOnline = el('btnLoadAllOnline');
  const btnDeleteOnline = el('btnDeleteOnline');
  /** Letzte OCR-Zeile für Modal */
  let lastOcrMappings = [];
  /** @type {{ access_token?: string, refresh_token?: string, user?: { id?: string, email?: string } } | null} */
  let authSession = null;

  function saveAuthSession() {
    try {
      if (authSession) localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authSession));
      else localStorage.removeItem(AUTH_SESSION_KEY);
    } catch (e) {
      console.warn('Auth-Session konnte nicht gespeichert werden:', e);
    }
  }

  function loadAuthSession() {
    try {
      const raw = localStorage.getItem(AUTH_SESSION_KEY);
      if (!raw) return;
      authSession = JSON.parse(raw);
    } catch (e) {
      console.warn('Auth-Session konnte nicht geladen werden:', e);
      authSession = null;
    }
  }

  function parseJwtPayload(token) {
    try {
      const base64 = token.split('.')[1];
      if (!base64) return null;
      const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function getCurrentUserId() {
    if (authSession?.user?.id) return authSession.user.id;
    const token = authSession?.access_token;
    if (!token) return null;
    const payload = parseJwtPayload(token);
    return payload?.sub || payload?.user_id || null;
  }

  function updateAuthUi() {
    const email = authSession?.user?.email || null;
    const loggedIn = !!authSession?.access_token && !!getCurrentUserId();
    const admin = isAdmin();
    authStatus.textContent = loggedIn
      ? `Angemeldet: ${email || 'Benutzer'}${admin ? ' (Admin)' : ''}`
      : 'Nicht angemeldet';
    btnSignOut.disabled = !loggedIn;
    btnSignIn.disabled = loggedIn;
    btnSignUp.disabled = loggedIn;
    loginOnlyElements.forEach((node) => {
      node.hidden = loggedIn;
    });
    btnLoadAllOnline.hidden = !admin;
    btnDeleteOnline.hidden = !admin;
    btnDeleteOnline.disabled = !admin || !loggedIn;
  }

  function isAdmin() {
    const email = (authSession?.user?.email || '').toLowerCase();
    if (!email) return false;
    return ADMIN_EMAILS.map((x) => x.toLowerCase()).includes(email);
  }

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
      /** OCR-Quelle (Scan/Foto/PDF als Data-URLs) */
      ocr: {
        /** @type {string[]} */
        dataUrls: [],
      },
      stammdaten: {
        name: '',
        rasse: '',
        geschlecht: '',
        profession: '',
        stand: '',
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
      zauberei: [],
      runen: [],
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
    const rawOcr = raw.ocr || {};
    const dataUrls = Array.isArray(rawOcr.dataUrls)
      ? rawOcr.dataUrls
      : (Array.isArray(raw.ocrDataUrls) ? raw.ocrDataUrls : []);
    h.ocr = {
      dataUrls: dataUrls
        .filter((x) => typeof x === 'string' && x.length)
        // Safety: keep size bounded (PDF pages can get big)
        .slice(0, 10),
    };
    const s = raw.stammdaten || {};
    h.stammdaten = {
      name: s.name ?? raw.name ?? '',
      rasse: s.rasse ?? raw.rasse ?? '',
      geschlecht: s.geschlecht ?? '',
      profession: s.profession ?? '',
      stand: s.stand ?? '',
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
    h.zauberei = Array.isArray(raw.zauberei) ? raw.zauberei.map((z) => ({
      name: String(z.name || ''),
      merkmal: String(z.merkmal || ''),
      wert: numOrNull(z.wert),
    })) : [];
    h.runen = Array.isArray(raw.runen) ? raw.runen.map((r) => ({
      name: String(r.name || ''),
      typ: String(r.typ || ''),
      stufe: numOrNull(r.stufe),
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
    const kk = g('KK');

    const teile5 = (a, b, c) => {
      if (a == null || b == null || c == null) return null;
      return Math.round((a + b + c) / 5);
    };

    return {
      atBasis: teile5(mu, inn, ge),
      paBasis: teile5(inn, ge, kk),
      fkBasis: teile5(inn, ff, kk),
      mrBasis: teile5(mu, kl, ch),
      leMensch: null,
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
    set('derivedMr', d.mrBasis);
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

    el('leAktuell').value = h.energien.leAktuell != null ? h.energien.leAktuell : '';
    el('leMax').value = h.energien.leMax != null ? h.energien.leMax : '';
    el('aeAktuell').value = h.energien.aeAktuell != null ? h.energien.aeAktuell : '';
    el('aeMax').value = h.energien.aeMax != null ? h.energien.aeMax : '';
    el('auAktuell').value = h.energien.auAktuell != null ? h.energien.auAktuell : '';
    el('auMax').value = h.energien.auMax != null ? h.energien.auMax : '';

    el('notizen').value = h.notizen || '';

    renderTalentsTable(h.talente);
    renderSpellsTable(h.zauberei);
    renderRunesTable(h.runen);
    renderInventoryTable(h.inventar);

    // OCR-Vorschau pro Held wiederherstellen
    applyOcrSourceFromHero(h);
  }

  function applyOcrSourceFromHero(h) {
    const dataUrls = Array.isArray(h?.ocr?.dataUrls) ? h.ocr.dataUrls : [];
    currentOcrImageDataUrls = dataUrls;
    if (dataUrls.length) {
      uploadPreview.src = dataUrls[0];
      uploadPreview.hidden = false;
      uploadPlaceholder.hidden = true;
      btnRunOcr.disabled = false;
      setOcrStatus(`Bild/PDF aus Helddaten geladen: ${dataUrls.length} Seite(n) für OCR bereit.`, 'ok');
    } else {
      uploadPreview.hidden = true;
      uploadPlaceholder.hidden = false;
      btnRunOcr.disabled = true;
    }
    imageUpload.value = '';
  }

  function formToHero() {
    const h = normalizeHero(getCurrentHero());
    h.stammdaten.name = el('name').value.trim();
    h.stammdaten.rasse = el('rasse').value.trim();
    h.stammdaten.geschlecht = el('geschlecht').value.trim();
    h.stammdaten.profession = el('profession').value.trim();
    h.stammdaten.stand = el('stand').value.trim();
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

    h.energien.leAktuell = numOrNull(el('leAktuell').value);
    h.energien.leMax = numOrNull(el('leMax').value);
    h.energien.aeAktuell = numOrNull(el('aeAktuell').value);
    h.energien.aeMax = numOrNull(el('aeMax').value);
    h.energien.auAktuell = numOrNull(el('auAktuell').value);
    h.energien.auMax = numOrNull(el('auMax').value);

    h.notizen = el('notizen').value;
    h.talente = readTalentsFromTable();
    h.zauberei = readSpellsFromTable();
    h.runen = readRunesFromTable();
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
      <td><input type="text" class="tal-probe" placeholder="GE/IN/KK" value="${escapeAttr(row.probe)}" /></td>
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

  function renderSpellsTable(rows) {
    spellsBody.innerHTML = '';
    const data = rows.length ? rows : [{ name: '', merkmal: '', wert: null }];
    data.forEach((row) => addSpellRow(row));
  }

  function addSpellRow(row) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="spl-name" placeholder="z. B. Fulminictus" value="${escapeAttr(row.name)}" /></td>
      <td><input type="text" class="spl-merkmal" placeholder="Schaden / Gildenmagie" value="${escapeAttr(row.merkmal)}" /></td>
      <td><input type="number" class="spl-wert" min="0" max="25" step="1" value="${row.wert != null ? row.wert : ''}" /></td>
      <td><button type="button" class="btn btn-ghost btn-icon btn-remove-spl" aria-label="Zeile entfernen">✕</button></td>
    `;
    tr.querySelector('.btn-remove-spl').addEventListener('click', () => {
      if (spellsBody.querySelectorAll('tr').length <= 1) {
        tr.querySelector('.spl-name').value = '';
        tr.querySelector('.spl-merkmal').value = '';
        tr.querySelector('.spl-wert').value = '';
        return;
      }
      tr.remove();
    });
    spellsBody.appendChild(tr);
  }

  function readSpellsFromTable() {
    const out = [];
    spellsBody.querySelectorAll('tr').forEach((tr) => {
      const name = tr.querySelector('.spl-name')?.value.trim() || '';
      const merkmal = tr.querySelector('.spl-merkmal')?.value.trim() || '';
      const wert = numOrNull(tr.querySelector('.spl-wert')?.value);
      if (name || merkmal || wert != null) out.push({ name, merkmal, wert });
    });
    return out;
  }

  function renderRunesTable(rows) {
    runesBody.innerHTML = '';
    const data = rows.length ? rows : [{ name: '', typ: '', stufe: null }];
    data.forEach((row) => addRuneRow(row));
  }

  function addRuneRow(row) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="run-name" placeholder="z. B. Schutzrune" value="${escapeAttr(row.name)}" /></td>
      <td><input type="text" class="run-typ" placeholder="Abwehr / Buff" value="${escapeAttr(row.typ)}" /></td>
      <td><input type="number" class="run-stufe" min="0" max="25" step="1" value="${row.stufe != null ? row.stufe : ''}" /></td>
      <td><button type="button" class="btn btn-ghost btn-icon btn-remove-run" aria-label="Zeile entfernen">✕</button></td>
    `;
    tr.querySelector('.btn-remove-run').addEventListener('click', () => {
      if (runesBody.querySelectorAll('tr').length <= 1) {
        tr.querySelector('.run-name').value = '';
        tr.querySelector('.run-typ').value = '';
        tr.querySelector('.run-stufe').value = '';
        return;
      }
      tr.remove();
    });
    runesBody.appendChild(tr);
  }

  function readRunesFromTable() {
    const out = [];
    runesBody.querySelectorAll('tr').forEach((tr) => {
      const name = tr.querySelector('.run-name')?.value.trim() || '';
      const typ = tr.querySelector('.run-typ')?.value.trim() || '';
      const stufe = numOrNull(tr.querySelector('.run-stufe')?.value);
      if (name || typ || stufe != null) out.push({ name, typ, stufe });
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

  /**
   * Liefert OCR-freundliche Textvarianten und normalisiert häufige OCR-Fehler.
   * @param {string} text
   * @returns {{ raw: string, normalized: string, collapsed: string }}
   */
  function buildOcrTextVariants(text) {
    const raw = String(text || '').replace(/\r/g, '\n');
    const normalized = raw
      // Häufige OCR-Verwechslungen in Beschriftungen
      .replace(/\bK1\b/g, 'KL')
      .replace(/\b1N\b/g, 'IN')
      .replace(/\bI N\b/g, 'IN')
      .replace(/\bP A\b/g, 'PA')
      .replace(/\bA T\b/g, 'AT')
      .replace(/\bR S\b/g, 'RS')
      .replace(/\bB E\b/g, 'BE')
      .replace(/\bL E\b/g, 'LE')
      .replace(/\bA E\b/g, 'AE')
      .replace(/\bK K\b/g, 'KK')
      .replace(/\bG E\b/g, 'GE')
      .replace(/\bF F\b/g, 'FF');
    const collapsed = normalized.replace(/[ \t]+/g, ' ').replace(/\n+/g, '\n');
    return { raw, normalized, collapsed };
  }

  /**
   * Erzeugt ein kontrastverstärktes Graustufenbild für OCR.
   * @param {string} dataUrl
   * @returns {Promise<string>}
   */
  async function preprocessImageForOcr(dataUrl) {
    const img = new Image();
    img.decoding = 'async';
    img.src = dataUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const scale = Math.min(2.2, Math.max(1.4, 1800 / Math.max(img.width, img.height)));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return dataUrl;

    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const p = imageData.data;

    // Graustufen + leichter Kontrast-Boost + sanftes Thresholding
    for (let i = 0; i < p.length; i += 4) {
      const gray = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
      const bin = contrast > 156 ? 255 : contrast < 92 ? 0 : contrast;
      p[i] = bin;
      p[i + 1] = bin;
      p[i + 2] = bin;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  // ——— OCR: Regex-Muster für typische Bogen-Beschriftungen (DE) ———

  /**
   * @param {string} text Rohtext von Tesseract
   * @returns {Array<{ key: string, label: string, value: string }>}
   */
  function extractMappingsFromOcr(text) {
    const variants = buildOcrTextVariants(text);
    const t = variants.collapsed;
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

    /**
     * Findet "Label ... Zahl" auch über mehrere Zeilen.
     * @param {string} key
     * @param {string} label
     * @param {RegExp} labelRe
     * @param {number} digits
     */
    function tryNearbyNumber(key, label, labelRe, digits) {
      if (seen.has(key)) return;
      const lines = t.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        if (!labelRe.test(lines[i])) continue;
        const region = [lines[i], lines[i + 1] || '', lines[i + 2] || ''].join(' ');
        const m = region.match(new RegExp(`(-?\\d{1,${digits}})`));
        if (m && m[1] != null) {
          seen.add(key);
          mappings.push({ key, label, value: String(m[1]).trim() });
          return;
        }
      }
    }

    // Eigenschaften: Kürzel oder ausgeschrieben
    const attrRes = [
      ['MU', 'Mut', /(?:^|[^A-ZÄÖÜ])(?:Mut|MU)\b\s*[:.=]?\s*(\d{1,2})\b/i],
      ['KL', 'Klugheit', /(?:Klugheit|KL)\b\s*[:.=]?\s*(\d{1,2})\b/i],
      ['IN', 'Intuition', /(?:Intuition|IN)\b\s*[:.=]?\s*(\d{1,2})\b/i],
      ['CH', 'Charisma', /(?:Charisma|CH)\b\s*[:.=]?\s*(\d{1,2})\b/i],
      ['FF', 'Fingerfertigkeit', /(?:Fingerfertigkeit|FF)\b\s*[:.=]?\s*(\d{1,2})\b/i],
      ['GE', 'Gewandtheit', /(?:Gewandtheit|GE)\b\s*[:.=]?\s*(\d{1,2})\b/i],
      ['KK', 'Körperkraft', /(?:Körperkraft|K[oö]rperkraft|KK)\b\s*[:.=]?\s*(\d{1,2})\b/i],
    ];
    attrRes.forEach(([key, label, re]) => tryMatch(key, label, re, oneLine));
    // Fallback: Label und Zahl stehen ggf. in benachbarten Zeilen
    tryNearbyNumber('MU', 'Mut', /\b(?:Mut|MU)\b/i, 2);
    tryNearbyNumber('KL', 'Klugheit', /\b(?:Klugheit|KL)\b/i, 2);
    tryNearbyNumber('IN', 'Intuition', /\b(?:Intuition|IN)\b/i, 2);
    tryNearbyNumber('CH', 'Charisma', /\b(?:Charisma|CH)\b/i, 2);
    tryNearbyNumber('FF', 'Fingerfertigkeit', /\b(?:Fingerfertigkeit|FF)\b/i, 2);
    tryNearbyNumber('GE', 'Gewandtheit', /\b(?:Gewandtheit|GE)\b/i, 2);
    tryNearbyNumber('KK', 'Körperkraft', /\b(?:K[oö]rperkraft|KK)\b/i, 2);

    tryMatch('at', 'AT (Angriff)', /\bAT\b\s*[:.=]?\s*(-?\d{1,2})\b/i, oneLine);
    tryMatch('pa', 'PA (Parade)', /\bPA\b\s*[:.=]?\s*(-?\d{1,2})\b/i, oneLine);
    tryMatch('rs', 'Rüstungsschutz RS', /\bRS\b\s*[:.=]?\s*(\d{1,2})\b/i, oneLine);
    tryMatch('bewegung', 'BE (Belastung)', /\bBE\b\s*[:.=]?\s*(\d{1,2})\b/i, oneLine);
    tryMatch('leMax', 'LE max.', /\b(?:LE|Lebensenergie)\b\s*[:.=]?\s*(\d{1,3})\b/i, oneLine);
    tryMatch('aeMax', 'AE max.', /\b(?:AE|Astralenergie)\b\s*[:.=]?\s*(\d{1,3})\b/i, oneLine);
    tryNearbyNumber('at', 'AT (Angriff)', /\bAT\b/i, 2);
    tryNearbyNumber('pa', 'PA (Parade)', /\bPA\b/i, 2);
    tryNearbyNumber('rs', 'Rüstungsschutz RS', /\bRS\b/i, 2);
    tryNearbyNumber('bewegung', 'BE (Belastung)', /\bBE\b/i, 2);
    tryNearbyNumber('leMax', 'LE max.', /\b(?:LE|Lebensenergie)\b/i, 3);
    tryNearbyNumber('aeMax', 'AE max.', /\b(?:AE|Astralenergie)\b/i, 3);

    // Name: erste Zeile mit Buchstaben
    const firstLine = t.split('\n').map((l) => l.trim()).find((l) => /[A-Za-zÄÖÜäöü]{2,}/.test(l));
    if (firstLine && !seen.has('name')) {
      const cleaned = firstLine.replace(/^[^A-Za-zÄÖÜäöü]+/, '').slice(0, 80);
      if (cleaned.length >= 2) {
        seen.add('name');
        mappings.push({ key: 'name', label: 'Name (heuristisch)', value: cleaned });
      }
    }

    // Strukturierte OCR-Zeilen für die neuen Bereiche:
    // Talent: Athletik 7
    // Zauber: Fulminictus 9
    // Rune: Schutzrune 3
    const lines = t.split('\n').map((x) => x.trim()).filter(Boolean);
    let talentIdx = 0;
    let spellIdx = 0;
    let runeIdx = 0;

    lines.forEach((line) => {
      let m = line.match(/^(?:Talent|Tal\.?)\s*[:\-]\s*([A-Za-zÄÖÜäöüß0-9 \-\/]{2,})\s+(\d{1,2})$/i);
      if (m) {
        mappings.push({
          key: `talent:${talentIdx++}`,
          label: 'Talent Daten',
          value: `${m[1].trim()}|${m[2]}`,
        });
        return;
      }

      m = line.match(/^(?:Zauber|Spruch|Ritual)\s*[:\-]\s*([A-Za-zÄÖÜäöüß0-9 \-\/]{2,})\s+(\d{1,2})$/i);
      if (m) {
        mappings.push({
          key: `zauber:${spellIdx++}`,
          label: 'Zauberei Daten',
          value: `${m[1].trim()}|${m[2]}`,
        });
        return;
      }

      m = line.match(/^(?:Rune|Runen)\s*[:\-]\s*([A-Za-zÄÖÜäöüß0-9 \-\/]{2,})\s+(\d{1,2})$/i);
      if (m) {
        mappings.push({
          key: `rune:${runeIdx++}`,
          label: 'Runen Daten',
          value: `${m[1].trim()}|${m[2]}`,
        });
      }
    });

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
      } else if (key.startsWith('talent:')) {
        const [name, wertStr] = val.split('|');
        addTalentRow({ name: (name || '').trim(), probe: '', wert: numOrNull((wertStr || '').trim()) });
      } else if (key.startsWith('zauber:')) {
        const [name, wertStr] = val.split('|');
        addSpellRow({ name: (name || '').trim(), merkmal: '', wert: numOrNull((wertStr || '').trim()) });
      } else if (key.startsWith('rune:')) {
        const [name, stufeStr] = val.split('|');
        addRuneRow({ name: (name || '').trim(), typ: '', stufe: numOrNull((stufeStr || '').trim()) });
      } else if (key === 'at') el('at').value = val.replace(/[^\d-]/g, '').slice(0, 4);
      else if (key === 'pa') el('pa').value = val.replace(/[^\d-]/g, '').slice(0, 4);
      else if (key === 'rs') el('rs').value = val.replace(/\D/g, '').slice(0, 2);
      else if (key === 'bewegung') el('bewegung').value = val.replace(/\D/g, '').slice(0, 2);
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

  function switchTab(tabKey) {
    tabButtons.forEach((btn) => {
      const active = btn.getAttribute('data-tab-target') === tabKey;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    tabPanels.forEach((panel) => {
      const active = panel.getAttribute('data-tab-content') === tabKey;
      panel.classList.toggle('is-active', active);
    });
  }

  async function runOcr() {
    if (!currentOcrImageDataUrls.length) {
      setOcrStatus('Bitte zuerst ein Bild oder PDF wählen.', 'error');
      return;
    }
    if (typeof Tesseract === 'undefined') {
      setOcrStatus('Tesseract.js nicht geladen (Netzwerk/CDN prüfen).', 'error');
      return;
    }
    btnRunOcr.disabled = true;
    setOcrStatus('OCR läuft … Quelle wird vorbereitet.', '');
    try {
      const mappingByKey = new Map();
      const allTexts = [];
      for (let pageIndex = 0; pageIndex < currentOcrImageDataUrls.length; pageIndex += 1) {
        const source = currentOcrImageDataUrls[pageIndex];
        setOcrStatus(
          `OCR: Seite/Bild ${pageIndex + 1} von ${currentOcrImageDataUrls.length} wird vorbereitet …`,
          ''
        );
        const processed = await preprocessImageForOcr(source);
        const options = {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const p = m.progress != null ? Math.round(m.progress * 100) : '';
              setOcrStatus(
                `OCR Seite/Bild ${pageIndex + 1}/${currentOcrImageDataUrls.length}: ${p}%`,
                ''
              );
            }
          },
        };

        const [resA, resB] = await Promise.all([
          Tesseract.recognize(processed, 'deu', options),
          // Zweiter Durchlauf hilft oft bei Mischtexten/Abkürzungen
          Tesseract.recognize(processed, 'deu+eng', options),
        ]);

        const textA = resA.data.text || '';
        const textB = resB.data.text || '';
        const mapA = extractMappingsFromOcr(textA);
        const mapB = extractMappingsFromOcr(textB);
        const text = textA.length >= textB.length ? textA : textB;
        allTexts.push(`=== Seite/Bild ${pageIndex + 1} ===\n${text}`);

        mapA.forEach((m) => mappingByKey.set(m.key, m));
        mapB.forEach((m) => {
          if (!mappingByKey.has(m.key)) mappingByKey.set(m.key, m);
        });
      }

      const mappings = Array.from(mappingByKey.values());
      const text = allTexts.join('\n\n');
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

  /**
   * Rendert ein PDF in mehrere Canvas-Seiten und liefert Data-URLs für OCR.
   * @param {ArrayBuffer} pdfBuffer
   * @returns {Promise<string[]>}
   */
  async function renderPdfToImageDataUrls(pdfBuffer) {
    const pdfjs = window.pdfjsLib;
    if (!pdfjs) {
      throw new Error('PDF.js nicht geladen. Bitte Seite neu laden.');
    }
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';
    }
    const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    const maxPages = Math.min(pageCount, 6);
    const out = [];

    for (let i = 1; i <= maxPages; i += 1) {
      setOcrStatus(`PDF wird vorbereitet: Seite ${i}/${maxPages} …`, '');
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      out.push(canvas.toDataURL('image/png'));
    }

    if (pageCount > maxPages) {
      setOcrStatus(`PDF hat ${pageCount} Seiten. Für OCR werden die ersten ${maxPages} verarbeitet.`, '');
    }
    return out;
  }

  function getSupabaseConfig() {
    const url = (SUPABASE_URL || '').trim().replace(/\/$/, '');
    const key = (SUPABASE_KEY || '').trim();
    if (!url || !key) return null;
    return { url, key };
  }

  /**
   * Supabase akzeptiert apikey; Authorization mit Bearer ist nur für JWT-Keys sinnvoll.
   * @param {string} key
   * @param {boolean} withJson
   * @returns {Record<string, string>}
   */
  function getSupabaseHeaders(key, withJson, accessToken) {
    const headers = {
      apikey: key,
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    } else if (/^eyJ[A-Za-z0-9_-]+\./.test(key)) {
      headers.Authorization = `Bearer ${key}`;
    }
    if (withJson) headers['Content-Type'] = 'application/json';
    return headers;
  }

  async function signUp() {
    const email = (authEmail.value || '').trim();
    const password = authPassword.value || '';
    if (!email || !password) {
      alert('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: getSupabaseHeaders(SUPABASE_KEY, true),
        body: JSON.stringify({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.msg || data?.error_description || JSON.stringify(data));
      if (data?.access_token) {
        authSession = data;
        saveAuthSession();
        updateAuthUi();
      }
      alert('Registrierung erfolgreich. Falls nötig, E-Mail bestätigen und dann einloggen.');
    } catch (e) {
      console.error(e);
      alert('Registrierung fehlgeschlagen: ' + (e.message || e));
    }
  }

  async function signIn() {
    const email = (authEmail.value || '').trim();
    const password = authPassword.value || '';
    if (!email || !password) {
      alert('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: getSupabaseHeaders(SUPABASE_KEY, true),
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.msg || data?.error_description || JSON.stringify(data));
      authSession = data;
      saveAuthSession();
      updateAuthUi();
      alert('Login erfolgreich.');
    } catch (e) {
      console.error(e);
      alert('Login fehlgeschlagen: ' + (e.message || e));
    }
  }

  async function signOut() {
    const token = authSession?.access_token;
    try {
      if (token) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: getSupabaseHeaders(SUPABASE_KEY, false, token),
        });
      }
    } catch (e) {
      console.warn('Logout-Request fehlgeschlagen:', e);
    } finally {
      authSession = null;
      saveAuthSession();
      updateAuthUi();
    }
  }

  async function saveCurrentHeroToSupabase() {
    const cfg = getSupabaseConfig();
    if (!cfg) {
      alert('Supabase-Konfiguration fehlt.');
      return;
    }
    const userId = getCurrentUserId();
    if (!userId || !authSession?.access_token) {
      alert('Bitte zuerst einloggen.');
      return;
    }
    saveFormToCurrent();
    const h = getCurrentHero();
    const payload = [{
      id: h.id,
      user_id: userId,
      data: h,
      updated_at: new Date().toISOString(),
    }];
    try {
      const res = await fetch(`${cfg.url}/rest/v1/heroes?on_conflict=id`, {
        method: 'POST',
        headers: {
          ...getSupabaseHeaders(cfg.key, true, authSession.access_token),
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Held online gespeichert.');
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || e || 'Unbekannter Fehler');
      if (/401|403|permission|jwt|apikey/i.test(msg)) {
        alert('Online-Speichern fehlgeschlagen: Zugriff verweigert. Prüfe anon key und RLS-Policies.');
      } else if (/column .*user_id|user_id.*does not exist/i.test(msg)) {
        alert('Online-Speichern fehlgeschlagen: In public.heroes fehlt die Spalte user_id.');
      } else if (/relation .*heroes|does not exist/i.test(msg)) {
        alert('Online-Speichern fehlgeschlagen: Tabelle public.heroes fehlt.');
      } else {
        alert('Online-Speichern fehlgeschlagen: ' + msg);
      }
    }
  }

  async function loadHeroesFromSupabase() {
    const cfg = getSupabaseConfig();
    if (!cfg) {
      alert('Supabase-Konfiguration fehlt.');
      return;
    }
    const userId = getCurrentUserId();
    if (!userId || !authSession?.access_token) {
      alert('Bitte zuerst einloggen.');
      return;
    }
    try {
      const res = await fetch(
        `${cfg.url}/rest/v1/heroes?select=id,data,updated_at,user_id&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`,
        {
          headers: getSupabaseHeaders(cfg.key, false, authSession.access_token),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        alert('Keine Online-Helden gefunden.');
        return;
      }
      const list = rows
        .map((r) => normalizeHero(r.data))
        .filter((h) => h && h.id);
      if (!list.length) {
        alert('Online-Daten enthalten keine gültigen Helden.');
        return;
      }
      characters = list;
      currentId = characters[0].id;
      heroToForm(getCurrentHero());
      renderCharacterList();
      updateDerivedDisplay();
      renderValidation();
      alert(`${characters.length} Helden online geladen.`);
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || e || 'Unbekannter Fehler');
      if (/401|403|permission|jwt|apikey/i.test(msg)) {
        alert('Online-Laden fehlgeschlagen: Zugriff verweigert. Prüfe anon key und RLS-Policies.');
      } else if (/column .*user_id|user_id.*does not exist/i.test(msg)) {
        alert('Online-Laden fehlgeschlagen: In public.heroes fehlt die Spalte user_id.');
      } else if (/relation .*heroes|does not exist/i.test(msg)) {
        alert('Online-Laden fehlgeschlagen: Tabelle public.heroes fehlt.');
      } else {
        alert('Online-Laden fehlgeschlagen: ' + msg);
      }
    }
  }

  async function deleteCurrentHeroFromSupabase() {
    const cfg = getSupabaseConfig();
    if (!cfg) {
      alert('Supabase-Konfiguration fehlt.');
      return;
    }
    if (!isAdmin() || !authSession?.access_token) {
      alert('Admin-Zugriff erforderlich.');
      return;
    }
    const h = getCurrentHero();
    if (!h?.id) {
      alert('Kein Held ausgewählt.');
      return;
    }
    const name = h?.stammdaten?.name || '(Unbenannt)';
    if (!confirm(`Diesen Online-Helden wirklich löschen?\n${name}`)) return;

    try {
      const res = await fetch(
        `${cfg.url}/rest/v1/heroes?id=eq.${encodeURIComponent(h.id)}`,
        {
          method: 'DELETE',
          headers: {
            ...getSupabaseHeaders(cfg.key, true, authSession.access_token),
            Prefer: 'return=representation',
          },
        }
      );
      if (!res.ok) throw new Error(await res.text());

      characters = characters.filter((c) => c.id !== h.id);
      if (!characters.length) {
        characters = [createEmptyHero()];
      }
      currentId = characters[0].id;
      heroToForm(getCurrentHero());
      renderCharacterList();
      updateDerivedDisplay();
      renderValidation();
      alert('Held online gelöscht.');
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || e || 'Unbekannter Fehler');
      if (/401|403|permission|jwt|apikey/i.test(msg)) {
        alert('Online-Löschen fehlgeschlagen: Zugriff verweigert. Prüfe RLS-Policies für DELETE.');
      } else {
        alert('Online-Löschen fehlgeschlagen: ' + msg);
      }
    }
  }

  async function loadAllHeroesFromSupabase() {
    const cfg = getSupabaseConfig();
    if (!cfg) {
      alert('Supabase-Konfiguration fehlt.');
      return;
    }
    if (!isAdmin() || !authSession?.access_token) {
      alert('Admin-Zugriff erforderlich.');
      return;
    }
    try {
      const res = await fetch(
        `${cfg.url}/rest/v1/heroes?select=id,data,updated_at,user_id&order=updated_at.desc`,
        {
          headers: getSupabaseHeaders(cfg.key, false, authSession.access_token),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        alert('Keine Online-Helden gefunden.');
        return;
      }
      const list = rows.map((r) => normalizeHero(r.data)).filter((h) => h && h.id);
      if (!list.length) {
        alert('Online-Daten enthalten keine gültigen Helden.');
        return;
      }
      characters = list;
      currentId = characters[0].id;
      heroToForm(getCurrentHero());
      renderCharacterList();
      updateDerivedDisplay();
      renderValidation();
      alert(`${characters.length} Helden (alle Nutzer) geladen.`);
    } catch (e) {
      console.error(e);
      alert('Admin-Laden fehlgeschlagen: ' + (e.message || e));
    }
  }

  // ——— Events ———

  function wireEvents() {
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-tab-target');
        if (key) switchTab(key);
      });
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
      heroToForm(getCurrentHero());
      renderCharacterList();
      updateDerivedDisplay();
      renderValidation();
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
    el('btnAddSpell').addEventListener('click', () => addSpellRow({ name: '', merkmal: '', wert: null }));
    el('btnAddRune').addEventListener('click', () => addRuneRow({ name: '', typ: '', stufe: null }));
    el('btnAddItem').addEventListener('click', () => addInventoryRow({ name: '', anzahl: 1, gewicht: '' }));

    imageUpload.addEventListener('change', () => {
      const file = imageUpload.files && imageUpload.files[0];
      if (!file) {
        currentOcrImageDataUrls = [];
        const h = getCurrentHero();
        if (h?.ocr) h.ocr.dataUrls = [];
        uploadPreview.hidden = true;
        uploadPlaceholder.hidden = false;
        btnRunOcr.disabled = true;
        return;
      }
      const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
      if (isPdf) {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            setOcrStatus('PDF wird eingelesen …', '');
            const dataUrls = await renderPdfToImageDataUrls(reader.result);
            currentOcrImageDataUrls = dataUrls;
            const h = getCurrentHero();
            if (h?.ocr) h.ocr.dataUrls = dataUrls;
            if (!dataUrls.length) throw new Error('Keine PDF-Seiten renderbar.');
            uploadPreview.src = dataUrls[0];
            uploadPreview.hidden = false;
            uploadPlaceholder.hidden = true;
            btnRunOcr.disabled = false;
            setOcrStatus(`PDF geladen: ${dataUrls.length} Seite(n) für OCR bereit.`, 'ok');
          } catch (e) {
            console.error(e);
            currentOcrImageDataUrls = [];
            const h = getCurrentHero();
            if (h?.ocr) h.ocr.dataUrls = [];
            uploadPreview.hidden = true;
            uploadPlaceholder.hidden = false;
            btnRunOcr.disabled = true;
            setOcrStatus('PDF konnte nicht verarbeitet werden: ' + (e.message || e), 'error');
          }
        };
        reader.readAsArrayBuffer(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        currentOcrImageDataUrls = [dataUrl];
        const h = getCurrentHero();
        if (h?.ocr) h.ocr.dataUrls = [dataUrl];
        uploadPreview.src = dataUrl;
        uploadPreview.hidden = false;
        uploadPlaceholder.hidden = true;
        btnRunOcr.disabled = false;
        setOcrStatus('Bild geladen. OCR bereit.', 'ok');
      };
      reader.readAsDataURL(file);
    });

    btnClearImage.addEventListener('click', () => {
      imageUpload.value = '';
      currentOcrImageDataUrls = [];
      const h = getCurrentHero();
      if (h?.ocr) h.ocr.dataUrls = [];
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

    el('btnSaveOnline').addEventListener('click', () => saveCurrentHeroToSupabase());
    el('btnLoadOnline').addEventListener('click', () => loadHeroesFromSupabase());
    btnLoadAllOnline.addEventListener('click', () => loadAllHeroesFromSupabase());
    btnDeleteOnline.addEventListener('click', () => deleteCurrentHeroFromSupabase());
    btnSignUp.addEventListener('click', () => signUp());
    btnSignIn.addEventListener('click', () => signIn());
    btnSignOut.addEventListener('click', () => signOut());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !ocrModal.hidden) closeOcrModal();
    });
  }

  function init() {
    buildAttrInputs();
    loadAuthSession();
    updateAuthUi();
    characters = [createEmptyHero()];
    currentId = characters[0].id;
    wireEvents();
    heroToForm(getCurrentHero());
    renderCharacterList();
    updateDerivedDisplay();
    renderValidation();
    switchTab('stammdaten');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


