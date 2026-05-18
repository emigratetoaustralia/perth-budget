'use strict';

// ── State ────────────────────────────────────────────────────
const state = {
  householdSize: 3,
  housingType:   'renter',
  visaType:      'pr',
  eurPerAud:     null,
  groceryChoice: 'aldi',
};

let CFG = null; // loaded from data.json

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
  bindSegment('ctrl-household', v => { state.householdSize = v === '4' ? 4 : parseInt(v); });
  bindToggle('ctrl-housing',    v => { state.housingType   = v; });
  bindToggle('ctrl-visa',       v => { state.visaType      = v; });

  document.getElementById('input-rate').addEventListener('input', e => {
    const val = parseFloat(e.target.value);
    state.eurPerAud = (val > 0) ? val : null;
  });

  document.getElementById('btn-calculate').addEventListener('click', showResults);
  document.getElementById('btn-back').addEventListener('click', showInput);
  document.getElementById('btn-print').addEventListener('click', () => window.print());
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
  return scaleValue(cat.perth_aud, cat, 'aud');
}

function scaleBgEur(cat) {
  return scaleValue(cat.bg_eur, cat, 'eur');
}

function scaleValue(base, cat, currency) {
  const size  = Math.min(state.householdSize, 5);
  const pivot = CFG.meta.base_household_size; // 3

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

// ── Visible categories for current state ─────────────────────
function visibleCategories() {
  return CFG.categories.filter(cat => {
    if (cat.housing_type && cat.housing_type !== state.housingType) return false;
    if (cat.visa_type    && cat.visa_type    !== state.visaType)    return false;
    return true;
  });
}

// ── Format helpers ────────────────────────────────────────────
function fmtAud(n) {
  return '$' + Math.round(n).toLocaleString('bg-BG').replace(/\s/g, ' ');
}

function fmtEur(n) {
  return '€' + Math.round(n).toLocaleString('bg-BG').replace(/\s/g, ' ');
}

function audToEur(aud) {
  return state.eurPerAud ? aud * state.eurPerAud : null;
}

// ── Results render ────────────────────────────────────────────
function renderResults() {
  const container = document.getElementById('results-main');
  container.innerHTML = '';

  container.appendChild(buildMeta());
  container.appendChild(buildGrocerySelector());
  container.appendChild(buildBudgetTable());

  const totals = calcTotals();
  container.appendChild(buildFloorCallout(totals.perthAud));
  container.appendChild(buildSetupSection());
  container.appendChild(buildFooter());

  // Wire grocery selector
  container.querySelectorAll('.groc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.groceryChoice = btn.dataset.grocery;
      renderResults(); // re-render
    });
  });
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

// ── Grocery selector ──────────────────────────────────────────
function buildGrocerySelector() {
  const wrap = el('div', 'grocery-selector no-print');
  const label = el('span', 'grocery-selector-label');
  label.textContent = 'Включи в сумата:';

  const btns = el('div', 'groc-btns');
  ['aldi', 'woolworths'].forEach(opt => {
    const b = el('button', 'groc-btn' + (state.groceryChoice === opt ? ' active' : ''));
    b.dataset.grocery = opt;
    b.textContent = opt === 'aldi' ? 'Aldi' : 'Woolworths';
    btns.appendChild(b);
  });

  wrap.appendChild(label);
  wrap.appendChild(btns);
  return wrap;
}

// ── Budget table ──────────────────────────────────────────────
function buildBudgetTable() {
  const hasEur = !!state.eurPerAud;
  const cols   = hasEur ? 4 : 3;

  const wrap = el('div', 'budget-table-wrap');
  const table = el('table', 'budget-table');
  table.setAttribute('role', 'table');

  // thead
  const thead = el('thead');
  const hr    = el('tr');
  thCell(hr, 'Категория',     'left');
  thCell(hr, 'България (EUR)', 'right');
  thCell(hr, 'Пърт (AUD)',     'right');
  if (hasEur) thCell(hr, 'Пърт (EUR)', 'right');
  thead.appendChild(hr);
  table.appendChild(thead);

  // tbody
  const tbody = el('tbody');
  const cats  = visibleCategories();
  let totBg  = 0, totAud = 0;

  cats.forEach(cat => {
    if (cat.grocery) return; // handled separately below

    const bgEur   = scaleBgEur(cat);
    const pAud    = scaleAud(cat);
    const pEur    = audToEur(pAud);

    totBg  += bgEur;
    totAud += pAud;

    const tr = el('tr');
    tdCat(tr, cat.label_bg, null);
    tdVal(tr, fmtEur(bgEur));
    tdVal(tr, fmtAud(pAud));
    if (hasEur) tdVal(tr, pEur ? fmtEur(pEur) : '—');
    tbody.appendChild(tr);
  });

  // Grocery rows
  const groceries = cats.filter(c => c.grocery);
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

    const labelSuffix = isActive
      ? ''
      : `<span class="alt-tag">алтернатива</span>`;

    const catTd = el('td');
    catTd.innerHTML = `
      <div class="cat-label">${cat.label_bg}${labelSuffix}</div>
      <div class="cat-note">${cat.brand_note_bg}</div>
    `;
    tr.appendChild(catTd);

    tdVal(tr, fmtEur(bgEur));
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

  tdVal(fr, fmtEur(totBg), 'tfoot-val');
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

function calcTotals() {
  let bgEur = 0, perthAud = 0;
  visibleCategories().forEach(cat => {
    if (cat.grocery && cat.grocery_option !== state.groceryChoice) return;
    bgEur    += scaleBgEur(cat);
    perthAud += scaleAud(cat);
  });
  return { bgEur, perthAud };
}

// ── Floor callout ─────────────────────────────────────────────
function buildFloorCallout(perthAud) {
  const sizeKey = state.householdSize === 4 ? '4' : String(state.householdSize);
  const floor   = CFG.floor_costs[sizeKey]?.aud ?? 0;
  const div     = el('div', perthAud >= floor ? 'floor-callout ok' : 'floor-callout warn');

  const sizeLabel = state.householdSize === 4 ? '4+' : state.householdSize;

  if (perthAud >= floor) {
    div.innerHTML = `
      <strong>✓ Над минималния праг за Пърт</strong>
      Изчисленият бюджет от ${fmtAud(perthAud)}/мес надвишава реалистичния минимум от
      ${fmtAud(floor)}/мес за домакинство от ${sizeLabel} души.
    `;
  } else {
    div.innerHTML = `
      <strong>⚠ Под минималния праг за Пърт</strong>
      Минималният реалистичен бюджет за домакинство от ${sizeLabel} души в Пърт е
      ${fmtAud(floor)}/мес. Разгледай категориите внимателно.
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
