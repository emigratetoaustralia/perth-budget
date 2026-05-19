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
  transportChoice:  '1car',   // '1car' | '2cars'
  hasKids:          true,
  hasPets:          true,
  kindyChildren:    [],       // [{bgType: 'municipal'|'private', ccsView: 'gross'|'net'}]
  schoolChildren:   [],       // [{}]  one entry per school-age child
  bgOverrides:      {},
  activeResultsTab: 'monthly',  // 'monthly' | 'setup'
  openAccordion:    null,        // id of currently open accordion section
  openInfoPanels:   {},          // {sectionId: bool}
  floorPopupOpen:   false,
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
    state.householdSize = parseInt(v);
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

  // IMP-002: inject version from data.json into input header
  const versionSpan = document.getElementById('app-version');
  if (versionSpan && CFG.meta.version) {
    versionSpan.textContent = 'v' + CFG.meta.version;
  }
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
  container.appendChild(buildResultsTabBar());

  const monthlyPanel = el('div', 'results-tab-panel' + (state.activeResultsTab === 'monthly' ? ' active' : ''));
  monthlyPanel.id = 'panel-monthly';
  monthlyPanel.appendChild(buildAccordionList());
  container.appendChild(monthlyPanel);

  const setupPanel = el('div', 'results-tab-panel' + (state.activeResultsTab === 'setup' ? ' active' : ''));
  setupPanel.id = 'panel-setup';
  setupPanel.appendChild(buildSetupSection());
  container.appendChild(setupPanel);

  // Footer visible below both tabs
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
    <span class="meta-item"><i class="meta-icon">👨‍👩‍👦</i> ${sizeLabel}</span>
    <span class="meta-sep">·</span>
    <span class="meta-item"><i class="meta-icon">🏠</i> ${hsLabel}</span>
    <span class="meta-sep">·</span>
    <span class="meta-item"><i class="meta-icon">📄</i> ${visaLabel}</span>
    <span class="meta-sep">·</span>
    <span class="meta-item"><i class="meta-icon">💱</i> ${rateLabel}</span>
  `;
  div.addEventListener('click', showInput);
  return div;
}

// ── Results tab bar ───────────────────────────────────────────
function buildResultsTabBar() {
  const bar = el('div', 'results-tab-bar no-print');
  bar.innerHTML = `
    <button class="results-tab-btn${state.activeResultsTab === 'monthly' ? ' active' : ''}" data-tab="monthly">Месечни разходи</button>
    <button class="results-tab-btn${state.activeResultsTab === 'setup'   ? ' active' : ''}" data-tab="setup">Първа година</button>
  `;
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
  chevron.textContent = '▼';

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
  const bgEur = scaleBgEur(cat);
  const pAud  = scaleAud(cat);

  return buildAccordionItem(
    cat.id,
    cat.label_bg,
    fmtEur(bgEur),
    fmtAud(pAud),
    body => {
      body.appendChild(buildNumBlock(cat.id, bgEur, pAud, cat));
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
  const bgEur     = scaleBgEur(activeCat);
  const pAud      = scaleAud(activeCat);
  const label     = state.housingType === 'renter' ? 'Жилище (наем)' : 'Жилище (ипотека)';

  return buildAccordionItem(
    'housing',
    label,
    fmtEur(bgEur),
    fmtAud(pAud),
    body => {
      // Sub-toggle
      const toggle = el('div', 'acc-sub-toggle');
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

      // Number block for active sub
      body.appendChild(buildNumBlock('housing', bgEur, pAud, activeCat));

      if (activeCat.note_bg || activeCat.note_perth) {
        body.appendChild(buildInfoToggle('housing'));
        body.appendChild(buildInfoPanel('housing', activeCat.note_bg, activeCat.note_perth));
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

// ── Totals ────────────────────────────────────────────────────
function calcTotals() {
  let bgEur = 0, perthAud = 0;
  const cats = visibleCategories();

  cats.forEach(cat => {
    if (cat.grocery && cat.grocery_option !== state.groceryChoice) return;
    if (cat.transport && cat.transport_option !== state.transportChoice) return;
    if (cat.housing_type && cat.housing_sub !== activeHousingSub()) return;
    bgEur    += scaleBgEur(cat);
    perthAud += scaleAud(cat);
  });

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

// ── Setup costs ───────────────────────────────────────────────
function buildSetupSection() {
  const hasEur  = !!state.eurPerAud;
  const section = el('div', 'setup-section');

  const notice = el('div', 'setup-tab-header');
  notice.innerHTML = `<strong>Еднократни разходи — Първа година</strong>Тези разходи се правят веднъж при пристигане и не са включени в месечния бюджет.`;
  section.appendChild(notice);

  const wrap  = el('div', 'setup-table-wrap');
  const table = el('table', 'setup-table');

  const thead = el('thead');
  const hr    = el('tr');
  thCell(hr, 'Разход', 'left');
  thCell(hr, 'AUD', 'right');
  if (hasEur) thCell(hr, 'EUR (прибл.)', 'right');
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody    = el('tbody');
  let totalAud   = 0;

  CFG.setup_costs.forEach(item => {
    if (!item.all_visa && item.visa_type && item.visa_type !== state.visaType) return;

    totalAud += item.aud;
    const pEur = audToEur(item.aud);

    const tr      = el('tr');
    const nameTd  = el('td');
    const isVisa  = !item.all_visa && item.visa_type;
    nameTd.innerHTML = `
      <div class="cat-label">
        ${item.label_bg}
        ${isVisa ? `<span class="visa-tag">482</span>` : ''}
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
  const lbl      = el('td');
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
  container.querySelectorAll('.results-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeResultsTab = btn.dataset.tab;
      updateStickyVisibility();
      container.querySelectorAll('.results-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      container.querySelectorAll('.results-tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel-' + btn.dataset.tab)?.classList.add('active');
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
