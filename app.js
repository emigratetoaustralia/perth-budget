'use strict';

// ── State ────────────────────────────────────────────────────
const state = {
  householdSize:    3,
  housingType:      'renter',
  housingSubRent:   '2bed',   // '2bed' | '3bed'
  housingSubOwner:  'apt',    // 'apt'  | 'house'
  visaType:         'pr',
  eurPerAud:        null,
  groceryChoice:    'aldi',
  hasKids:          true,
  hasPets:          true,
  kindyChildren:    [],       // [{bgType: 'municipal'|'private'}]
  schoolChildren:   [],       // [{}]  one entry per school-age child
  bgOverrides:      {},
};

let CFG = null;

// ── Boot ─────────────────────────────────────────────────────
fetch('data.json')
  .then(r => r.json())
  .then(data => {
    CFG = data;
    initInput();
  })
  .catch(() => {
    document.body.innerHTML =
      '<p style="padding:2rem;color:#990300">Грешка при зареждане на данните. Провери интернет връзката.</p>';
  });

// ── Input screen ─────────────────────────────────────────────
function initInput() {
  bindSegment('ctrl-household', v => {
    state.householdSize = v === '4' ? 4 : parseInt(v);
    setDefaultHousingSub();
  });
  bindToggle('ctrl-housing', v => { state.housingType = v; });
  bindToggle('ctrl-visa',    v => { state.visaType    = v; });

  document.getElementById('chk-kids').addEventListener('change', e => {
    state.hasKids = e.target.checked;
  });
  document.getElementById('chk-pets').addEventListener('change', e => {
    state.hasPets = e.target.checked;
  });

  document.getElementById('input-rate').addEventListener('input', e => {
    const val = parseFloat(e.target.value);
    state.eurPerAud = (val > 0) ? val : null;
  });

  document.getElementById('btn-calculate').addEventListener('click', showResults);
  document.getElementById('btn-back').addEventListener('click', showInput);
  document.getElementById('btn-print').addEventListener('click', () => window.print());

  setDefaultHousingSub();
}

function setDefaultHousingSub() {
  state.housingSubRent = state.householdSize <= 2 ? '2bed' : '3bed';
}

function bindSegment(id, onChange) {
  const ctrl = document.getElementById(id);
  ctrl.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ctrl.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(btn.dataset.value);
    });
  });
}

function bindToggle(id, onChange) {
  const ctrl = document.getElementById(id);
  ctrl.querySelectorAll('.tog-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ctrl.querySelectorAll('.tog-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(btn.dataset.value);
    });
  });
}

// ── Screen switching ─────────────────────────────────────────
function showResults() {
  state.bgOverrides = {};
  document.getElementById('screen-input').classList.remove('active');
  document.getElementById('screen-results').classList.add('active');
  renderResults();
  window.scrollTo(0, 0);
}

function showInput() {
  document.getElementById('screen-results').classList.remove('active');
  document.getElementById('screen-input').classList.add('active');
  window.scrollTo(0, 0);
}

// ── Scaling ──────────────────────────────────────────────────
function scaleAud(cat) {
  const householdScaled = scaleValue(cat.perth_aud, cat, 'aud');
  if (cat.scaling === 'variable' && state.bgOverrides[cat.id] !== undefined) {
    const ratio = state.bgOverrides[cat.id] / cat.bg_eur;
    return householdScaled * ratio;
  }
  return householdScaled;
}

function scaleBgEur(cat) {
  if (state.bgOverrides[cat.id] !== undefined) {
    return state.bgOverrides[cat.id];
  }
  return scaleValue(cat.bg_eur, cat, 'eur');
}

function scaleValue(base, cat, currency) {
  const size  = Math.min(state.householdSize, 5);
  const pivot = CFG.meta.base_household_size;

  switch (cat.scaling) {
    case 'fixed':
      return base;
    case 'semi-fixed': {
      const extra = Math.max(0, size - pivot);
      const inc   = currency === 'aud'
        ? CFG.scaling.semi_fixed.increment_aud_per_person
        : CFG.scaling.semi_fixed.increment_eur_per_person;
      return base + extra * inc;
    }
    case 'variable':
      return base * (size / pivot);
    default:
      return base;
  }
}

// ── Active housing sub-choice ─────────────────────────────────
function activeHousingSub() {
  return state.housingType === 'renter' ? state.housingSubRent : state.housingSubOwner;
}

// ── Visible categories for current state ─────────────────────
function visibleCategories() {
  return CFG.categories.filter(cat => {
    if (cat.housing_type && cat.housing_type !== state.housingType) return false;
    if (cat.visa_type    && cat.visa_type    !== state.visaType)    return false;
    if (cat.is_pets && !state.hasPets) return false;
    return true;
  });
}

// ── Format helpers ────────────────────────────────────────────
function fmtAud(n) {
  return '$' + Math.round(n).toLocaleString('bg-BG').replace(/\s/g, ' ');
}

function fmtEur(n) {
  return '€' + Math.round(n).toLocaleString('bg-BG').replace(/\s/g, ' ');
}

function audToEur(aud) {
  return state.eurPerAud ? aud * state.eurPerAud : null;
}

// ── Results render ────────────────────────────────────────────
function renderResults() {
  const container = document.getElementById('results-main');
  container.innerHTML = '';

  container.appendChild(buildMeta());
  container.appendChild(buildBudgetTable());

  const totals = calcTotals();
  container.appendChild(buildFloorCallout(totals.perthAud));
  container.appendChild(buildSetupSection());
  container.appendChild(buildFooter());

  // Wire grocery select buttons
  container.querySelectorAll('.groc-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.groceryChoice = btn.dataset.grocery;
      renderResults();
    });
  });

  // Wire housing select buttons
  container.querySelectorAll('.housing-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.housingType === 'renter') {
        state.housingSubRent = btn.dataset.sub;
      } else {
        state.housingSubOwner = btn.dataset.sub;
      }
      renderResults();
    });
  });

  // Wire kindy bgType toggles
  container.querySelectorAll('.kindy-bg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      state.kindyChildren[idx].bgType = btn.dataset.bgtype;
      renderResults();
    });
  });

  // Wire kindy remove buttons
  container.querySelectorAll('.kindy-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      state.kindyChildren.splice(idx, 1);
      renderResults();
    });
  });

  // Wire kindy add button
  const addKindy = container.querySelector('#btn-add-kindy');
  if (addKindy) {
    addKindy.addEventListener('click', () => {
      state.kindyChildren.push({ bgType: 'municipal' });
      renderResults();
    });
  }

  // Wire school remove buttons
  container.querySelectorAll('.school-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      state.schoolChildren.splice(idx, 1);
      renderResults();
    });
  });

  // Wire school add button
  const addSchool = container.querySelector('#btn-add-school');
  if (addSchool) {
    addSchool.addEventListener('click', () => {
      state.schoolChildren.push({});
      renderResults();
    });
  }
}

// ── Meta bar ──────────────────────────────────────────────────
function buildMeta() {
  const sizeLabel = state.householdSize === 4 ? '4+' : state.householdSize;
  const visaLabel = state.visaType === 'pr' ? 'Постоянно пребиваване' : 'Виза 482';
  const hsLabel   = state.housingType === 'renter' ? 'Наемател' : 'Собственик';
  const rateLabel = state.eurPerAud
    ? `1 AUD = ${state.eurPerAud} EUR`
    : 'Само AUD';

  const div = el('div', 'results-meta');
  div.innerHTML = `
    <span class="meta-chip">👨‍👩‍👦 Домакинство: <strong>${sizeLabel} чов.</strong></span>
    <span class="meta-chip">🏠 <strong>${hsLabel}</strong></span>
    <span class="meta-chip">📄 <strong>${visaLabel}</strong></span>
    <span class="meta-chip">💱 <strong>${rateLabel}</strong></span>
  `;
  return div;
}

// ── Budget table ──────────────────────────────────────────────
function buildBudgetTable() {
  const hasEur = !!state.eurPerAud;
  const cols   = hasEur ? 4 : 3;

  const wrap  = el('div', 'budget-table-wrap');
  const table = el('table', 'budget-table');
  table.setAttribute('role', 'table');

  // thead
  const thead = el('thead');
  const hr    = el('tr');
  thCell(hr, 'Категория',      'left');
  thCell(hr, 'България (EUR)', 'right');
  thCell(hr, 'Пърт (AUD)',     'right');
  if (hasEur) thCell(hr, 'Пърт (EUR)', 'right');
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el('tbody');
  const cats  = visibleCategories();
  let totBg = 0, totAud = 0;

  // ── Housing sub-rows ──────────────────────────────────────
  const housingCats = cats.filter(c => c.housing_type);
  if (housingCats.length > 0) {
    const activeSub = activeHousingSub();
    const hsParentRow = el('tr', 'grocery-parent-row');
    const hsParentTd  = el('td', 'grocery-parent-cell');
    hsParentTd.setAttribute('colspan', String(cols));
    hsParentTd.textContent = state.housingType === 'renter' ? 'Жилище (наем)' : 'Жилище (ипотека)';
    hsParentRow.appendChild(hsParentTd);
    tbody.appendChild(hsParentRow);

    housingCats.forEach(cat => {
      const isActive = cat.housing_sub === activeSub;
      const bgEur    = scaleBgEur(cat);
      const pAud     = scaleAud(cat);
      const pEur     = audToEur(pAud);

      if (isActive) {
        totBg  += bgEur;
        totAud += pAud;
      }

      const tr = el('tr', isActive ? 'row-grocery-active' : 'row-grocery-alt');

      const catTd   = el('td');
      const subWrap = el('div', 'grocery-sub-wrap');
      const labelRow = el('div', 'grocery-sub-label');

      const nameSpan = el('span', 'grocery-sub-name');
      nameSpan.textContent = cat.label_bg;
      labelRow.appendChild(nameSpan);

      if (cat.label_perth) {
        const perthSpan = el('span', 'housing-perth-label');
        perthSpan.textContent = '→ ' + cat.label_perth;
        labelRow.appendChild(perthSpan);
      }

      if (!isActive) {
        const selBtn = el('button', 'groc-select-btn housing-select-btn');
        selBtn.dataset.sub = cat.housing_sub;
        selBtn.textContent = 'Избери';
        labelRow.appendChild(selBtn);
      }

      subWrap.appendChild(labelRow);

      const noteDiv = el('div', 'cat-note');
      noteDiv.textContent = (cat.note_bg || '') + (cat.note_perth ? ' · Пърт: ' + cat.note_perth : '');
      subWrap.appendChild(noteDiv);

      catTd.appendChild(subWrap);
      tr.appendChild(catTd);

      tdEditableBg(tr, cat.id, bgEur);
      tdVal(tr, fmtAud(pAud));
      if (hasEur) tdVal(tr, pEur ? fmtEur(pEur) : '—');
      tbody.appendChild(tr);
    });
  }

  // ── Non-housing, non-grocery, non-kids categories ─────────
  cats.forEach(cat => {
    if (cat.grocery || cat.housing_type || cat.is_pets) return;

    const bgEur = scaleBgEur(cat);
    const pAud  = scaleAud(cat);
    const pEur  = audToEur(pAud);

    totBg  += bgEur;
    totAud += pAud;

    const combinedNote = buildCombinedNote(cat);
    const tr = el('tr');
    tdCat(tr, cat.label_bg, combinedNote);
    tdEditableBg(tr, cat.id, bgEur);
    tdVal(tr, fmtAud(pAud));
    if (hasEur) tdVal(tr, pEur ? fmtEur(pEur) : '—');
    tbody.appendChild(tr);
  });

  // ── Grocery section ───────────────────────────────────────
  const groceries = cats.filter(c => c.grocery);
  if (groceries.length > 0) {
    const headerRow = el('tr', 'grocery-parent-row');
    const headerTd  = el('td', 'grocery-parent-cell');
    headerTd.setAttribute('colspan', String(cols));
    headerTd.textContent = 'Хранителни стоки';
    headerRow.appendChild(headerTd);
    tbody.appendChild(headerRow);

    groceries.forEach(cat => {
      const isActive = cat.grocery_option === state.groceryChoice;
      const bgEur    = scaleBgEur(cat);
      const pAud     = scaleAud(cat);
      const pEur     = audToEur(pAud);

      if (isActive) {
        totBg  += bgEur;
        totAud += pAud;
      }

      const tr = el('tr', isActive ? 'row-grocery-active' : 'row-grocery-alt');

      const catTd    = el('td');
      const subWrap  = el('div', 'grocery-sub-wrap');
      const labelRow = el('div', 'grocery-sub-label');

      const nameSpan = el('span', 'grocery-sub-name');
      nameSpan.textContent = cat.label_bg;
      labelRow.appendChild(nameSpan);

      if (!isActive) {
        const selectBtn = el('button', 'groc-select-btn');
        selectBtn.dataset.grocery = cat.grocery_option;
        selectBtn.textContent = 'Избери';
        labelRow.appendChild(selectBtn);
      }

      subWrap.appendChild(labelRow);
      const noteDiv = el('div', 'cat-note');
      noteDiv.textContent = buildCombinedNote(cat);
      subWrap.appendChild(noteDiv);
      catTd.appendChild(subWrap);
      tr.appendChild(catTd);

      tdEditableBg(tr, cat.id, bgEur);
      tdVal(tr, fmtAud(pAud));
      if (hasEur) tdVal(tr, pEur ? fmtEur(pEur) : '—');
      tbody.appendChild(tr);
    });
  }

  // ── Kids section ──────────────────────────────────────────
  if (state.hasKids && state.householdSize > 1) {
    const kc = CFG.kids_config;

    // Kids section header
    const kidsHeaderRow = el('tr', 'grocery-parent-row');
    const kidsHeaderTd  = el('td', 'grocery-parent-cell');
    kidsHeaderTd.setAttribute('colspan', String(cols));
    kidsHeaderTd.textContent = 'Деца';
    kidsHeaderRow.appendChild(kidsHeaderTd);
    tbody.appendChild(kidsHeaderRow);

    // ── Kindy sub-section ──────────────────────────────
    const kindySectionRow = el('tr', 'kids-subsection-header-row');
    const kindySectionTd  = el('td');
    kindySectionTd.setAttribute('colspan', String(cols));
    kindySectionTd.className = 'kids-subsection-header-td';

    const kindyHeaderDiv = el('div', 'kids-subsection-header');
    kindyHeaderDiv.textContent = 'Детска градина (0–5 г.)';
    const addKindyBtn = el('button', 'kids-add-btn');
    addKindyBtn.id = 'btn-add-kindy';
    addKindyBtn.textContent = '+ Добави дете';
    kindyHeaderDiv.appendChild(addKindyBtn);
    kindySectionTd.appendChild(kindyHeaderDiv);
    kindySectionRow.appendChild(kindySectionTd);
    tbody.appendChild(kindySectionRow);

    state.kindyChildren.forEach((child, idx) => {
      const isMunicipal = child.bgType === 'municipal';
      const bgEur = isMunicipal ? kc.kindy.bg_municipal_eur : kc.kindy.bg_private_eur;
      const pAud  = kc.kindy.perth_aud;
      const pEur  = audToEur(pAud);

      totBg  += bgEur;
      totAud += pAud;

      const tr = el('tr', 'row-grocery-active');

      // Category cell with BG toggle and remove button
      const catTd   = el('td');
      const subWrap = el('div', 'grocery-sub-wrap');

      const labelRow = el('div', 'grocery-sub-label');
      const nameSpan = el('span', 'grocery-sub-name');
      nameSpan.textContent = `Дете ${idx + 1}`;
      labelRow.appendChild(nameSpan);

      // BG toggle: Общинска / Частна
      const bgToggle = el('div', 'kids-bg-toggle');
      const munBtn = el('button', 'kids-bg-btn' + (isMunicipal ? ' active' : ''));
      munBtn.dataset.idx    = idx;
      munBtn.dataset.bgtype = 'municipal';
      munBtn.textContent = 'Общинска';
      const privBtn = el('button', 'kids-bg-btn' + (!isMunicipal ? ' active' : ''));
      privBtn.dataset.idx    = idx;
      privBtn.dataset.bgtype = 'private';
      privBtn.textContent = 'Частна';
      bgToggle.appendChild(munBtn);
      bgToggle.appendChild(privBtn);
      labelRow.appendChild(bgToggle);

      // Remove button
      const removeBtn = el('button', 'kids-remove-btn kindy-remove-btn');
      removeBtn.dataset.idx = idx;
      removeBtn.textContent = '×';
      removeBtn.title = 'Премахни';
      labelRow.appendChild(removeBtn);

      subWrap.appendChild(labelRow);

      // BG note
      const bgNoteDiv = el('div', 'cat-note');
      bgNoteDiv.textContent = isMunicipal ? kc.kindy.note_bg_municipal : kc.kindy.note_bg_private;
      subWrap.appendChild(bgNoteDiv);

      catTd.appendChild(subWrap);
      tr.appendChild(catTd);

      // BG EUR editable cell (manual key per child)
      const bgOverrideKey = 'kindy_' + idx;
      const bgVal = state.bgOverrides[bgOverrideKey] !== undefined
        ? state.bgOverrides[bgOverrideKey]
        : bgEur;
      const bgTd = el('td', 'td-bg-edit');
      const sym = document.createElement('span');
      sym.className = 'bg-eur-sym';
      sym.textContent = '€';
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'bg-edit-input';
      inp.value = Math.round(bgVal);
      inp.min = '0';
      inp.step = '1';
      inp.title = 'Редактирай разхода в България';
      inp.addEventListener('change', e => {
        const newVal = parseFloat(e.target.value);
        if (!isNaN(newVal) && newVal >= 0) {
          state.bgOverrides[bgOverrideKey] = newVal;
          renderResults();
        }
      });
      bgTd.appendChild(sym);
      bgTd.appendChild(inp);
      tr.appendChild(bgTd);

      // Perth AUD cell with CCS notice
      const audTd = el('td', 'kindy-perth-td');
      const audSpan = el('span');
      audSpan.textContent = fmtAud(pAud);
      audTd.appendChild(audSpan);

      const ccsBox = el('div', 'ccs-notice');
      ccsBox.innerHTML = `⚠️ Тази сума е ПРЕДИ държавната субсидия (CCS). Реалният разход за семейство с медианен доход (~$130 000/год.) е $600–$900/мес. след субсидия. Използвайте официалния калкулатор: <a href="https://www.servicesaustralia.gov.au/child-care-subsidy-calculator" target="_blank" rel="noopener noreferrer">servicesaustralia.gov.au/childcarecalculator</a>`;
      audTd.appendChild(ccsBox);

      // Perth note
      const perthNoteDiv = el('div', 'cat-note');
      perthNoteDiv.textContent = 'Пърт: ' + kc.kindy.note_perth;
      audTd.appendChild(perthNoteDiv);

      tr.appendChild(audTd);

      if (hasEur) tdVal(tr, pEur ? fmtEur(pEur) : '—');
      tbody.appendChild(tr);
    });

    // ── School sub-section ─────────────────────────────
    const schoolSectionRow = el('tr', 'kids-subsection-header-row');
    const schoolSectionTd  = el('td');
    schoolSectionTd.setAttribute('colspan', String(cols));
    schoolSectionTd.className = 'kids-subsection-header-td';

    const schoolHeaderDiv = el('div', 'kids-subsection-header');
    schoolHeaderDiv.textContent = 'Училищна възраст (6–17 г.)';
    const addSchoolBtn = el('button', 'kids-add-btn');
    addSchoolBtn.id = 'btn-add-school';
    addSchoolBtn.textContent = '+ Добави дете';
    schoolHeaderDiv.appendChild(addSchoolBtn);
    schoolSectionTd.appendChild(schoolHeaderDiv);
    schoolSectionRow.appendChild(schoolSectionTd);
    tbody.appendChild(schoolSectionRow);

    state.schoolChildren.forEach((child, idx) => {
      const isPr  = state.visaType === 'pr';
      const bgEur = kc.school.bg_eur;
      const pAud  = isPr ? kc.school.perth_aud_pr : kc.school.perth_aud_482;
      const pEur  = audToEur(pAud);

      totBg  += bgEur;
      totAud += pAud;

      const tr = el('tr', 'row-grocery-active');

      const catTd   = el('td');
      const subWrap = el('div', 'grocery-sub-wrap');
      const labelRow = el('div', 'grocery-sub-label');

      const nameSpan = el('span', 'grocery-sub-name');
      nameSpan.textContent = `Дете ${idx + 1}`;
      labelRow.appendChild(nameSpan);

      if (!isPr) {
        const visaTag = el('span', 'visa-tag');
        visaTag.textContent = '482';
        labelRow.appendChild(visaTag);
      }

      const removeBtn = el('button', 'kids-remove-btn school-remove-btn');
      removeBtn.dataset.idx = idx;
      removeBtn.textContent = '×';
      removeBtn.title = 'Премахни';
      labelRow.appendChild(removeBtn);

      subWrap.appendChild(labelRow);

      const noteDiv = el('div', 'cat-note');
      const bgNote    = kc.school.note_bg;
      const perthNote = isPr ? kc.school.note_perth_pr : kc.school.note_perth_482;
      noteDiv.textContent = bgNote + ' · Пърт: ' + perthNote;
      subWrap.appendChild(noteDiv);

      catTd.appendChild(subWrap);
      tr.appendChild(catTd);

      const bgOverrideKey = 'school_' + idx;
      const bgVal = state.bgOverrides[bgOverrideKey] !== undefined
        ? state.bgOverrides[bgOverrideKey]
        : bgEur;
      const bgTd = el('td', 'td-bg-edit');
      const sym2 = document.createElement('span');
      sym2.className = 'bg-eur-sym';
      sym2.textContent = '€';
      const inp2 = document.createElement('input');
      inp2.type = 'number';
      inp2.className = 'bg-edit-input';
      inp2.value = Math.round(bgVal);
      inp2.min = '0';
      inp2.step = '1';
      inp2.title = 'Редактирай разхода в България';
      inp2.addEventListener('change', e => {
        const newVal = parseFloat(e.target.value);
        if (!isNaN(newVal) && newVal >= 0) {
          state.bgOverrides[bgOverrideKey] = newVal;
          renderResults();
        }
      });
      bgTd.appendChild(sym2);
      bgTd.appendChild(inp2);
      tr.appendChild(bgTd);

      tdVal(tr, fmtAud(pAud));
      if (hasEur) tdVal(tr, pEur ? fmtEur(pEur) : '—');
      tbody.appendChild(tr);
    });
  }

  // ── Pets ──────────────────────────────────────────────────
  const petsCats = cats.filter(c => c.is_pets);
  petsCats.forEach(cat => {
    const bgEur = scaleBgEur(cat);
    const pAud  = scaleAud(cat);
    const pEur  = audToEur(pAud);

    totBg  += bgEur;
    totAud += pAud;

    const combinedNote = buildCombinedNote(cat);
    const tr = el('tr');
    tdCat(tr, cat.label_bg, combinedNote);
    tdEditableBg(tr, cat.id, bgEur);
    tdVal(tr, fmtAud(pAud));
    if (hasEur) tdVal(tr, pEur ? fmtEur(pEur) : '—');
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  // tfoot — totals
  const tfoot  = el('tfoot');
  const fr     = el('tr');
  const totEur = audToEur(totAud);

  const labelTd = el('td');
  const grocLabel = state.groceryChoice === 'aldi' ? 'Aldi' : 'Woolworths';
  labelTd.innerHTML = `
    <span class="total-label">Общо / месец</span>
    <span class="eur-sub">с ${grocLabel}</span>
  `;
  fr.appendChild(labelTd);

  const bgTotalTd = el('td', 'tfoot-val');
  bgTotalTd.id = 'bg-total-cell';
  bgTotalTd.textContent = fmtEur(totBg);
  fr.appendChild(bgTotalTd);

  tdVal(fr, fmtAud(totAud), 'tfoot-val');
  if (hasEur) {
    const eurTd = el('td');
    eurTd.textContent = totEur ? fmtEur(totEur) : '—';
    fr.appendChild(eurTd);
  }

  tfoot.appendChild(fr);
  table.appendChild(tfoot);
  wrap.appendChild(table);
  return wrap;
}

function buildCombinedNote(cat) {
  const parts = [];
  if (cat.note_bg)    parts.push(cat.note_bg);
  if (cat.note_perth) parts.push('Пърт: ' + cat.note_perth);
  return parts.join(' · ');
}

function calcTotals() {
  let bgEur = 0, perthAud = 0;
  const cats = visibleCategories();

  cats.forEach(cat => {
    if (cat.grocery && cat.grocery_option !== state.groceryChoice) return;
    if (cat.housing_type && cat.housing_sub !== activeHousingSub()) return;
    if (cat.is_pets) {
      bgEur    += scaleBgEur(cat);
      perthAud += scaleAud(cat);
      return;
    }
    bgEur    += scaleBgEur(cat);
    perthAud += scaleAud(cat);
  });

  if (state.hasKids && state.householdSize > 1) {
    const kc = CFG.kids_config;
    state.kindyChildren.forEach(child => {
      bgEur    += child.bgType === 'municipal' ? kc.kindy.bg_municipal_eur : kc.kindy.bg_private_eur;
      perthAud += kc.kindy.perth_aud;
    });
    state.schoolChildren.forEach(() => {
      bgEur    += kc.school.bg_eur;
      perthAud += state.visaType === 'pr' ? kc.school.perth_aud_pr : kc.school.perth_aud_482;
    });
  }

  return { bgEur, perthAud };
}

// ── Editable BG cell ──────────────────────────────────────────
function tdEditableBg(row, catId, value) {
  const td = el('td', 'td-bg-edit');
  const sym = document.createElement('span');
  sym.className = 'bg-eur-sym';
  sym.textContent = '€';
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'bg-edit-input';
  input.value = Math.round(value);
  input.min = '0';
  input.step = '1';
  input.title = 'Редактирай разхода в България';
  input.addEventListener('change', e => {
    const newVal = parseFloat(e.target.value);
    if (!isNaN(newVal) && newVal >= 0) {
      state.bgOverrides[catId] = newVal;
      renderResults();
    }
  });
  td.appendChild(sym);
  td.appendChild(input);
  row.appendChild(td);
}

// ── Floor callout ─────────────────────────────────────────────
function buildFloorCallout(perthAud) {
  const sizeKey = state.householdSize === 4 ? '4' : String(state.householdSize);
  const floor   = CFG.floor_costs[sizeKey]?.aud ?? 0;
  const div     = el('div', perthAud >= floor ? 'floor-callout ok' : 'floor-callout warn');

  const sizeLabel = state.householdSize === 4 ? '4+' : state.householdSize;

  if (perthAud >= floor) {
    div.innerHTML = `
      <strong>✓ Реалистичен бюджет — изчисленият разход надвишава препоръчителния минимум от ${fmtAud(floor)}/мес. за домакинство от ${sizeLabel} души в Пърт.</strong>
    `;
  } else {
    div.innerHTML = `
      <strong>⚠️ Изчисленият бюджет е под препоръчителния минимум от ${fmtAud(floor)}/мес. за домакинство от ${sizeLabel} души. Проверете дали сте включили всички разходи.</strong>
    `;
  }
  return div;
}

// ── Setup costs ───────────────────────────────────────────────
function buildSetupSection() {
  const hasEur    = !!state.eurPerAud;
  const section   = el('div', 'setup-section');
  const title     = el('p', 'section-title');
  title.textContent = 'Разходи за първата година';
  section.appendChild(title);

  const wrap  = el('div', 'setup-table-wrap');
  const table = el('table', 'setup-table');

  const thead = el('thead');
  const hr    = el('tr');
  thCell(hr, 'Разход', 'left');
  thCell(hr, 'AUD', 'right');
  if (hasEur) thCell(hr, 'EUR (прибл.)', 'right');
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody   = el('tbody');
  let totalAud  = 0;

  CFG.setup_costs.forEach(item => {
    if (!item.all_visa && item.visa_type && item.visa_type !== state.visaType) return;

    totalAud += item.aud;
    const pEur = audToEur(item.aud);

    const tr    = el('tr');
    const nameTd = el('td');
    const isVisaSpecific = !item.all_visa && item.visa_type;
    nameTd.innerHTML = `
      <div class="cat-label">
        ${item.label_bg}
        ${isVisaSpecific ? `<span class="visa-tag">482</span>` : ''}
      </div>
      ${item.note_bg ? `<div class="setup-note">${item.note_bg}</div>` : ''}
    `;
    tr.appendChild(nameTd);
    tdVal(tr, fmtAud(item.aud));
    if (hasEur) tdVal(tr, pEur ? `~${fmtEur(pEur)}` : '—');
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  const tfoot    = el('tfoot');
  const fr       = el('tr');
  const totalEur = audToEur(totalAud);

  const lbl = el('td');
  lbl.textContent = 'Общо (еднократно)';
  fr.appendChild(lbl);
  tdVal(fr, `~${fmtAud(totalAud)}`);
  if (hasEur) tdVal(fr, totalEur ? `~${fmtEur(totalEur)}` : '—');
  tfoot.appendChild(fr);
  table.appendChild(tfoot);

  wrap.appendChild(table);
  section.appendChild(wrap);
  return section;
}

// ── Calibration footer ────────────────────────────────────────
function buildFooter() {
  const div = el('div', 'calibration-footer');
  div.innerHTML = `
    <p class="calibration-date">
      ${CFG.meta.calibration_note} · Последна актуализация: ${CFG.meta.calibration_date}
    </p>
    <p>${CFG.meta.disclaimer}</p>
  `;
  return div;
}

// ── DOM helpers ───────────────────────────────────────────────
function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function thCell(row, text, align) {
  const th = el('th');
  th.textContent = text;
  th.style.textAlign = align;
  row.appendChild(th);
}

function tdCat(row, label, note) {
  const td = el('td');
  td.innerHTML = `<div class="cat-label">${label}</div>` +
    (note ? `<div class="cat-note">${note}</div>` : '');
  row.appendChild(td);
}

function tdVal(row, text, cls) {
  const td = el('td', cls || null);
  td.textContent = text;
  row.appendChild(td);
}
