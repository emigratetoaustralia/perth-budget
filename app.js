'use strict';

// ── State ────────────────────────────────────────────────────
const state = {
  householdSize:    3,
  housingType:      'renter',
  housingSubRent:   '3bed',   // '3bed' | '4bed' | 'unit' | 'townhouse'
  housingSubOwner:  'apt',    // 'apt'  | 'house'
  visaType:         'pr',
  eurPerAud:        null,
  groceryChoice:    'aldi',
  transportChoice:  '1car',   // '1car' | '2cars'
  hasKids:          true,
  hasPets:          true,
  kindyChildren:    [],       // [{bgType: 'municipal'|'private', ccsView: 'gross'|'net'}]
  schoolChildren:   [],       // [{}]  one entry per school-age child
  bgOverrides:      {},
  bgHousingType:    'own',    // 'own' | 'mortgage' | 'rent'
  bgHousingCost:    35,       // EUR/month — default for owner (IMP-012)
  activeResultsTab:  'predeparture', // 'predeparture' | 'arrival' | 'monthly'
  openAccordion:     null,       // id of currently open accordion section
  openInfoPanels:    {},         // {sectionId: bool}
  floorPopupOpen:    false,
  inputOpenSection:  1,          // which input accordion section is open (1-5)
  inputComplete:     { 1: false, 2: false, 3: false, 4: false, 5: false },
  // Savings module state
  savingsRentalWaived:     false,
  savingsCar:              true,
  savingsSkillsAssessment: null,   // user input AUD
  savingsFlights:          null,   // user input AUD
  savingsCarCost:          null,   // user input AUD
};

let CFG = null;

// ── Inline SVG icons (replace emoji chrome — modern, device-consistent) ──
const ICONS = {
  household: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  home:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  visa:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  rate:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  chevron:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
};

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
  renderInputScreen();

  // IMP-002: inject version from data.json into input header
  const versionSpan = document.getElementById('app-version');
  if (versionSpan && CFG.meta.version) {
    versionSpan.textContent = 'v' + CFG.meta.version;
  }

  document.getElementById('btn-back').addEventListener('click', showInput);
  document.getElementById('btn-print').addEventListener('click', () => window.print());
}

function setDefaultHousingSub() {
  state.housingSubRent  = state.householdSize <= 2 ? '3bed' : '4bed';
  state.housingSubOwner = state.housingSubOwner || 'apt';
}

// ── Input accordion (v0.6) ────────────────────────────────────
function renderInputScreen() {
  const main = document.getElementById('input-main');
  main.innerHTML = '';

  const acc = el('div', 'input-accordion');
  acc.appendChild(buildInputSection(1, 'Домакинство',         buildInputSection1));
  acc.appendChild(buildInputSection(2, 'Виза',                buildInputSection2));
  acc.appendChild(buildInputSection(3, 'Жилище в България',   buildInputSection3));
  acc.appendChild(buildInputSection(4, 'Жилище в Пърт',       buildInputSection4));
  acc.appendChild(buildInputSection(5, 'Валутен курс',        buildInputSection5));
  main.appendChild(acc);

  const calcBtn = el('button', 'btn-primary');
  calcBtn.id = 'btn-calculate';
  calcBtn.setAttribute('type', 'button');
  calcBtn.textContent = 'Изчисли бюджета →';
  calcBtn.disabled = !([1,2,3,4,5].every(n => state.inputComplete[n]));
  calcBtn.addEventListener('click', showResults);
  main.appendChild(calcBtn);

  // Scroll open section into view (after DOM settles)
  requestAnimationFrame(() => {
    const open = main.querySelector('.input-section.open');
    if (open) open.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function buildInputSection(n, label, bodyFn) {
  const isOpen     = state.inputOpenSection === n;
  const isComplete = state.inputComplete[n];

  const section = el('div', 'input-section' +
    (isOpen     ? ' open'     : '') +
    (isComplete ? ' complete' : ''));
  section.dataset.inputSection = n;

  // Header
  const header = el('button', 'input-section-header');
  header.setAttribute('type', 'button');

  const labelEl = el('span', 'input-section-label');
  labelEl.textContent = label;

  const summary = el('span', 'input-section-summary');
  summary.textContent = isComplete ? (state.inputComplete[n + '_summary'] || '') : '';

  const chevron = el('i', 'input-section-chevron');
  chevron.innerHTML = ICONS.chevron;

  header.appendChild(labelEl);
  header.appendChild(summary);
  header.appendChild(chevron);
  header.addEventListener('click', () => openInputSection(n));
  section.appendChild(header);

  // Body
  const body = el('div', 'input-section-body');

  // Info panel
  const infoText = CFG.input_info?.['s' + n];
  if (infoText) {
    const infoToggle = el('button', 'input-info-toggle');
    infoToggle.setAttribute('type', 'button');
    infoToggle.textContent = 'ⓘ Какво означава това?';

    const infoPanel = el('div', 'input-info-panel');
    infoPanel.textContent = infoText;

    infoToggle.addEventListener('click', () => {
      const open = infoPanel.classList.toggle('open');
      infoToggle.textContent = open ? 'ⓘ Скрий' : 'ⓘ Какво означава това?';
    });

    body.appendChild(infoToggle);
    body.appendChild(infoPanel);
  }

  bodyFn(body, n);
  section.appendChild(body);
  return section;
}

function openInputSection(n) {
  state.inputOpenSection = n;
  renderInputScreen();
}

function markSectionComplete(n, summaryText) {
  state.inputComplete[n] = true;
  state.inputComplete[n + '_summary'] = summaryText;
}

function checkInputComplete() {
  const allDone = [1,2,3,4,5].every(n => state.inputComplete[n]);
  const btn = document.getElementById('btn-calculate');
  if (btn) btn.disabled = !allDone;
}

function autoAdvance(n) {
  if (n < 5) {
    openInputSection(n + 1);
  } else {
    renderInputScreen();
  }
  checkInputComplete();
}

// ── Input section builders ────────────────────────────────────
function buildInputSection1(body) {
  // Household size
  const sizeLabel = el('span', 'field-label');
  sizeLabel.textContent = 'Брой хора в домакинството';
  body.appendChild(sizeLabel);

  const seg = el('div', 'segment-control');
  [1, 2, 3, 4].forEach(v => {
    const btn = el('button', 'seg-btn' + (state.householdSize === v ? ' active' : ''));
    btn.setAttribute('type', 'button');
    btn.textContent = v;
    btn.addEventListener('click', () => {
      state.householdSize = v;
      setDefaultHousingSub();
      renderInputScreen();  // re-render in place — do NOT auto-advance
    });
    seg.appendChild(btn);
  });
  body.appendChild(seg);

  // Kids counters
  const kidsLabel = el('span', 'field-label');
  kidsLabel.textContent = 'Деца';
  body.appendChild(kidsLabel);

  const counters = el('div', '');

  const kindy = buildCounterRow(
    'Малки деца', '0–4 г.',
    state.kindyChildren.length, 0, 6,
    delta => {
      if (delta > 0) {
        state.kindyChildren.push({ bgType: 'municipal', ccsView: state.visaType === '482' ? 'gross' : 'net' });
      } else if (delta < 0 && state.kindyChildren.length > 0) {
        state.kindyChildren.pop();
      }
      renderInputScreen();  // re-render in place — do NOT auto-advance
    }
  );
  counters.appendChild(kindy);

  const school = buildCounterRow(
    'Деца в училище', '5–18 г.',
    state.schoolChildren.length, 0, 6,
    delta => {
      if (delta > 0) {
        state.schoolChildren.push({});
      } else if (delta < 0 && state.schoolChildren.length > 0) {
        state.schoolChildren.pop();
      }
      renderInputScreen();  // re-render in place — do NOT auto-advance
    }
  );
  counters.appendChild(school);
  body.appendChild(counters);

  // Pets toggle
  const petsLabel = el('span', 'field-label');
  petsLabel.textContent = 'Домашни любимци';
  body.appendChild(petsLabel);

  const petsToggle = el('div', 'toggle-control');
  [['да', true], ['не', false]].forEach(([txt, val]) => {
    const isActive = state.hasPets === val;
    const btn = el('button', 'tog-btn' + (isActive ? ' active' : ''));
    btn.setAttribute('type', 'button');
    btn.textContent = txt;
    btn.addEventListener('click', () => {
      state.hasPets = val;
      renderInputScreen();  // re-render in place — do NOT auto-advance
    });
    petsToggle.appendChild(btn);
  });
  body.appendChild(petsToggle);

  // Explicit confirm button — only tap that advances to Section 2
  const confirmBtn = el('button', 'btn-confirm-input');
  confirmBtn.setAttribute('type', 'button');
  confirmBtn.textContent = 'Потвърди →';
  confirmBtn.style.marginTop = '16px';
  confirmBtn.style.width = '100%';
  confirmBtn.addEventListener('click', buildSummary1AndAdvance);
  body.appendChild(confirmBtn);
}

function buildSummary1AndAdvance() {
  const totalKids = state.kindyChildren.length + state.schoolChildren.length;
  const kidsPart  = totalKids > 0
    ? `· 🧒 ${totalKids} ${totalKids === 1 ? 'дете' : 'деца'}`
    : '· без деца';
  const petsPart  = state.hasPets ? '· 🐾 да' : '';
  const summary   = `👨‍👩‍👦 ${state.householdSize} ${kidsPart} ${petsPart}`.trim();
  markSectionComplete(1, summary);
  autoAdvance(1);
}

function buildCounterRow(label, ageRange, value, min, max, onChange) {
  const row = el('div', 'input-counter-row');

  const labelWrap = el('div', '');
  const labelEl   = el('div', 'input-counter-label');
  labelEl.textContent = label;
  const ageEl = el('div', 'input-counter-age');
  ageEl.textContent = ageRange;
  labelWrap.appendChild(labelEl);
  labelWrap.appendChild(ageEl);
  row.appendChild(labelWrap);

  const controls = el('div', 'input-counter-controls');

  const minusBtn = el('button', 'input-counter-btn');
  minusBtn.setAttribute('type', 'button');
  minusBtn.textContent = '−';
  if (value <= min) minusBtn.disabled = true;
  minusBtn.addEventListener('click', () => onChange(-1));

  const valueEl = el('span', 'input-counter-value');
  valueEl.textContent = value;

  const plusBtn = el('button', 'input-counter-btn');
  plusBtn.setAttribute('type', 'button');
  plusBtn.textContent = '+';
  if (value >= max) plusBtn.disabled = true;
  plusBtn.addEventListener('click', () => onChange(1));

  controls.appendChild(minusBtn);
  controls.appendChild(valueEl);
  controls.appendChild(plusBtn);
  row.appendChild(controls);
  return row;
}

function buildInputSection2(body) {
  const label = el('span', 'field-label');
  label.textContent = 'Вид виза';
  body.appendChild(label);

  const toggle = el('div', 'toggle-control');
  [['pr', 'PR (постоянно пребиваване)'], ['482', 'Виза 482 (работна)']].forEach(([val, txt]) => {
    const btn = el('button', 'tog-btn' + (state.visaType === val ? ' active' : ''));
    btn.setAttribute('type', 'button');
    btn.textContent = txt;
    btn.addEventListener('click', () => {
      state.visaType = val;
      state.kindyChildren.forEach(c => { c.ccsView = val === '482' ? 'gross' : 'net'; });
      markSectionComplete(2, val === 'pr' ? '📄 PR' : '📄 482');
      autoAdvance(2);
    });
    toggle.appendChild(btn);
  });
  body.appendChild(toggle);

  const hint = el('div', 'field-hint');
  hint.textContent = 'Влияе на здравни разходи и такси за образование.';
  body.appendChild(hint);
}

function buildInputSection3(body) {
  const bgHousingNotes = {
    own:      'Включва: данък сгради ~€10, такса смет ~€8, вход/поддръжка ~€17.',
    mortgage: 'Въведете месечната си ипотечна вноска в евро.',
    rent:     'Въведете месечния си наем в евро.'
  };

  const label = el('span', 'field-label');
  label.textContent = 'Жилищна ситуация в България';
  body.appendChild(label);

  const toggle = el('div', 'toggle-control');
  [['own', 'Собственик'], ['mortgage', 'Ипотека'], ['rent', 'Наемател']].forEach(([val, txt]) => {
    const btn = el('button', 'tog-btn' + (state.bgHousingType === val ? ' active' : ''));
    btn.setAttribute('type', 'button');
    btn.textContent = txt;
    btn.addEventListener('click', () => {
      state.bgHousingType = val;
      state.bgHousingCost = val === 'own' ? 35 : 0;
      renderInputScreen();
    });
    toggle.appendChild(btn);
  });
  body.appendChild(toggle);

  const hint = el('div', 'field-hint');
  hint.textContent = bgHousingNotes[state.bgHousingType];
  body.appendChild(hint);

  const numRow = el('div', 'input-num-row');
  const sym    = el('span', 'input-num-sym');
  sym.textContent = '€';

  const field = el('input', 'input-num-field');
  field.type      = 'number';
  field.min       = '0';
  field.step      = '1';
  field.inputMode = 'numeric';
  field.value     = state.bgHousingCost > 0
    ? state.bgHousingCost
    : (state.bgHousingType === 'own' ? 35 : '');
  field.placeholder = state.bgHousingType === 'own' ? '35' : '0';

  const confirmBtn = el('button', 'btn-confirm-input');
  confirmBtn.setAttribute('type', 'button');
  confirmBtn.textContent = 'Потвърди →';

  function confirmSection3() {
    const val = parseFloat(field.value);
    if (!isNaN(val) && val >= 0) {
      state.bgHousingCost = val;
      const typeLabel = { own: 'Собственик', mortgage: 'Ипотека', rent: 'Наемател' }[state.bgHousingType];
      markSectionComplete(3, `🏠 ${typeLabel} · €${Math.round(val)}/мес.`);
      autoAdvance(3);
    }
  }

  field.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.bgHousingCost = (!isNaN(v) && v >= 0) ? v : 0;
  });
  field.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmSection3(); }
  });
  confirmBtn.addEventListener('click', confirmSection3);

  numRow.appendChild(sym);
  numRow.appendChild(field);
  numRow.appendChild(confirmBtn);
  body.appendChild(numRow);
}

function buildInputSection4(body) {
  const label = el('span', 'field-label');
  label.textContent = 'Жилищна ситуация в Пърт';
  body.appendChild(label);

  const typeToggle = el('div', 'toggle-control');
  [['renter', 'Наемател'], ['owner', 'Ипотека / Собственик']].forEach(([val, txt]) => {
    const btn = el('button', 'tog-btn' + (state.housingType === val ? ' active' : ''));
    btn.setAttribute('type', 'button');
    btn.textContent = txt;
    btn.addEventListener('click', () => {
      state.housingType = val;
      setDefaultHousingSub();
      renderInputScreen();
    });
    typeToggle.appendChild(btn);
  });
  body.appendChild(typeToggle);

  // Sub-toggle — always visible; explicit tap required to advance
  const subLabel = el('span', 'field-label');

  if (state.housingType === 'renter') {
    subLabel.textContent = 'Размер на жилището';
    body.appendChild(subLabel);

    const subToggle = el('div', 'toggle-control');
    [['3bed', '3-спална'], ['4bed', '4-спална']].forEach(([val, txt]) => {
      const btn = el('button', 'tog-btn' + (state.housingSubRent === val ? ' active' : ''));
      btn.setAttribute('type', 'button');
      btn.textContent = txt;
      btn.addEventListener('click', () => {
        state.housingSubRent = val;
        markSectionComplete(4, `🏠 Наемател · ${txt}`);
        autoAdvance(4);
      });
      subToggle.appendChild(btn);
    });
    body.appendChild(subToggle);

  } else {
    subLabel.textContent = 'Вид имот';
    body.appendChild(subLabel);

    const subToggle = el('div', 'toggle-control');
    [['apt', 'Апартамент / Юнит'], ['house', 'Самостоятелна къща']].forEach(([val, txt]) => {
      const btn = el('button', 'tog-btn' + (state.housingSubOwner === val ? ' active' : ''));
      btn.setAttribute('type', 'button');
      btn.textContent = txt;
      btn.addEventListener('click', () => {
        state.housingSubOwner = val;
        const subText = val === 'apt' ? 'Апартамент' : 'Къща';
        markSectionComplete(4, `🏠 Ипотека · ${subText}`);
        autoAdvance(4);
      });
      subToggle.appendChild(btn);
    });
    body.appendChild(subToggle);
  }
}

function buildInputSection5(body) {
  // exchange_rate_anchor in data.json is AUD-per-EUR (1.65)
  // state.eurPerAud stores EUR-per-AUD (0.61) — the user-facing value
  const anchorEurPerAud = CFG.meta.exchange_rate_anchor
    ? parseFloat((1 / CFG.meta.exchange_rate_anchor).toFixed(4))
    : 0.61;
  if (state.eurPerAud === null) state.eurPerAud = anchorEurPerAud;

  const label = el('span', 'field-label');
  label.textContent = 'Валутен курс';
  body.appendChild(label);

  // Row 1: field only — "1 AUD = [field] EUR"
  const numRow = el('div', 'input-num-row');

  const sym1 = el('span', 'input-num-sym');
  sym1.textContent = '1 AUD =';

  const field = el('input', 'input-num-field');
  field.type      = 'number';
  field.min       = '0.01';
  field.step      = '0.01';
  field.inputMode = 'decimal';
  field.value     = state.eurPerAud ?? anchorEurPerAud;

  const sym2 = el('span', 'input-num-sym');
  sym2.textContent = 'EUR';

  numRow.appendChild(sym1);
  numRow.appendChild(field);
  numRow.appendChild(sym2);
  body.appendChild(numRow);

  // Row 2: confirm button on its own full-width line
  const confirmBtn = el('button', 'btn-confirm-input');
  confirmBtn.setAttribute('type', 'button');
  confirmBtn.textContent = 'Потвърди →';
  confirmBtn.style.marginTop = '10px';
  confirmBtn.style.width = '100%';

  function confirmSection5() {
    const val = parseFloat(field.value);
    if (!isNaN(val) && val > 0) {
      state.eurPerAud = val;
      markSectionComplete(5, `💱 ${val}`);
      autoAdvance(5);
    }
  }

  field.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.eurPerAud = (!isNaN(v) && v > 0) ? v : null;
  });
  field.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmSection5(); }
  });
  confirmBtn.addEventListener('click', confirmSection5);

  body.appendChild(confirmBtn);

  const hint = el('div', 'field-hint');
  hint.textContent = `Референтен курс: 1 AUD = ${anchorEurPerAud} EUR (средата на 2026 г.)`;
  body.appendChild(hint);
}

// ── Screen switching ─────────────────────────────────────────
function showResults() {
  state.bgOverrides     = {};
  state.openAccordion   = null;
  state.openInfoPanels  = {};
  state.floorPopupOpen  = false;
  document.getElementById('screen-input').classList.remove('active');
  document.getElementById('screen-results').classList.add('active');
  renderResults();
  window.scrollTo(0, 0);
}

function showInput() {
  document.getElementById('screen-results').classList.remove('active');
  document.getElementById('screen-input').classList.add('active');
  // Hide sticky bar on input screen
  const bar   = document.getElementById('sticky-total-bar');
  const popup = document.getElementById('sticky-floor-popup');
  if (bar)   bar.style.display   = 'none';
  if (popup) popup.style.display = 'none';
  renderInputScreen();
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
  const size  = state.householdSize;
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
    case 'household-tier': {
      if (currency === 'aud') {
        if (size <= 1) return cat.perth_aud_1 ?? base;
        if (size === 2) return cat.perth_aud_2 ?? base;
        return cat.perth_aud_3plus ?? base;
      }
      return base;
    }
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
    // IMP-011: ownership costs row only visible for owner/mortgage housing
    if (cat.flag === 'ownership' && state.housingType === 'renter') return false;
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
  container.appendChild(buildSavingsGrandBanner());
  container.appendChild(buildResultsTabBar());

  // Pre-departure panel
  const predeparturePanel = el('div', 'results-tab-panel' + (state.activeResultsTab === 'predeparture' ? ' active' : ''));
  predeparturePanel.id = 'panel-predeparture';
  predeparturePanel.appendChild(buildPrintHeading('Преди заминаване'));
  predeparturePanel.appendChild(buildPreDepartureSection());
  container.appendChild(predeparturePanel);

  // Arrival panel
  const arrivalPanel = el('div', 'results-tab-panel' + (state.activeResultsTab === 'arrival' ? ' active' : ''));
  arrivalPanel.id = 'panel-arrival';
  arrivalPanel.appendChild(buildPrintHeading('При пристигане'));
  arrivalPanel.appendChild(buildArrivalSection());
  container.appendChild(arrivalPanel);

  // Monthly panel
  const monthlyPanel = el('div', 'results-tab-panel' + (state.activeResultsTab === 'monthly' ? ' active' : ''));
  monthlyPanel.id = 'panel-monthly';
  monthlyPanel.appendChild(buildPrintHeading('Месечни разходи'));
  const lifestyleNote = el('p', 'monthly-lifestyle-note');
  lifestyleNote.textContent = 'Това е прогноза при пренесен български стандарт на живот върху цените в Пърт. Повечето нови емигранти започват доста по-ниско и увеличават разходите си с времето, когато доходите им се стабилизират.';
  monthlyPanel.appendChild(lifestyleNote);
  monthlyPanel.appendChild(buildAccordionList());
  container.appendChild(monthlyPanel);

  // Footer visible below all tabs
  container.appendChild(buildFooter());

  // Sticky total bar (monthly tab only)
  buildStickyTotal(container);

  wireAccordionEvents(container);
  wireInfoPanelEvents(container);
  wireKidsEvents(container);
  wireSubToggleEvents(container);
  wireTabEvents(container);
  wireStickyFloorEvent(container);
  wireBgEditEvents(container);
  wireSavingsEvents(container);
  updateStickyVisibility();
}

// ── Meta bar (compressed) ─────────────────────────────────────
function buildMeta() {
  const sizeLabel = state.householdSize;
  const visaLabel = state.visaType === 'pr' ? 'PR' : '482';
  const hsLabel   = state.housingType === 'renter' ? 'Наем' : 'Ипотека';
  const rateLabel = state.eurPerAud ? `${state.eurPerAud}` : '—';

  const div = el('div', 'results-meta no-print');
  div.title = 'Промени настройките';
  div.innerHTML = `
    <span class="meta-item"><i class="meta-icon">${ICONS.household}</i> ${sizeLabel}</span>
    <span class="meta-sep">·</span>
    <span class="meta-item"><i class="meta-icon">${ICONS.home}</i> ${hsLabel}</span>
    <span class="meta-sep">·</span>
    <span class="meta-item"><i class="meta-icon">${ICONS.visa}</i> ${visaLabel}</span>
    <span class="meta-sep">·</span>
    <span class="meta-item"><i class="meta-icon">${ICONS.rate}</i> ${rateLabel}</span>
  `;
  div.addEventListener('click', showInput);
  return div;
}

// ── Results tab bar — 3 tabs + sliding indicator ─────────────
function buildResultsTabBar() {
  const tabs = [
    ['predeparture', 'Преди заминаване'],
    ['arrival',      'При пристигане'],
    ['monthly',      'Месечни разходи']
  ];
  const idx = Math.max(0, tabs.findIndex(t => t[0] === state.activeResultsTab));

  const bar = el('div', 'results-tab-bar no-print');
  bar.innerHTML =
    tabs.map(([k, label]) =>
      `<button class="results-tab-btn${state.activeResultsTab === k ? ' active' : ''}" data-tab="${k}">${label}</button>`
    ).join('') +
    `<span class="results-tab-indicator" style="width:${(100 / tabs.length).toFixed(4)}%;transform:translateX(${idx * 100}%)"></span>`;
  return bar;
}

// ── Accordion list ────────────────────────────────────────────
function buildAccordionList() {
  const cats = visibleCategories();
  const wrapper = el('div', 'accordion');

  // Housing
  const housingCats = cats.filter(c => c.housing_type);
  if (housingCats.length > 0) {
    wrapper.appendChild(buildHousingSection(housingCats));
  }

  // Standard rows (non-housing, non-grocery, non-pets, non-transport)
  cats.forEach(cat => {
    if (cat.grocery || cat.housing_type || cat.is_pets || cat.transport) return;
    wrapper.appendChild(buildStandardSection(cat));
  });

  // Transport
  const transportCats = cats.filter(c => c.transport);
  if (transportCats.length > 0) {
    wrapper.appendChild(buildTransportSection(transportCats));
  }

  // Groceries
  const groceries = cats.filter(c => c.grocery);
  if (groceries.length > 0) {
    wrapper.appendChild(buildGrocerySection(groceries));
  }

  // Kids
  if (state.hasKids && state.householdSize > 1) {
    wrapper.appendChild(buildKidsSection());
  }

  // Pets
  const petsCats = cats.filter(c => c.is_pets);
  if (petsCats.length > 0) {
    wrapper.appendChild(buildStandardSection(petsCats[0]));
  }

  return wrapper;
}

// ── Accordion item builder ────────────────────────────────────
function buildAccordionItem(id, label, summaryBg, summaryPerth, bodyFn) {
  const isOpen = state.openAccordion === id;
  const item = el('div', 'accordion-item' + (isOpen ? ' open' : ''));
  item.dataset.accId = id;

  const header = el('button', 'accordion-header');
  header.setAttribute('type', 'button');
  header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

  const labelEl = el('span', 'accordion-label');
  labelEl.textContent = label;

  const summary = el('span', 'accordion-summary');
  summary.innerHTML = `
    <span class="acc-num acc-num-bg"><small class="acc-num-flag">🇧🇬</small>${summaryBg}</span>
    <span class="acc-num acc-num-perth"><small class="acc-num-flag">🇦🇺</small>${summaryPerth}</span>
  `;

  const chevron = el('i', 'accordion-chevron');
  chevron.innerHTML = ICONS.chevron;

  header.appendChild(labelEl);
  header.appendChild(summary);
  header.appendChild(chevron);
  item.appendChild(header);

  const body = el('div', 'accordion-body');
  bodyFn(body);
  item.appendChild(body);

  return item;
}

// ── Standard single-category section ─────────────────────────
function buildStandardSection(cat) {
  const bgEur = cat.bg_eur !== null ? scaleBgEur(cat) : null;
  const pAud  = scaleAud(cat);

  return buildAccordionItem(
    cat.id,
    cat.label_bg,
    bgEur !== null ? fmtEur(bgEur) : '—',
    fmtAud(pAud),
    body => {
      if (bgEur !== null) {
        body.appendChild(buildNumBlock(cat.id, bgEur, pAud, cat));
      } else {
        body.appendChild(buildNumBlockPerthOnly(pAud));
      }
      if (cat.note_bg || cat.note_perth) {
        body.appendChild(buildInfoToggle(cat.id));
        body.appendChild(buildInfoPanel(cat.id, cat.note_bg, cat.note_perth));
      }
    }
  );
}

// ── Housing section ───────────────────────────────────────────
function buildHousingSection(housingCats) {
  const activeSub = activeHousingSub();
  const activeCat = housingCats.find(c => c.housing_sub === activeSub) || housingCats[0];
  const bgEur     = activeCat.bg_eur !== null ? scaleBgEur(activeCat) : null;
  const pAud      = scaleAud(activeCat);
  const label     = state.housingType === 'renter' ? 'Жилище (наем)' : 'Жилище (ипотека)';

  return buildAccordionItem(
    'housing',
    label,
    state.bgHousingCost > 0 ? fmtEur(state.bgHousingCost) : '—',
    fmtAud(pAud),
    body => {
      // Sub-toggle
      const toggle = el('div', 'acc-sub-toggle housing-sub-toggle');
      housingCats.forEach(cat => {
        const btn = el('button', 'acc-sub-btn' + (cat.housing_sub === activeSub ? ' active' : ''));
        btn.dataset.subType = 'housing';
        btn.dataset.sub     = cat.housing_sub;
        btn.setAttribute('type', 'button');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = cat.label_bg;
        btn.appendChild(nameSpan);

        if (cat.label_perth) {
          const hint = el('span', 'acc-perth-hint');
          hint.textContent = '→ ' + cat.label_perth;
          btn.appendChild(hint);
        }
        toggle.appendChild(btn);
      });
      body.appendChild(toggle);

      // Number block — Perth-only since BG housing moved to input screen
      body.appendChild(buildNumBlockPerthOnly(pAud));

      if (activeCat.note_perth) {
        body.appendChild(buildInfoToggle('housing'));
        body.appendChild(buildInfoPanel('housing', null, activeCat.note_perth));
      }
    }
  );
}

// ── Grocery section ───────────────────────────────────────────
function buildGrocerySection(groceries) {
  const activeCat = groceries.find(c => c.grocery_option === state.groceryChoice) || groceries[0];
  const bgEur     = scaleBgEur(activeCat);
  const pAud      = scaleAud(activeCat);

  return buildAccordionItem(
    'groceries',
    'Хранителни стоки',
    fmtEur(bgEur),
    fmtAud(pAud),
    body => {
      const toggle = el('div', 'acc-sub-toggle');
      groceries.forEach(cat => {
        const btn = el('button', 'acc-sub-btn' + (cat.grocery_option === state.groceryChoice ? ' active' : ''));
        btn.dataset.subType = 'grocery';
        btn.dataset.grocery = cat.grocery_option;
        btn.setAttribute('type', 'button');
        btn.textContent = cat.label_bg;
        toggle.appendChild(btn);
      });
      body.appendChild(toggle);

      body.appendChild(buildNumBlock('groceries', bgEur, pAud, activeCat));

      if (activeCat.note_bg || activeCat.note_perth) {
        body.appendChild(buildInfoToggle('groceries'));
        body.appendChild(buildInfoPanel('groceries', activeCat.note_bg, activeCat.note_perth));
      }
    }
  );
}

// ── Transport section ────────────────────────────────────────
function buildTransportSection(transportCats) {
  const activeCat = transportCats.find(c => c.transport_option === state.transportChoice) || transportCats[0];
  const bgEur     = scaleBgEur(activeCat);
  const pAud      = scaleAud(activeCat);

  return buildAccordionItem(
    'transport',
    'Транспорт',
    fmtEur(bgEur),
    fmtAud(pAud),
    body => {
      const toggle = el('div', 'acc-sub-toggle');
      transportCats.forEach(cat => {
        const btn = el('button', 'acc-sub-btn' + (cat.transport_option === state.transportChoice ? ' active' : ''));
        btn.dataset.subType = 'transport';
        btn.dataset.transport = cat.transport_option;
        btn.setAttribute('type', 'button');
        btn.textContent = cat.label_bg;
        toggle.appendChild(btn);
      });
      body.appendChild(toggle);

      body.appendChild(buildNumBlock('transport', bgEur, pAud, activeCat));

      if (activeCat.note_bg || activeCat.note_perth) {
        body.appendChild(buildInfoToggle('transport'));
        body.appendChild(buildInfoPanel('transport', activeCat.note_bg, activeCat.note_perth));
      }
    }
  );
}

// ── Kids section ──────────────────────────────────────────────
function buildKidsSection() {
  const kc = CFG.kids_config;
  const totals = calcKidsTotals();
  const summaryBg    = totals.bgEur > 0    ? fmtEur(totals.bgEur)    : '—';
  const summaryPerth = totals.perthAud > 0 ? fmtAud(totals.perthAud) : '—';

  return buildAccordionItem(
    'kids',
    'Деца',
    summaryBg,
    summaryPerth,
    body => {
      if (state.kindyChildren.length === 0 && state.schoolChildren.length === 0) {
        const hint = el('p', 'kids-hint-text');
        hint.textContent = 'Добави деца вътре';
        body.appendChild(hint);
      }

      // ── Kindy sub-section ──────────────────────────────
      const kindyTitle = el('div', 'kids-subsection-title');
      kindyTitle.innerHTML = 'Детска градина (0–5 г.)';
      const addKindyBtn = el('button', 'kids-add-btn');
      addKindyBtn.id = 'btn-add-kindy';
      addKindyBtn.setAttribute('type', 'button');
      addKindyBtn.textContent = '+ Добави дете';
      kindyTitle.appendChild(addKindyBtn);
      body.appendChild(kindyTitle);

      state.kindyChildren.forEach((child, idx) => {
        const isMunicipal = child.bgType === 'municipal';
        const is482 = state.visaType === '482';
        // Default ccsView on first render: gross for 482, net for PR
        if (!child.ccsView) child.ccsView = is482 ? 'gross' : 'net';
        // 482 always sees gross regardless of stored state
        const effectiveCcsView = is482 ? 'gross' : child.ccsView;

        const bgEur = state.bgOverrides['kindy_' + idx] !== undefined
          ? state.bgOverrides['kindy_' + idx]
          : (isMunicipal ? kc.kindy.bg_municipal_eur : kc.kindy.bg_private_eur);
        const pAud  = effectiveCcsView === 'net' ? kc.kindy.perth_aud_net_pr_median : kc.kindy.perth_aud;
        const pEur  = audToEur(pAud);

        const block = el('div', 'kids-child-block');

        const hdr = el('div', 'kids-child-header');
        const nameEl = el('span', 'kids-child-name');
        nameEl.textContent = `Дете ${idx + 1}`;

        const bgToggle = el('div', 'kids-bg-toggle');
        const munBtn = el('button', 'kids-bg-btn' + (isMunicipal ? ' active' : ''));
        munBtn.dataset.idx    = idx;
        munBtn.dataset.bgtype = 'municipal';
        munBtn.setAttribute('type', 'button');
        munBtn.textContent = 'Общинска';
        const privBtn = el('button', 'kids-bg-btn' + (!isMunicipal ? ' active' : ''));
        privBtn.dataset.idx    = idx;
        privBtn.dataset.bgtype = 'private';
        privBtn.setAttribute('type', 'button');
        privBtn.textContent = 'Частна';
        bgToggle.appendChild(munBtn);
        bgToggle.appendChild(privBtn);

        const removeBtn = el('button', 'kids-remove-btn kindy-remove-btn');
        removeBtn.dataset.idx = idx;
        removeBtn.setAttribute('type', 'button');
        removeBtn.textContent = '×';
        removeBtn.title = 'Премахни';

        hdr.appendChild(nameEl);
        hdr.appendChild(bgToggle);
        hdr.appendChild(removeBtn);
        block.appendChild(hdr);

        // CCS gross/net toggle (hidden for 482)
        if (!is482) {
          const ccsToggle = el('div', 'acc-sub-toggle ccs-toggle');
          const grossBtn = el('button', 'acc-sub-btn kindy-ccs-btn' + (effectiveCcsView === 'gross' ? ' active' : ''));
          grossBtn.dataset.idx = idx;
          grossBtn.dataset.ccsview = 'gross';
          grossBtn.setAttribute('type', 'button');
          grossBtn.textContent = 'Бруто (преди CCS)';
          const netBtn = el('button', 'acc-sub-btn kindy-ccs-btn' + (effectiveCcsView === 'net' ? ' active' : ''));
          netBtn.dataset.idx = idx;
          netBtn.dataset.ccsview = 'net';
          netBtn.setAttribute('type', 'button');
          netBtn.textContent = 'Нето (след субсидия)';
          ccsToggle.appendChild(grossBtn);
          ccsToggle.appendChild(netBtn);
          block.appendChild(ccsToggle);
        }

        // Number block
        block.appendChild(buildNumBlockKindy(idx, bgEur, pAud, pEur));

        // CCS notice
        const ccsBox = el('div', 'ccs-notice');
        if (is482) {
          ccsBox.innerHTML = `⚠️ ${kc.kindy.note_perth_482_no_ccs}`;
        } else if (effectiveCcsView === 'gross') {
          ccsBox.innerHTML = `⚠️ Тази сума е ПРЕДИ държавната субсидия (CCS). Реалният разход за семейство с медианен доход (~$130 000/год.) е ${kc.kindy.perth_aud_net_pr_range}/мес. след субсидия. Използвайте официалния калкулатор: <a href="${kc.kindy.ccs_calculator_url}" target="_blank" rel="noopener noreferrer">startingblocks.gov.au</a>`;
        } else {
          ccsBox.innerHTML = `💡 ${kc.kindy.note_perth_net} Брутна цена преди субсидия: ${fmtAud(kc.kindy.perth_aud)}/мес. Калкулатор: <a href="${kc.kindy.ccs_calculator_url}" target="_blank" rel="noopener noreferrer">startingblocks.gov.au</a>`;
        }
        block.appendChild(ccsBox);

        // Info panel for kindy
        const kindyInfoId = 'kindy_info_' + idx;
        block.appendChild(buildInfoToggle(kindyInfoId));
        block.appendChild(buildInfoPanel(kindyInfoId,
          isMunicipal ? kc.kindy.note_bg_municipal : kc.kindy.note_bg_private,
          kc.kindy.note_perth));

        body.appendChild(block);
      });

      // ── School sub-section ─────────────────────────────
      const schoolTitle = el('div', 'kids-subsection-title');
      schoolTitle.innerHTML = 'Училищна възраст (6–17 г.)';
      const addSchoolBtn = el('button', 'kids-add-btn');
      addSchoolBtn.id = 'btn-add-school';
      addSchoolBtn.setAttribute('type', 'button');
      addSchoolBtn.textContent = '+ Добави дете';
      schoolTitle.appendChild(addSchoolBtn);
      body.appendChild(schoolTitle);

      state.schoolChildren.forEach((child, idx) => {
        const isPr  = state.visaType === 'pr';
        const bgEur = state.bgOverrides['school_' + idx] !== undefined
          ? state.bgOverrides['school_' + idx]
          : kc.school.bg_eur;
        // BUG-001 FIX: 482 tuition is per family. First child: $430. Subsequent children: PR rate only ($80).
        const pAud  = isPr
          ? kc.school.perth_aud_pr
          : (idx === 0 ? kc.school.perth_aud_482 : kc.school.perth_aud_pr);
        const pEur  = audToEur(pAud);

        const block = el('div', 'kids-child-block');

        const hdr = el('div', 'kids-child-header');
        const nameEl = el('span', 'kids-child-name');
        nameEl.textContent = `Дете ${idx + 1}`;
        if (!isPr) {
          const visaTag = el('span', 'visa-tag');
          visaTag.textContent = idx === 0 ? '482' : '482 – само допълнителни такси';
          nameEl.appendChild(visaTag);
        }

        const removeBtn = el('button', 'kids-remove-btn school-remove-btn');
        removeBtn.dataset.idx = idx;
        removeBtn.setAttribute('type', 'button');
        removeBtn.textContent = '×';
        removeBtn.title = 'Премахни';

        hdr.appendChild(nameEl);
        hdr.appendChild(removeBtn);
        block.appendChild(hdr);

        block.appendChild(buildNumBlockSchool(idx, bgEur, pAud, pEur));

        // Info panel for school child
        const schoolInfoId = 'school_info_' + idx;
        block.appendChild(buildInfoToggle(schoolInfoId));
        block.appendChild(buildInfoPanel(schoolInfoId,
          kc.school.note_bg,
          isPr ? kc.school.note_perth_pr : (idx === 0 ? kc.school.note_perth_482 : kc.school.note_perth_pr)));

        body.appendChild(block);
      });
    }
  );
}

// ── Number block builder ──────────────────────────────────────
function buildNumBlock(catId, bgEur, pAud, cat) {
  const pEur = audToEur(pAud);
  const row  = el('div', 'num-block-row');

  // BG block (editable)
  const bgBlock = el('div', 'num-block editable-bg');
  const bgLabel = el('div', 'num-block-label');
  bgLabel.textContent = 'България';
  const bgWrap = el('div', 'bg-num-edit-wrap');
  const bgSym = el('span', 'bg-eur-sym-large');
  bgSym.textContent = '€';
  const bgInput = document.createElement('input');
  bgInput.type = 'number';
  bgInput.className = 'bg-edit-input-large';
  bgInput.value = Math.round(bgEur);
  bgInput.min = '0';
  bgInput.step = '1';
  bgInput.dataset.catId = catId;
  bgWrap.appendChild(bgSym);
  bgWrap.appendChild(bgInput);
  const editHint = el('div', 'edit-hint');
  editHint.textContent = '✏️ Промени своята стойност';
  bgBlock.appendChild(bgLabel);
  bgBlock.appendChild(bgWrap);
  bgBlock.appendChild(editHint);
  row.appendChild(bgBlock);

  // Perth block
  const perthBlock = el('div', 'num-block');
  const perthLabel = el('div', 'num-block-label');
  perthLabel.textContent = 'Пърт';
  const perthVal = el('div', 'num-block-value perth-val');
  perthVal.textContent = fmtAud(pAud);
  perthBlock.appendChild(perthLabel);
  perthBlock.appendChild(perthVal);
  if (pEur) {
    const eurSub = el('div', 'num-block-eur');
    eurSub.textContent = '≈ ' + fmtEur(pEur);
    perthBlock.appendChild(eurSub);
  }
  row.appendChild(perthBlock);

  return row;
}

// ── Perth-only number block (no BG column) ────────────────────
function buildNumBlockPerthOnly(pAud) {
  const pEur = audToEur(pAud);
  const row  = el('div', 'num-block-row num-block-row-perth-only');

  const perthBlock = el('div', 'num-block');
  const perthLabel = el('div', 'num-block-label');
  perthLabel.textContent = 'Пърт';
  const perthVal = el('div', 'num-block-value perth-val');
  perthVal.textContent = fmtAud(pAud);
  perthBlock.appendChild(perthLabel);
  perthBlock.appendChild(perthVal);
  if (pEur) {
    const eurSub = el('div', 'num-block-eur');
    eurSub.textContent = '≈ ' + fmtEur(pEur);
    perthBlock.appendChild(eurSub);
  }
  row.appendChild(perthBlock);

  return row;
}

function buildNumBlockKindy(idx, bgEur, pAud, pEur) {
  const row = el('div', 'num-block-row');

  const bgBlock = el('div', 'num-block editable-bg');
  const bgLabel = el('div', 'num-block-label');
  bgLabel.textContent = 'България';
  const bgWrap = el('div', 'bg-num-edit-wrap');
  const bgSym = el('span', 'bg-eur-sym-large');
  bgSym.textContent = '€';
  const bgInput = document.createElement('input');
  bgInput.type = 'number';
  bgInput.className = 'bg-edit-input-large';
  bgInput.value = Math.round(bgEur);
  bgInput.min = '0';
  bgInput.step = '1';
  bgInput.dataset.catId = 'kindy_' + idx;
  bgWrap.appendChild(bgSym);
  bgWrap.appendChild(bgInput);
  const editHint = el('div', 'edit-hint');
  editHint.textContent = '✏️ Промени своята стойност';
  bgBlock.appendChild(bgLabel);
  bgBlock.appendChild(bgWrap);
  bgBlock.appendChild(editHint);
  row.appendChild(bgBlock);

  const perthBlock = el('div', 'num-block');
  const perthLabel = el('div', 'num-block-label');
  perthLabel.textContent = 'Пърт (бруто)';
  const perthVal = el('div', 'num-block-value perth-val');
  perthVal.textContent = fmtAud(pAud);
  perthBlock.appendChild(perthLabel);
  perthBlock.appendChild(perthVal);
  if (pEur) {
    const eurSub = el('div', 'num-block-eur');
    eurSub.textContent = '≈ ' + fmtEur(pEur);
    perthBlock.appendChild(eurSub);
  }
  row.appendChild(perthBlock);

  return row;
}

function buildNumBlockSchool(idx, bgEur, pAud, pEur) {
  const row = el('div', 'num-block-row');

  const bgBlock = el('div', 'num-block editable-bg');
  const bgLabel = el('div', 'num-block-label');
  bgLabel.textContent = 'България';
  const bgWrap = el('div', 'bg-num-edit-wrap');
  const bgSym = el('span', 'bg-eur-sym-large');
  bgSym.textContent = '€';
  const bgInput = document.createElement('input');
  bgInput.type = 'number';
  bgInput.className = 'bg-edit-input-large';
  bgInput.value = Math.round(bgEur);
  bgInput.min = '0';
  bgInput.step = '1';
  bgInput.dataset.catId = 'school_' + idx;
  bgWrap.appendChild(bgSym);
  bgWrap.appendChild(bgInput);
  const editHint = el('div', 'edit-hint');
  editHint.textContent = '✏️ Промени своята стойност';
  bgBlock.appendChild(bgLabel);
  bgBlock.appendChild(bgWrap);
  bgBlock.appendChild(editHint);
  row.appendChild(bgBlock);

  const perthBlock = el('div', 'num-block');
  const perthLabel = el('div', 'num-block-label');
  perthLabel.textContent = 'Пърт';
  const perthVal = el('div', 'num-block-value perth-val');
  perthVal.textContent = fmtAud(pAud);
  perthBlock.appendChild(perthLabel);
  perthBlock.appendChild(perthVal);
  if (pEur) {
    const eurSub = el('div', 'num-block-eur');
    eurSub.textContent = '≈ ' + fmtEur(pEur);
    perthBlock.appendChild(eurSub);
  }
  row.appendChild(perthBlock);

  return row;
}

// ── Info toggle button + panel ────────────────────────────────
function buildInfoToggle(id) {
  const btn = el('button', 'info-toggle-btn' + (state.openInfoPanels[id] ? ' open' : ''));
  btn.setAttribute('type', 'button');
  btn.dataset.infoId = id;
  btn.innerHTML = state.openInfoPanels[id] ? 'ⓘ Скрий информацията' : 'ⓘ Повече информация';
  return btn;
}

function buildInfoPanel(id, noteBg, notePerth) {
  const panel = el('div', 'info-panel' + (state.openInfoPanels[id] ? ' open' : ''));
  panel.dataset.infoPanel = id;
  if (noteBg) {
    const sec = el('div', 'info-panel-section');
    sec.innerHTML = `<strong>България</strong>${noteBg}`;
    panel.appendChild(sec);
  }
  if (notePerth) {
    const sec = el('div', 'info-panel-section');
    sec.innerHTML = `<strong>Пърт</strong>${notePerth}`;
    panel.appendChild(sec);
  }
  return panel;
}

// ── Savings helpers ───────────────────────────────────────────

// Calculate visa fee from state
function calcVisaFee() {
  const vf       = CFG.savings_module.visa_fees;
  const children = state.kindyChildren.length + state.schoolChildren.length;
  const adults   = Math.max(1, state.householdSize - children);
  const extraAdults = Math.max(0, adults - 1);

  if (state.visaType === 'pr') {
    return vf.pr_primary
      + extraAdults * vf.pr_additional_adult
      + children   * vf.pr_child;
  } else {
    return vf.v482_primary
      + extraAdults * vf.v482_additional_adult
      + children   * vf.v482_child;
  }
}

// Calculate visa fee breakdown string for ⓘ note
function calcVisaFeeBreakdown() {
  const vf       = CFG.savings_module.visa_fees;
  const children = state.kindyChildren.length + state.schoolChildren.length;
  const adults   = Math.max(1, state.householdSize - children);
  const extraAdults = Math.max(0, adults - 1);
  const lines = [];

  if (state.visaType === 'pr') {
    lines.push(`Основен кандидат: ${fmtAud(vf.pr_primary)}`);
    if (extraAdults > 0) lines.push(`${extraAdults} допълнителен/ни възрастен/ни × ${fmtAud(vf.pr_additional_adult)}: ${fmtAud(extraAdults * vf.pr_additional_adult)}`);
    if (children   > 0) lines.push(`${children} дете/деца × ${fmtAud(vf.pr_child)}: ${fmtAud(children * vf.pr_child)}`);
  } else {
    lines.push(`Основен кандидат: ${fmtAud(vf.v482_primary)}`);
    if (extraAdults > 0) lines.push(`${extraAdults} допълнителен/ни възрастен/ни × ${fmtAud(vf.v482_additional_adult)}: ${fmtAud(extraAdults * vf.v482_additional_adult)}`);
    if (children   > 0) lines.push(`${children} дете/деца × ${fmtAud(vf.v482_child)}: ${fmtAud(children * vf.v482_child)}`);
  }
  return lines.join(' · ');
}

// Calculate bond + advance from housing sub-type
function calcBondAndAdvance() {
  if (state.housingType === 'owner') return 0;
  const rb  = CFG.savings_module.rental_bond;
  const sub = state.housingSubRent;
  const weekly = rb.weekly_rent[sub] ?? rb.weekly_rent['3bed'];
  return weekly * (rb.bond_weeks + rb.advance_weeks);
}

// Single source for fixed arrival values — read from data.json by id
function smArrivalAud(id) {
  const item = CFG.savings_module.arrival.find(i => i.id === id);
  return item && typeof item.aud === 'number' ? item.aud : 0;
}
function smArrivalPerAdult(id) {
  const item = CFG.savings_module.arrival.find(i => i.id === id);
  return item && typeof item.per_adult === 'number' ? item.per_adult : 0;
}

// Number of adults derived from household + children
function adultCount() {
  const children = state.kindyChildren.length + state.schoolChildren.length;
  return Math.max(1, state.householdSize - children);
}

// ── Pure total calculators (used by render AND grand banner) ──
// Each returns { total, complete }. `complete` is false when a
// required user-input value is still missing — so totals are never
// shown as a misleadingly low "finished" number (Fix 3).
function calcPreDeparture() {
  const sm = CFG.savings_module;
  let total = calcVisaFee();
  let complete = true;

  if (state.visaType === 'pr') {
    if (state.savingsSkillsAssessment !== null) total += state.savingsSkillsAssessment;
    else complete = false;
    total += sm.visa_fees.wa_nomination;
  }

  if (state.savingsFlights !== null) total += state.savingsFlights;
  else complete = false;

  // English test — fixed, both visas
  const eng = sm.predeparture.find(i => i.id === 'english_test');
  if (eng && typeof eng.aud === 'number') total += eng.aud;

  return { total, complete };
}

function calcVehicleDuty(value) {
  if (!value || value <= 0) return 0;
  const d = CFG.savings_module.arrival.find(i => i.id === 'vehicle_duty');
  if (value <= d.tier1_max) return value * d.tier1_rate;
  if (value <= d.tier2_max) {
    return value * (d.tier1_rate + ((value - d.tier1_max) / d.tier1_max) * (d.tier3_rate - d.tier1_rate));
  }
  return value * d.tier3_rate;
}

function calcArrival() {
  let total = 0;
  let complete = true;

  const stayingWithHost = state.housingType === 'renter' && state.savingsRentalWaived;

  // Bond + premium only for renters who are not staying with family (Fix 4)
  if (state.housingType === 'renter' && !state.savingsRentalWaived) {
    total += calcBondAndAdvance();
    total += smArrivalAud('no_ref_premium');
  }

  // Furniture / white goods / kitchenware — skipped when using host's assets
  if (!stayingWithHost) {
    total += smArrivalAud('furniture');
    total += smArrivalAud('white_goods');
    total += smArrivalAud('kitchenware');
  }
  total += adultCount() * smArrivalPerAdult('sim');

  if (state.savingsCar) {
    if (state.savingsCarCost !== null) {
      total += state.savingsCarCost;
      total += calcVehicleDuty(state.savingsCarCost);
    }
    else complete = false;
    total += smArrivalAud('car_insurance');
    total += smArrivalAud('licence');
  }

  if (state.visaType === '482' && state.schoolChildren.length > 0) {
    total += smArrivalAud('school_registration');
  }

  return { total, complete };
}

function calcBuffer() {
  const floor = CFG.floor_costs[String(state.householdSize)]?.aud ?? 0;
  return floor * CFG.savings_module.emergency_buffer.multiplier;
}

function calcGrandTotal() {
  const pre = calcPreDeparture();
  const arr = calcArrival();
  return {
    total:    pre.total + arr.total,
    buffer:   calcBuffer(),
    complete: pre.complete && arr.complete
  };
}

// Build a savings table row — plain
function buildSavingsRow(labelText, audValue, noteText, extraClass) {
  const tr = el('tr', extraClass || '');
  const tdLabel = el('td', 'savings-row-label');

  const labelDiv = el('div', 'cat-label');
  labelDiv.textContent = labelText;
  tdLabel.appendChild(labelDiv);

  if (noteText) {
    const noteDiv = el('div', 'setup-note');
    noteDiv.textContent = noteText;
    tdLabel.appendChild(noteDiv);
  }

  tr.appendChild(tdLabel);

  const tdVal = el('td', 'savings-row-value');
  tdVal.textContent = audValue !== null ? fmtAud(audValue) : '—';
  tr.appendChild(tdVal);

  if (state.eurPerAud) {
    const tdEur = el('td', 'savings-row-eur');
    tdEur.textContent = audValue !== null ? `~${fmtEur(audValue * state.eurPerAud)}` : '—';
    tr.appendChild(tdEur);
  }

  return tr;
}

// Build a savings user-input row
function buildSavingsInputRow(labelText, hintText, stateKey, noteText) {
  const tr = el('tr', 'savings-input-row');
  const tdLabel = el('td', 'savings-row-label');

  const labelDiv = el('div', 'cat-label');
  labelDiv.textContent = labelText;
  tdLabel.appendChild(labelDiv);

  if (noteText) {
    const noteDiv = el('div', 'setup-note');
    noteDiv.textContent = noteText;
    tdLabel.appendChild(noteDiv);
  }

  tr.appendChild(tdLabel);

  const tdInput = el('td', 'savings-row-value');
  const inputWrap = el('div', 'savings-user-input-wrap');
  const sym = el('span', 'savings-input-sym');
  sym.textContent = '$';
  const input = el('input', 'savings-user-input');
  input.type        = 'number';
  input.min         = '0';
  input.step        = '1';
  input.inputMode   = 'numeric';
  input.placeholder = hintText;
  if (state[stateKey] !== null) input.value = state[stateKey];
  input.dataset.savingsKey = stateKey;
  inputWrap.appendChild(sym);
  inputWrap.appendChild(input);
  tdInput.appendChild(inputWrap);
  tr.appendChild(tdInput);

  if (state.eurPerAud) {
    const tdEur = el('td', 'savings-row-eur');
    tdEur.textContent = state[stateKey] !== null
      ? `~${fmtEur(state[stateKey] * state.eurPerAud)}`
      : '—';
    tr.appendChild(tdEur);
  }

  return tr;
}

// Build a savings toggle row (optional items)
function buildSavingsToggleRow(labelText, isOn, toggleKey, noteText) {
  const tr = el('tr', 'savings-toggle-row');
  const tdLabel = el('td', 'savings-row-label');

  const labelDiv = el('div', 'cat-label');
  labelDiv.textContent = labelText;
  tdLabel.appendChild(labelDiv);

  if (noteText) {
    const noteDiv = el('div', 'setup-note');
    noteDiv.textContent = noteText;
    tdLabel.appendChild(noteDiv);
  }

  tr.appendChild(tdLabel);

  const tdToggle = el('td', 'savings-row-value');
  tdToggle.colSpan = state.eurPerAud ? 2 : 1;
  const toggleWrap = el('div', 'toggle-control savings-toggle');
  [['Да', true], ['Не', false]].forEach(([txt, val]) => {
    const btn = el('button', 'tog-btn' + (isOn === val ? ' active' : ''));
    btn.setAttribute('type', 'button');
    btn.textContent = txt;
    btn.dataset.savingsToggle = toggleKey;
    btn.dataset.savingsVal    = val;
    toggleWrap.appendChild(btn);
  });
  tdToggle.appendChild(toggleWrap);
  tr.appendChild(tdToggle);

  return tr;
}

// Build savings section header row
function buildSavingsSectionHeader(text) {
  const tr = el('tr', 'savings-section-header');
  const td = el('td', '');
  td.colSpan = state.eurPerAud ? 3 : 2;
  td.textContent = text;
  tr.appendChild(td);
  return tr;
}

// Build savings total row
function buildSavingsTotalRow(labelText, audValue) {
  const tr = el('tr', 'savings-total-row');
  const tdLabel = el('td', '');
  tdLabel.textContent = labelText;
  tr.appendChild(tdLabel);

  const tdVal = el('td', 'savings-row-value');
  tdVal.textContent = audValue !== null ? `~${fmtAud(audValue)}` : '—';
  tr.appendChild(tdVal);

  if (state.eurPerAud) {
    const tdEur = el('td', 'savings-row-eur');
    tdEur.textContent = audValue !== null ? `~${fmtEur(audValue * state.eurPerAud)}` : '—';
    tr.appendChild(tdEur);
  }

  return tr;
}

// Print-only panel heading (hidden on screen, shown in PDF — Fix 2)
function buildPrintHeading(text) {
  const h = el('div', 'print-tab-heading');
  h.textContent = text;
  return h;
}

// ── Grand total banner (Fix 6) — above the three tabs ─────────
function buildSavingsGrandBanner() {
  const grand = calcGrandTotal();
  const div = el('div', 'savings-grand-banner');

  const label = el('div', 'savings-grand-label');
  label.textContent = 'Необходими средства за преместването';
  div.appendChild(label);

  if (grand.complete) {
    const valWrap = el('div', 'savings-grand-value-wrap');
    const aud = el('span', 'savings-grand-aud');
    aud.textContent = fmtAud(grand.total);
    valWrap.appendChild(aud);
    if (state.eurPerAud) {
      const eur = el('span', 'savings-grand-eur');
      eur.textContent = `≈ ${fmtEur(grand.total * state.eurPerAud)}`;
      valWrap.appendChild(eur);
    }
    div.appendChild(valWrap);

    const sub = el('div', 'savings-grand-sub');
    sub.textContent = 'Еднократни разходи за преместването (преди заминаване + при пристигане). Месечните разходи са отделни — вижте таб „Месечни разходи".';
    div.appendChild(sub);

    // Recommended buffer — shown separately, NOT added to the headline
    const rec = el('div', 'savings-grand-buffer');
    const eurBuf = state.eurPerAud ? ` (≈ ${fmtEur(grand.buffer * state.eurPerAud)})` : '';
    rec.textContent = `💡 Препоръчително отгоре: спешен буфер ${fmtAud(grand.buffer)}${eurBuf} — 3 месечни бюджета резерв. Не е задължителен, но горещо препоръчителен.`;
    div.appendChild(rec);
  } else {
    const val = el('div', 'savings-grand-value-wrap');
    const dash = el('span', 'savings-grand-aud savings-grand-incomplete');
    dash.textContent = '—';
    val.appendChild(dash);
    div.appendChild(val);

    const sub = el('div', 'savings-grand-sub');
    sub.textContent = 'Въведете билети и оценка на квалификацията, за да видите общата сума.';
    div.appendChild(sub);
  }

  return div;
}

// ── Pre-departure section ─────────────────────────────────────
function buildPreDepartureSection() {
  const sm = CFG.savings_module;
  const section = el('div', 'setup-section');

  const notice = el('div', 'setup-tab-header');
  notice.innerHTML = `<strong>Преди заминаване</strong>Разходите, които трябва да покриете преди да напуснете България.`;
  section.appendChild(notice);

  const wrap  = el('div', 'setup-table-wrap');
  const table = el('table', 'setup-table savings-table');
  const thead = el('thead');
  const hr    = el('tr');
  thCell(hr, 'Разход', 'left');
  thCell(hr, 'AUD', 'right');
  if (state.eurPerAud) thCell(hr, 'EUR (прибл.)', 'right');
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody  = el('tbody');

  // Visa fee — auto-calculated
  tbody.appendChild(buildSavingsRow('Такса виза', calcVisaFee(), calcVisaFeeBreakdown()));

  // Skills assessment + WA nomination — PR only
  if (state.visaType === 'pr') {
    tbody.appendChild(buildSavingsInputRow(
      'Оценка на квалификацията',
      '500–2000',
      'savingsSkillsAssessment',
      'Типично $500–$2 000. Въведете точната такса на вашия оценяващ орган.'
    ));
    tbody.appendChild(buildSavingsRow(
      'Номинация от WA (SNMP)',
      sm.visa_fees.wa_nomination,
      'Само ако кандидатствате за щатска номинация (виза 190 или 491). Невъзстановима.'
    ));
  }

  // English test — fixed, both visas
  const engItem = sm.predeparture.find(i => i.id === 'english_test');
  if (engItem) {
    tbody.appendChild(buildSavingsRow(engItem.label_bg, engItem.aud, engItem.note_bg));
  }

  // Flights — user input
  tbody.appendChild(buildSavingsInputRow(
    'Самолетни билети (SOF → PER)',
    '3600–4800',
    'savingsFlights',
    'Еднопосочен, икономична класа. Резервирайте 3–6 месеца предварително.'
  ));

  table.appendChild(tbody);

  // Honest total (Fix 3): show "—" until all required inputs are filled
  const pre = calcPreDeparture();
  const tfoot = el('tfoot');
  tfoot.appendChild(buildSavingsTotalRow('Общо преди заминаване', pre.complete ? pre.total : null));
  table.appendChild(tfoot);

  wrap.appendChild(table);
  section.appendChild(wrap);

  if (!pre.complete) {
    const hint = el('p', 'savings-incomplete-hint');
    hint.textContent = '⚠️ Въведете липсващите суми (билети' +
      (state.visaType === 'pr' ? ', оценка на квалификацията' : '') +
      '), за да видите общата сума.';
    section.appendChild(hint);
  }

  if (sm.predeparture_note_bg) {
    const other = el('p', 'savings-other-note');
    other.textContent = sm.predeparture_note_bg;
    section.appendChild(other);
  }

  return section;
}

// ── Arrival section ───────────────────────────────────────────
function buildArrivalSection() {
  const sm     = CFG.savings_module;
  const eb     = sm.emergency_buffer;
  const floor  = CFG.floor_costs[String(state.householdSize)]?.aud ?? 0;
  const buffer = floor * eb.multiplier;
  const section = el('div', 'setup-section');

  const notice = el('div', 'setup-tab-header');
  notice.innerHTML = `<strong>При пристигане</strong>Еднократни разходи в първите седмици след пристигането ви в Пърт.`;
  section.appendChild(notice);

  const wrap  = el('div', 'setup-table-wrap');
  const table = el('table', 'setup-table savings-table');
  const thead = el('thead');
  const hr    = el('tr');
  thCell(hr, 'Разход', 'left');
  thCell(hr, 'AUD', 'right');
  if (state.eurPerAud) thCell(hr, 'EUR (прибл.)', 'right');
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el('tbody');

  // Bond + premium block — renters only (Fix 4: owners never see this)
  if (state.housingType === 'renter') {
    tbody.appendChild(buildSavingsToggleRow(
      'Оставам при роднини/приятели',
      state.savingsRentalWaived,
      'savingsRentalWaived',
      'Ако не е нужно да наемате жилище веднага, пропускате депозит и аванс.'
    ));

    if (!state.savingsRentalWaived) {
      const bondTotal = calcBondAndAdvance();
      const rb     = sm.rental_bond;
      const sub    = state.housingSubRent;
      const weekly = rb.weekly_rent[sub] ?? rb.weekly_rent['3bed'];
      tbody.appendChild(buildSavingsRow(
        'Депозит + аванс наем',
        bondTotal,
        `${rb.bond_weeks} седмици депозит + ${rb.advance_weeks} седмици аванс × ${fmtAud(weekly)}/седмица.`
      ));
      tbody.appendChild(buildSavingsRow(
        'Доплащане без местни препоръки',
        smArrivalAud('no_ref_premium'),
        'Нови имигранти рядко имат препоръки от местни наемодатели. Приблизителна стойност.'
      ));
    }
  }

  // Furniture / white goods / kitchenware — skipped when staying with host
  const stayingWithHost = state.housingType === 'renter' && state.savingsRentalWaived;
  if (!stayingWithHost) {
    tbody.appendChild(buildSavingsRow('Мебели (бюджетен пакет)', smArrivalAud('furniture'), 'IKEA / Fantastic Furniture. Диапазон: $2 500–$3 500.'));
    tbody.appendChild(buildSavingsRow('Бяла техника', smArrivalAud('white_goods'), 'Хладилник + пералня, бюджетен клас. Диапазон: $1 100–$1 600.'));
    tbody.appendChild(buildSavingsRow('Съдове и спално бельо', smArrivalAud('kitchenware'), 'Kmart / Target. Диапазон: $350–$500.'));
  } else {
    tbody.appendChild(buildSavingsRow(
      'Обзавеждане и техника',
      0,
      'Докато сте при близки, ползвате техните мебели и техника. Тези разходи ще възникнат по-късно, когато се преместите в собствено жилище.'
    ));
  }

  // SIM — per adult
  const adults  = adultCount();
  const perAdult = smArrivalPerAdult('sim');
  tbody.appendChild(buildSavingsRow(
    'SIM карти и мобилни планове',
    adults * perAdult,
    `${adults} възрастен/ни × ${fmtAud(perAdult)} (Belong / Aldi Mobile, първи месец).`
  ));

  // Car — optional toggle + user input
  tbody.appendChild(buildSavingsToggleRow(
    'Нужна ми е кола от първия ден',
    state.savingsCar,
    'savingsCar',
    'Пърт е разпръснат град — колата е практически задължителна.'
  ));

  if (state.savingsCar) {
    tbody.appendChild(buildSavingsInputRow(
      'Кола втора ръка',
      '12000–16500',
      'savingsCarCost',
      'Toyota Corolla / Camry, 5–10 год. Въведете очакваната сума.'
    ));
    if (state.savingsCarCost !== null) {
      const dutyItem = CFG.savings_module.arrival.find(i => i.id === 'vehicle_duty');
      tbody.appendChild(buildSavingsRow(
        dutyItem.label_bg,
        Math.round(calcVehicleDuty(state.savingsCarCost)),
        dutyItem.note_bg
      ));
    }
    tbody.appendChild(buildSavingsRow('Застраховка кола (1 год.)', smArrivalAud('car_insurance'), 'TPDI чрез RAC или HBF. Диапазон: $950–$1 400.'));
    tbody.appendChild(buildSavingsRow('Шофьорска книжка WA (5 год.)', smArrivalAud('licence'), 'България не е призната страна в WA — не можете да конвертирате директно. Трябва да положите теоретичен изпит (~$193) и практически тест (HPT $28). Таксата тук е за 5-годишната книжка след успешно издържани изпити. DoT WA, ноември 2025.'));
  }

  // School registration — 482 + school children only
  if (state.visaType === '482' && state.schoolChildren.length > 0) {
    tbody.appendChild(buildSavingsRow(
      'Такса записване в училище',
      smArrivalAud('school_registration'),
      'Еднократна такса за семейство (TAFE International WA). Виза 482.'
    ));
  }

  // Emergency buffer — own section, kept separate from setup spend
  tbody.appendChild(buildSavingsSectionHeader('Спешен финансов буфер'));
  tbody.appendChild(buildSavingsRow(
    eb.label_bg,
    buffer,
    `3 × минимален месечен бюджет в Пърт за ${state.householdSize} души (${fmtAud(floor)}/мес.). Не го харчете — само за извънредни ситуации.`
  ));

  table.appendChild(tbody);

  // Honest total (Fix 3): "—" until car cost entered (when car is on)
  const arr = calcArrival();
  const tfoot = el('tfoot');
  tfoot.appendChild(buildSavingsTotalRow('Общо еднократни разходи (без буфер)', arr.complete ? arr.total : null));
  table.appendChild(tfoot);

  wrap.appendChild(table);
  section.appendChild(wrap);

  if (!arr.complete) {
    const carNote = el('p', 'savings-incomplete-hint');
    carNote.textContent = '⚠️ Въведете очакваната цена на колата, за да видите общата сума.';
    section.appendChild(carNote);
  }

  return section;
}

// ── Totals ────────────────────────────────────────────────────
function calcTotals() {
  let bgEur = 0, perthAud = 0;
  const cats = visibleCategories();

  cats.forEach(cat => {
    if (cat.grocery && cat.grocery_option !== state.groceryChoice) return;
    if (cat.transport && cat.transport_option !== state.transportChoice) return;
    if (cat.housing_type && cat.housing_sub !== activeHousingSub()) return;
    // IMP-014: skip null bg_eur rows from BG total (housing rows, ownership costs)
    if (cat.bg_eur !== null) bgEur += scaleBgEur(cat);
    perthAud += scaleAud(cat);
  });

  // IMP-012: add self-reported BG housing cost
  bgEur += state.bgHousingCost || 0;

  if (state.hasKids && state.householdSize > 1) {
    const kc = CFG.kids_config;
    state.kindyChildren.forEach((child, idx) => {
      const bgVal = state.bgOverrides['kindy_' + idx] !== undefined
        ? state.bgOverrides['kindy_' + idx]
        : (child.bgType === 'municipal' ? kc.kindy.bg_municipal_eur : kc.kindy.bg_private_eur);
      bgEur    += bgVal;
      const is482 = state.visaType === '482';
      const effectiveCcsView = is482 ? 'gross' : (child.ccsView || 'net');
      perthAud += effectiveCcsView === 'net' ? kc.kindy.perth_aud_net_pr_median : kc.kindy.perth_aud;
    });
    state.schoolChildren.forEach((child, idx) => {
      const bgVal = state.bgOverrides['school_' + idx] !== undefined
        ? state.bgOverrides['school_' + idx]
        : kc.school.bg_eur;
      bgEur += bgVal;
      // BUG-001 FIX: first 482 child pays full rate; subsequent children pay PR ancillaries only
      perthAud += state.visaType === 'pr'
        ? kc.school.perth_aud_pr
        : (idx === 0 ? kc.school.perth_aud_482 : kc.school.perth_aud_pr);
    });
  }

  return { bgEur, perthAud };
}

function calcKidsTotals() {
  let bgEur = 0, perthAud = 0;
  if (!state.hasKids || state.householdSize <= 1) return { bgEur, perthAud };
  const kc = CFG.kids_config;
  state.kindyChildren.forEach((child, idx) => {
    bgEur    += state.bgOverrides['kindy_' + idx] !== undefined
      ? state.bgOverrides['kindy_' + idx]
      : (child.bgType === 'municipal' ? kc.kindy.bg_municipal_eur : kc.kindy.bg_private_eur);
    const is482 = state.visaType === '482';
    const effectiveCcsView = is482 ? 'gross' : (child.ccsView || 'net');
    perthAud += effectiveCcsView === 'net' ? kc.kindy.perth_aud_net_pr_median : kc.kindy.perth_aud;
  });
  state.schoolChildren.forEach((child, idx) => {
    bgEur += state.bgOverrides['school_' + idx] !== undefined
      ? state.bgOverrides['school_' + idx]
      : kc.school.bg_eur;
    perthAud += state.visaType === 'pr'
      ? kc.school.perth_aud_pr
      : (idx === 0 ? kc.school.perth_aud_482 : kc.school.perth_aud_pr);
  });
  return { bgEur, perthAud };
}

// ── Sticky total bar ──────────────────────────────────────────
function buildStickyTotal(container) {
  const totals  = calcTotals();
  const pEur    = audToEur(totals.perthAud);
  const sizeKey = String(state.householdSize);
  const floor   = CFG.floor_costs[sizeKey]?.aud ?? 0;
  const isOk    = totals.perthAud >= floor;

  // Remove any existing sticky bar
  const existing = document.getElementById('sticky-total-bar');
  if (existing) existing.remove();
  const existingPopup = document.getElementById('sticky-floor-popup');
  if (existingPopup) existingPopup.remove();

  const bar = el('div', 'sticky-total');
  bar.id = 'sticky-total-bar';

  const nums = el('div', 'sticky-total-nums');

  const bgItem = el('div', 'sticky-total-item');
  const bgLbl  = el('span', 'sticky-total-label');
  bgLbl.textContent = 'България';
  const bgVal  = el('span', 'sticky-total-value');
  bgVal.textContent = fmtEur(totals.bgEur);
  bgItem.appendChild(bgLbl);
  bgItem.appendChild(bgVal);
  nums.appendChild(bgItem);

  const div1 = el('div', 'sticky-total-divider');
  nums.appendChild(div1);

  const perthItem = el('div', 'sticky-total-item');
  const perthLbl  = el('span', 'sticky-total-label');
  perthLbl.textContent = 'Пърт';
  const perthVal  = el('span', 'sticky-total-value');
  perthVal.textContent = fmtAud(totals.perthAud);
  perthItem.appendChild(perthLbl);
  perthItem.appendChild(perthVal);
  nums.appendChild(perthItem);

  if (pEur) {
    const div2 = el('div', 'sticky-total-divider');
    nums.appendChild(div2);
    const eurItem = el('div', 'sticky-total-item');
    const eurLbl  = el('span', 'sticky-total-label');
    eurLbl.textContent = 'Пърт (EUR)';
    const eurVal  = el('span', 'sticky-total-value');
    eurVal.textContent = fmtEur(pEur);
    eurItem.appendChild(eurLbl);
    eurItem.appendChild(eurVal);
    nums.appendChild(eurItem);
  }

  bar.appendChild(nums);

  const floorIcon = el('span', 'sticky-floor-icon no-print');
  floorIcon.id = 'sticky-floor-icon';
  floorIcon.textContent = isOk ? '✅' : '⚠️';
  floorIcon.title = 'Минимален препоръчителен бюджет';
  bar.appendChild(floorIcon);

  document.body.appendChild(bar);

  // Floor popup
  const floorSizeLabel = state.householdSize;
  const popup = el('div', `sticky-floor-popup ${isOk ? 'ok' : 'warn'}${state.floorPopupOpen ? ' visible' : ''}`);
  popup.id = 'sticky-floor-popup';
  if (isOk) {
    popup.innerHTML = `<strong>✓ Реалистичен бюджет</strong>Изчисленият разход надвишава препоръчителния минимум от ${fmtAud(floor)}/мес. за домакинство от ${floorSizeLabel} души в Пърт.`;
  } else {
    popup.innerHTML = `<strong>⚠️ Под препоръчителния минимум</strong>Изчисленият бюджет е под ${fmtAud(floor)}/мес. — препоръчителния минимум за домакинство от ${floorSizeLabel} души. Проверете дали сте включили всички разходи.`;
  }
  document.body.appendChild(popup);
}

function updateStickyVisibility() {
  const bar   = document.getElementById('sticky-total-bar');
  const popup = document.getElementById('sticky-floor-popup');
  if (!bar) return;
  if (state.activeResultsTab === 'monthly') {
    bar.style.display = '';
    if (popup) popup.style.display = state.floorPopupOpen ? '' : 'none';
  } else {
    bar.style.display = 'none';
    if (popup) popup.style.display = 'none';
  }
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
  if (CFG.meta.buffer_note) {
    const bufNote = el('p', 'footer-buffer-note');
    bufNote.textContent = CFG.meta.buffer_note;
    div.appendChild(bufNote);
  }
  return div;
}

// ── Event wiring ──────────────────────────────────────────────
function wireAccordionEvents(container) {
  container.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.accordion-item');
      const id   = item.dataset.accId;
      state.openAccordion = state.openAccordion === id ? null : id;
      renderResults();
    });
  });
}

function wireInfoPanelEvents(container) {
  container.querySelectorAll('.info-toggle-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.infoId;
      state.openInfoPanels[id] = !state.openInfoPanels[id];
      renderResults();
    });
  });
}

function wireKidsEvents(container) {
  // BUG-002 FIX: selector was '.kindy-bg-btn' but buttons have class 'kids-bg-btn'
  container.querySelectorAll('.kids-bg-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      state.kindyChildren[idx].bgType = btn.dataset.bgtype;
      renderResults();
    });
  });

  // CCS gross/net toggle
  container.querySelectorAll('.kindy-ccs-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      state.kindyChildren[idx].ccsView = btn.dataset.ccsview;
      renderResults();
    });
  });

  container.querySelectorAll('.kindy-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      state.kindyChildren.splice(idx, 1);
      renderResults();
    });
  });

  const addKindy = container.querySelector('#btn-add-kindy');
  if (addKindy) {
    addKindy.addEventListener('click', e => {
      e.stopPropagation();
      state.kindyChildren.push({ bgType: 'municipal', ccsView: state.visaType === '482' ? 'gross' : 'net' });
      renderResults();
    });
  }

  container.querySelectorAll('.school-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      state.schoolChildren.splice(idx, 1);
      renderResults();
    });
  });

  const addSchool = container.querySelector('#btn-add-school');
  if (addSchool) {
    addSchool.addEventListener('click', e => {
      e.stopPropagation();
      state.schoolChildren.push({});
      renderResults();
    });
  }
}

function wireSubToggleEvents(container) {
  container.querySelectorAll('.acc-sub-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (btn.dataset.subType === 'housing') {
        if (state.housingType === 'renter') state.housingSubRent = btn.dataset.sub;
        else state.housingSubOwner = btn.dataset.sub;
      } else if (btn.dataset.subType === 'grocery') {
        state.groceryChoice = btn.dataset.grocery;
      } else if (btn.dataset.subType === 'transport') {
        state.transportChoice = btn.dataset.transport;
      }
      renderResults();
    });
  });
}

function wireTabEvents(container) {
  const order = ['predeparture', 'arrival', 'monthly'];
  container.querySelectorAll('.results-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeResultsTab = btn.dataset.tab;
      updateStickyVisibility();
      container.querySelectorAll('.results-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      container.querySelectorAll('.results-tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel-' + btn.dataset.tab)?.classList.add('active');
      // Slide the indicator — element persists, so this animates
      const ind = container.querySelector('.results-tab-indicator');
      const idx = order.indexOf(btn.dataset.tab);
      if (ind && idx >= 0) ind.style.transform = `translateX(${idx * 100}%)`;
    });
  });
}

function wireStickyFloorEvent(container) {
  const icon = document.getElementById('sticky-floor-icon');
  if (icon) {
    icon.addEventListener('click', e => {
      e.stopPropagation();
      state.floorPopupOpen = !state.floorPopupOpen;
      const popup = document.getElementById('sticky-floor-popup');
      if (popup) popup.classList.toggle('visible', state.floorPopupOpen);
    });
  }
  // Close popup on outside tap
  document.addEventListener('click', () => {
    if (state.floorPopupOpen) {
      state.floorPopupOpen = false;
      const popup = document.getElementById('sticky-floor-popup');
      if (popup) popup.classList.remove('visible');
    }
  }, { once: true });
}

function wireBgEditEvents(container) {
  container.querySelectorAll('.bg-edit-input-large').forEach(input => {
    input.addEventListener('change', e => {
      const newVal = parseFloat(e.target.value);
      if (!isNaN(newVal) && newVal >= 0) {
        state.bgOverrides[input.dataset.catId] = newVal;
        renderResults();
      }
    });
  });
}

// Wire savings module inputs and toggles
function wireSavingsEvents(container) {
  // User input fields (flights, skills assessment, car cost).
  // Use 'change' (fires on blur) NOT 'input' — re-rendering mid-keystroke
  // destroys the field and drops focus/keyboard on mobile (Fix 1/7).
  container.querySelectorAll('.savings-user-input').forEach(input => {
    input.addEventListener('change', e => {
      const key = input.dataset.savingsKey;
      const val = parseFloat(e.target.value);
      state[key] = (!isNaN(val) && val >= 0) ? val : null;
      renderResults();
    });

    // Tab / Shift+Tab: cycle between savings inputs within the container.
    // Without this, Tab exhausts focusable elements in the panel and
    // jumps to the browser URL bar instead of staying in the app.
    input.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const inputs = Array.from(container.querySelectorAll('.savings-user-input'));
      const idx    = inputs.indexOf(input);
      if (inputs.length < 2) return; // nothing to cycle to; let browser handle
      e.preventDefault();
      const next = e.shiftKey
        ? inputs[(idx - 1 + inputs.length) % inputs.length]
        : inputs[(idx + 1) % inputs.length];
      next.focus();
    });
  });

  // Toggle buttons (rental waived, car)
  container.querySelectorAll('[data-savings-toggle]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const key = btn.dataset.savingsToggle;
      const val = btn.dataset.savingsVal === 'true';
      state[key] = val;
      renderResults();
    });
  });
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
