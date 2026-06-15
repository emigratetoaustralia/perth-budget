'use strict';

// ============================================================
// 1. DATA
// ============================================================
let DATA = null;

// ============================================================
// 2. STATE
// ============================================================
const state = {
  visaKey:           null,
  householdType:     null,
  adultCount:        1,
  childCount:        0,
  partnerEnglish:    null,
  schoolAgeChildren: null,
  transport:         null,
  propertyType:      null,
  location:          null,
  eurPerAud:         null
};

// ============================================================
// 3. WIZARD ENGINE
// ============================================================

const ALL_CARDS = [
  'exchange_rate',
  'visa_type',
  'household',
  'partner_english',
  'school_children',
  'skills_assessment',
  'transport',
  'property_type',
  'location',
  'summary_trigger'
];

let cardHistory    = [];
let currentCardKey = null;
let isAnimating    = false;
const ANIM_MS      = 320;

function getActiveCards() {
  return ALL_CARDS.filter(key => {
    if (key === 'partner_english') {
      return (state.visaKey === 'pr_189' || state.visaKey === 'pr_190') &&
             (state.householdType === 'couple' || state.householdType === 'family');
    }
    if (key === 'school_children') {
      return state.visaKey === 'visa_482' && state.childCount > 0;
    }
    return true;
  });
}

function getNextCard(key) {
  const active = getActiveCards();
  const idx    = active.indexOf(key);
  return idx < active.length - 1 ? active[idx + 1] : null;
}

function getCurrentProgress() {
  const active = getActiveCards();
  const idx    = active.indexOf(currentCardKey);
  return (idx + 1) / active.length;
}

function navigate(targetKey, direction) {
  if (isAnimating) return;
  isAnimating = true;

  const viewport   = document.getElementById('card-viewport');
  const oldCard    = document.getElementById('card-current');
  const newCard    = document.createElement('div');

  newCard.id        = 'card-next';
  newCard.className = 'card';
  newCard.innerHTML = renderCard(targetKey);

  const enterFrom = direction === 'forward' ? '100%' : '-100%';
  const exitTo    = direction === 'forward' ? '-100%' : '100%';

  newCard.style.transform = `translateX(${enterFrom})`;
  viewport.appendChild(newCard);
  bindCardEvents(targetKey, newCard);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      oldCard.style.transition  = `transform ${ANIM_MS}ms cubic-bezier(0.4,0,0.2,1)`;
      newCard.style.transition  = `transform ${ANIM_MS}ms cubic-bezier(0.4,0,0.2,1)`;
      oldCard.style.transform   = `translateX(${exitTo})`;
      newCard.style.transform   = 'translateX(0)';

      setTimeout(() => {
        oldCard.remove();
        newCard.id         = 'card-current';
        newCard.style.transition = '';
        newCard.style.transform  = '';
        currentCardKey = targetKey;
        updateProgress();
        isAnimating = false;
      }, ANIM_MS);
    });
  });
}

function goForward(targetKey) {
  if (!targetKey) return;
  cardHistory.push(currentCardKey);
  navigate(targetKey, 'forward');
}

function goBack() {
  if (cardHistory.length === 0) return;
  const prev = cardHistory.pop();
  navigate(prev, 'back');
}

function updateProgress() {
  const pct  = getCurrentProgress();
  const fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = (pct * 100) + '%';

  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.style.visibility = cardHistory.length > 0 ? 'visible' : 'hidden';
}

// ============================================================
// 4. CARD RENDERERS
// ============================================================

function renderCard(key) {
  const map = {
    exchange_rate:     cardExchangeRate,
    visa_type:         cardVisaType,
    household:         cardHousehold,
    partner_english:   cardPartnerEnglish,
    school_children:   cardSchoolChildren,
    skills_assessment: cardSkillsAssessment,
    transport:         cardTransport,
    property_type:     cardPropertyType,
    location:          cardLocation,
    summary_trigger:   cardSummaryTrigger
  };
  return map[key] ? map[key]() : '';
}

function msg(text) {
  return `<div class="msg-bubble">${text}</div>`;
}

function choiceBtn(value, label, selected) {
  return `<button class="choice-btn${selected ? ' choice-btn--selected' : ''}" data-value="${value}">${label}</button>`;
}

// --- Card 1: Exchange rate ---
function cardExchangeRate() {
  const anchor = DATA.meta.currency_anchor_eur_per_aud;
  return `
    ${msg(`Здравей! Аз съм твоят личен финансов асистент за преместване в Пърт. Ще те преведа през всеки разход — от визата до месечния наем.<br><br>Всички суми са в австралийски долари (AUD). Ако искаш да виждаш стойностите и в евро, въведи днешния курс.<br><br><span class="msg-note">Насочващ курс: 1 AUD = ${anchor} EUR (средата на 2026)</span>`)}
    <div class="card-inputs">
      <button class="choice-btn${state.eurPerAud === null ? ' choice-btn--selected' : ''}" id="aud-only-btn">Само AUD</button>
      <div class="rate-row">
        <span class="rate-label">1 AUD =</span>
        <input type="number" id="eur-input" class="rate-input"
          placeholder="${anchor}"
          value="${state.eurPerAud !== null ? state.eurPerAud : ''}"
          min="0.1" max="2" step="0.01">
        <span class="rate-label">EUR</span>
      </div>
      <button class="primary-btn" id="rate-confirm">Продължи →</button>
    </div>
  `;
}

// --- Card 2: Visa type ---
function cardVisaType() {
  return `
    ${msg('Най-важният въпрос: по какъв път отиваш в Австралия?')}
    <div class="card-inputs">
      <div class="choice-group">
        ${DATA.visa.options.map(o =>
          choiceBtn(o.key, o.label_bg, state.visaKey === o.key)
        ).join('')}
      </div>
    </div>
  `;
}

// --- Card 3: Household ---
function cardHousehold() {
  const isFamily = state.householdType === 'family';
  return `
    ${msg('Само ти ли заминаваш, или пътувате заедно с някой?')}
    <div class="card-inputs">
      <div class="choice-group">
        ${choiceBtn('solo',   'Само аз',               state.householdType === 'solo')}
        ${choiceBtn('couple', 'Аз и партньорът ми',    state.householdType === 'couple')}
        ${choiceBtn('family', 'Семейство с деца',       state.householdType === 'family')}
      </div>
      ${isFamily ? `
        <div class="child-counter">
          <span class="counter-label">Брой деца:</span>
          <div class="counter-controls">
            <button class="counter-btn" id="child-minus">−</button>
            <span class="counter-value" id="child-count">${state.childCount}</span>
            <button class="counter-btn" id="child-plus">+</button>
          </div>
        </div>
        <button class="primary-btn" id="household-confirm">Продължи →</button>
      ` : ''}
    </div>
  `;
}

// --- Card 4: Partner English (conditional) ---
function cardPartnerEnglish() {
  const si = DATA.visa.second_instalment;
  return `
    ${msg(`Важен въпрос за партньорът ти: има ли валиден резултат от езиков изпит (IELTS или PTE)?<br><br>Ако не — правителството добавя задължителна втора вноска от <strong>$${si.amount.toLocaleString()} AUD</strong> към визата.`)}
    <div class="card-inputs">
      <div class="choice-group">
        ${choiceBtn('yes', 'Да, има / ще се яви на изпит', state.partnerEnglish === true)}
        ${choiceBtn('no',  'Не / Не сме сигурни',          state.partnerEnglish === false)}
      </div>
      ${state.partnerEnglish === false
        ? `<div class="info-note">${si.note_bg}</div>` : ''}
    </div>
  `;
}

// --- Card 5: School children (conditional) ---
function cardSchoolChildren() {
  const s = DATA.monthly.school;
  return `
    ${msg(`Тъй като идвате на временна виза с деца, Западна Австралия начислява задължителна такса за обучение в държавните училища.<br><br>Таксата е <strong>$${s.first_child_monthly}/мес</strong> за първото дете, и <strong>$${s.subsequent_child_monthly}/мес</strong> за всяко следващо.<br><br>Децата ви в училищна възраст ли са (5 до 18 години)?`)}
    <div class="card-inputs">
      <div class="choice-group">
        ${choiceBtn('yes', 'Да, в училищна възраст', state.schoolAgeChildren === true)}
        ${choiceBtn('no',  'Не, по-малки са',         state.schoolAgeChildren === false)}
      </div>
    </div>
  `;
}

// --- Card 6: Skills assessment (info only) ---
function cardSkillsAssessment() {
  const sa   = DATA.predeparture.skills_assessment;
  const link = DATA.meta.source_links[sa.source_key];
  return `
    ${msg(`Преди да кандидатстваш за постоянно пребиваване ще ти трябва оценка на уменията от признат австралийски орган.<br><br>Цената варира значително: от <strong>$${sa.range_min}</strong> до <strong>$${sa.range_max} AUD</strong> според професията и оценяващия орган.<br><br>Тази сума <strong>не е включена</strong> в резюмето — провери конкретната такса за твоята професия.<br><br><a href="${link}" target="_blank" class="source-link">→ Провери таксата за твоята професия</a>`)}
    <div class="card-inputs">
      <button class="primary-btn" id="skills-next">Разбрах, продължи →</button>
    </div>
  `;
}

// --- Card 7: Transport ---
function cardTransport() {
  const t = DATA.monthly.transport;
  return `
    ${msg('Пърт е огромен и разпръснат град. Общественият транспорт работи добре в центъра, но не стига навсякъде.<br><br>Планираш ли да купиш кола след пристигането, или ще разчиташ на автобуси и влакове?')}
    <div class="card-inputs">
      <div class="choice-group">
        ${choiceBtn('car',        `Купувам кола (~$${t.car_running_monthly}/мес + начални разходи)`, state.transport === 'car')}
        ${choiceBtn('transperth', `Само обществен транспорт (~$${t.transperth_adult_monthly}/мес на човек)`, state.transport === 'transperth')}
      </div>
    </div>
  `;
}

// --- Card 8: Property type ---
function cardPropertyType() {
  const types = DATA.housing.types;
  return `
    ${msg('Какъв тип жилище търсиш?')}
    <div class="card-inputs">
      <div class="choice-group">
        ${Object.entries(types).map(([key, val]) =>
          choiceBtn(key, val.label_bg, state.propertyType === key)
        ).join('')}
      </div>
    </div>
  `;
}

// --- Card 9: Location ---
function cardLocation() {
  return `
    ${msg(`Последен въпрос! Как си представяш живота си в Пърт?<br><br><span class="msg-note">${DATA.housing.city_premium_note_bg}</span>`)}
    <div class="card-inputs">
      <div class="choice-group">
        ${choiceBtn('suburbs', 'Предградия (по-достъпно)',          state.location === 'suburbs')}
        ${choiceBtn('city',    'Център / Крайбрежие (по-скъпо)',    state.location === 'city')}
      </div>
    </div>
  `;
}

// --- Card 10: Summary trigger ---
function cardSummaryTrigger() {
  return `
    ${msg('Готово! Събрах всичко необходимо. Готов ли си да видиш пълното резюме на разходите?')}
    <div class="card-inputs">
      <button class="primary-btn" id="show-summary">Покажи резюмето →</button>
    </div>
  `;
}

// ============================================================
// 5. EVENT BINDING
// ============================================================

function bindCardEvents(key, el) {
  const map = {
    exchange_rate:     bindExchangeRate,
    visa_type:         bindVisaType,
    household:         bindHousehold,
    partner_english:   bindPartnerEnglish,
    school_children:   bindSchoolChildren,
    skills_assessment: bindSkillsAssessment,
    transport:         bindTransport,
    property_type:     bindPropertyType,
    location:          bindLocation,
    summary_trigger:   bindSummaryTrigger
  };
  if (map[key]) map[key](el);
}

function bindExchangeRate(el) {
  const audBtn  = el.querySelector('#aud-only-btn');
  const input   = el.querySelector('#eur-input');
  const confirm = el.querySelector('#rate-confirm');

  audBtn.addEventListener('click', () => {
    state.eurPerAud = null;
    input.value = '';
    audBtn.classList.add('choice-btn--selected');
  });

  input.addEventListener('focus', () => {
    audBtn.classList.remove('choice-btn--selected');
  });

  confirm.addEventListener('click', () => {
    const val = parseFloat(input.value);
    if (input.value && (isNaN(val) || val < 0.1 || val > 2)) {
      showError(el, 'Моля въведи валиден курс — например 0.61');
      return;
    }
    state.eurPerAud = input.value ? val : null;
    goForward(getNextCard('exchange_rate'));
  });
}

function bindVisaType(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.visaKey = btn.dataset.value;
      goForward(getNextCard('visa_type'));
    });
  });
}

function bindHousehold(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value;
      state.householdType = val;
      if (val === 'solo') {
        state.adultCount = 1;
        state.childCount = 0;
        goForward(getNextCard('household'));
      } else if (val === 'couple') {
        state.adultCount = 2;
        state.childCount = 0;
        goForward(getNextCard('household'));
      } else {
        state.adultCount = 2;
        if (state.childCount < 1) state.childCount = 1;
        // re-render to show counter
        const cur = document.getElementById('card-current');
        cur.innerHTML = cardHousehold();
        bindHousehold(cur);
      }
    });
  });

  const minus   = el.querySelector('#child-minus');
  const plus    = el.querySelector('#child-plus');
  const confirm = el.querySelector('#household-confirm');
  const display = el.querySelector('#child-count');

  if (minus) minus.addEventListener('click', () => {
    if (state.childCount > 1) { state.childCount--; display.textContent = state.childCount; }
  });
  if (plus) plus.addEventListener('click', () => {
    if (state.childCount < 8) { state.childCount++; display.textContent = state.childCount; }
  });
  if (confirm) confirm.addEventListener('click', () => {
    goForward(getNextCard('household'));
  });
}

function bindPartnerEnglish(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.partnerEnglish = btn.dataset.value === 'yes';
      if (!state.partnerEnglish) {
        // Re-render to show info note, then auto-advance
        const cur = document.getElementById('card-current');
        cur.innerHTML = cardPartnerEnglish();
        bindPartnerEnglish(cur);
        setTimeout(() => goForward(getNextCard('partner_english')), 2000);
      } else {
        goForward(getNextCard('partner_english'));
      }
    });
  });
}

function bindSchoolChildren(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.schoolAgeChildren = btn.dataset.value === 'yes';
      goForward(getNextCard('school_children'));
    });
  });
}

function bindSkillsAssessment(el) {
  el.querySelector('#skills-next').addEventListener('click', () => {
    goForward(getNextCard('skills_assessment'));
  });
}

function bindTransport(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.transport = btn.dataset.value;
      goForward(getNextCard('transport'));
    });
  });
}

function bindPropertyType(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.propertyType = btn.dataset.value;
      goForward(getNextCard('property_type'));
    });
  });
}

function bindLocation(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.location = btn.dataset.value;
      goForward(getNextCard('location'));
    });
  });
}

function bindSummaryTrigger(el) {
  el.querySelector('#show-summary').addEventListener('click', showSummary);
}

// ============================================================
// 6. CALCULATIONS
// ============================================================

function calcPredeparture() {
  const visa  = DATA.visa.options.find(o => o.key === state.visaKey);
  const lines = [];
  let total   = 0;

  // Primary applicant
  lines.push({ label_bg: 'Визова такса (основен кандидат)', amount: visa.fees.primary, source_key: 'visa_fees' });
  total += visa.fees.primary;

  // Partner
  if (state.householdType === 'couple' || state.householdType === 'family') {
    const partnerFee = (state.visaKey === 'pr_189' || state.visaKey === 'pr_190')
      ? visa.fees.extra_adult
      : visa.fees.primary; // 482: partner pays primary rate
    lines.push({ label_bg: 'Визова такса (партньор)', amount: partnerFee, source_key: 'visa_fees' });
    total += partnerFee;
  }

  // Children
  if (state.householdType === 'family' && state.childCount > 0) {
    const childTotal = visa.fees.child * state.childCount;
    const childWord  = state.childCount === 1 ? 'дете' : 'деца';
    lines.push({ label_bg: `Визова такса (${state.childCount} ${childWord})`, amount: childTotal, source_key: 'visa_fees' });
    total += childTotal;
  }

  // Second instalment (PR + partner + no English)
  if ((state.visaKey === 'pr_189' || state.visaKey === 'pr_190') &&
      (state.householdType === 'couple' || state.householdType === 'family') &&
      state.partnerEnglish === false) {
    const si = DATA.visa.second_instalment;
    lines.push({ label_bg: 'Втора вноска (английски език)', amount: si.amount, note_bg: si.note_bg, source_key: 'visa_fees' });
    total += si.amount;
  }

  // English test (PR only)
  if (state.visaKey === 'pr_189' || state.visaKey === 'pr_190') {
    const et = DATA.predeparture.english_test;
    lines.push({ label_bg: 'Езиков изпит (IELTS / PTE)', amount: et.amount, note_bg: et.note_bg, source_key: 'visa_fees' });
    total += et.amount;
  }

  // Skills assessment — info only, excluded from total
  if (state.visaKey === 'pr_189' || state.visaKey === 'pr_190') {
    const sa = DATA.predeparture.skills_assessment;
    lines.push({ label_bg: 'Оценка на уменията', amount: null, range_min: sa.range_min, range_max: sa.range_max, note_bg: sa.note_bg, source_key: sa.source_key, excluded: true });
  }

  // WA nomination — info only, excluded from total
  if (state.visaKey === 'pr_190') {
    const v = DATA.visa.options.find(o => o.key === 'pr_190');
    lines.push({ label_bg: 'Номинация от Западна Австралия', amount: null, note_bg: v.nomination_note_bg, source_key: 'wa_nomination', excluded: true });
  }

  return { total, lines };
}

function calcArrival() {
  const lines = [];
  let total   = 0;
  const n     = getFamilySize();

  // Flights (midpoint of range shown, range displayed)
  const fMin = DATA.arrival.flights.per_person_min * n;
  const fMax = DATA.arrival.flights.per_person_max * n;
  const fMid = Math.round((fMin + fMax) / 2);
  const personWord = n === 1 ? 'човек' : 'души';
  lines.push({ label_bg: `Самолетни билети (${n} ${personWord})`, amount: fMid, range_min: fMin, range_max: fMax, note_bg: DATA.arrival.flights.note_bg });
  total += fMid;

  // Temp accommodation
  const tier     = DATA.arrival.temp_accommodation.tiers.find(t => n <= t.max_persons);
  const weeks    = DATA.arrival.temp_accommodation.default_weeks;
  const tempCost = tier.weekly * weeks;
  lines.push({ label_bg: `Временно настаняване (${weeks} седмици)`, amount: tempCost, note_bg: DATA.arrival.temp_accommodation.note_bg });
  total += tempCost;

  // Bond + advance
  const wkRent  = getWeeklyRent();
  const bond    = wkRent * DATA.housing.bond_weeks;
  const advance = wkRent * DATA.housing.advance_weeks;
  lines.push({ label_bg: `Депозит (${DATA.housing.bond_weeks} седмици наем)`, amount: bond, source_key: 'reiwa' });
  lines.push({ label_bg: `Авансов наем (${DATA.housing.advance_weeks} седмици)`, amount: advance, source_key: 'reiwa' });
  total += bond + advance;

  // Vehicle
  if (state.transport === 'car') {
    const v     = DATA.arrival.vehicle;
    const duty  = calcStampDuty(v.default_cost);
    lines.push({ label_bg: 'Автомобил (ориентировъчна цена)',  amount: v.default_cost, note_bg: v.note_bg_duty });
    lines.push({ label_bg: 'Гербова такса (stamp duty)',        amount: duty, note_bg: v.note_bg_duty, source_key: 'revenue_wa_duty' });
    lines.push({ label_bg: 'Шофьорска книжка + изпити',        amount: v.licence_and_tests, note_bg: v.note_bg_licence, source_key: 'dot_licence' });
    total += v.default_cost + duty + v.licence_and_tests;
  }

  // School registration one-off (482 + school age)
  if (state.visaKey === 'visa_482' && state.schoolAgeChildren) {
    const reg = DATA.monthly.school.registration_one_off;
    lines.push({ label_bg: 'Еднократна регистрация в училище', amount: reg, note_bg: DATA.monthly.school.note_bg });
    total += reg;
  }

  return { total, lines };
}

function calcMonthly() {
  const lines = [];
  let total   = 0;
  const n     = getFamilySize();

  // Rent
  const monthly = Math.round(getWeeklyRent() * 4.33);
  lines.push({ label_bg: 'Наем', amount: monthly, source_key: 'reiwa' });
  total += monthly;

  // Groceries
  const groceries = calcGroceries(n);
  lines.push({ label_bg: 'Хранителни стоки', amount: groceries, note_bg: DATA.monthly.groceries.note_bg });
  total += groceries;

  // Utilities
  const utils = DATA.monthly.utilities.base + Math.max(0, n - 1) * DATA.monthly.utilities.per_extra_person;
  lines.push({ label_bg: 'Комунални услуги (ток, вода, интернет)', amount: utils, note_bg: DATA.monthly.utilities.note_bg });
  total += utils;

  // Transport
  const t = DATA.monthly.transport;
  if (state.transport === 'car') {
    lines.push({ label_bg: 'Разходи за кола (гориво, застраховка)', amount: t.car_running_monthly, note_bg: t.note_bg_car });
    total += t.car_running_monthly;
  } else {
    const adults      = state.householdType === 'solo' ? 1 : 2;
    const transperth  = t.transperth_adult_monthly * adults;
    const cardWord    = adults === 1 ? 'карта' : 'карти';
    lines.push({ label_bg: `Transperth (${adults} ${cardWord})`, amount: transperth, note_bg: t.note_bg_transperth });
    total += transperth;
  }

  // OVHC (482 only)
  if (state.visaKey === 'visa_482') {
    const ovhc   = DATA.monthly.ovhc;
    const amount = state.householdType === 'solo' ? ovhc.single_monthly : ovhc.family_monthly;
    lines.push({ label_bg: 'OVHC здравна застраховка', amount, note_bg: ovhc.note_bg, source_key: 'ovhc' });
    total += amount;
  }

  // School fees (482 + school age) — guard-rail: per family, not per child
  if (state.visaKey === 'visa_482' && state.schoolAgeChildren) {
    const s      = DATA.monthly.school;
    const fee    = s.first_child_monthly + Math.max(0, state.childCount - 1) * s.subsequent_child_monthly;
    lines.push({ label_bg: 'Такса обучение (държавно училище)', amount: fee, note_bg: s.note_bg });
    total += fee;
  }

  return { total, lines };
}

// ============================================================
// 7. CALC HELPERS
// ============================================================

function getFamilySize() {
  if (state.householdType === 'solo')   return 1;
  if (state.householdType === 'couple') return 2;
  return 2 + state.childCount;
}

function getWeeklyRent() {
  const h = DATA.housing.types[state.propertyType];
  return state.location === 'city' ? h.weekly_city : h.weekly_suburbs;
}

function calcGroceries(size) {
  const idx   = Math.min(size, 5) - 1;
  const ratio = DATA.monthly.groceries.ratios[idx];
  return Math.round(DATA.monthly.groceries.anchor_family_3 * ratio);
}

function calcStampDuty(price) {
  if (price <= 25000) return Math.round(price * 0.0275);
  if (price <= 50000) return Math.round(688 + ((price - 25000) / 25000) * (3250 - 688));
  return Math.round(price * 0.065);
}

function fmtAUD(n) {
  return '$' + Math.round(n).toLocaleString('en-AU') + ' AUD';
}

function fmtDual(n) {
  if (n === null || n === undefined) return '—';
  if (!state.eurPerAud) return fmtAUD(n);
  const eur = Math.round(n * state.eurPerAud);
  return `${fmtAUD(n)} <span class="eur">(≈ €${eur.toLocaleString('de-DE')})</span>`;
}

function showError(el, msg) {
  let err = el.querySelector('.field-error');
  if (!err) {
    err = document.createElement('p');
    err.className = 'field-error';
    el.querySelector('.card-inputs').appendChild(err);
  }
  err.textContent = msg;
}

// ============================================================
// 8. SUMMARY SCREEN
// ============================================================

function showSummary() {
  const predep   = calcPredeparture();
  const arrival  = calcArrival();
  const monthly  = calcMonthly();

  document.getElementById('wizard-container').classList.add('hidden');
  const screen   = document.getElementById('summary-screen');
  screen.classList.remove('hidden');
  screen.innerHTML = buildSummaryHTML(predep, arrival, monthly);
  document.getElementById('restart-btn').addEventListener('click', resetApp);
}

function buildSummaryHTML(predep, arrival, monthly) {
  return `
    <div class="summary-header">
      <h1 class="summary-title">Твоето резюме</h1>
      <p class="summary-sub">Всички суми са ориентировъчни и служат за планиране.</p>
    </div>
    <div class="phases">
      ${buildPhaseBlock('📋 Преди заминаване', predep)}
      ${buildPhaseBlock('✈️ При пристигане', arrival)}
      ${buildPhaseBlock('📅 Месечни разходи', monthly)}
    </div>
    <div class="summary-footer">
      <p class="disclaimer">Всички суми са ориентировъчни. Препоръчваме буфер от 20–30% над изчисленото.</p>
      <button class="restart-btn" id="restart-btn">← Започни отначало</button>
    </div>
  `;
}

function buildPhaseBlock(title, calc) {
  const lineHTML = calc.lines.map(line => {
    const sourceLink = line.source_key
      ? `<a href="${DATA.meta.source_links[line.source_key]}" target="_blank" class="source-link">→ Провери</a>`
      : '';

    if (line.excluded) {
      const rangeStr = (line.range_min !== undefined)
        ? `$${line.range_min.toLocaleString()} – $${line.range_max.toLocaleString()} AUD`
        : 'виж бележка';
      return `
        <div class="line line--info">
          <span class="line-label">${line.label_bg}</span>
          <span class="line-amount line-amount--range">${rangeStr}</span>
          ${line.note_bg ? `<p class="line-note">${line.note_bg} ${sourceLink}</p>` : ''}
        </div>`;
    }

    const rangeTag = (line.range_min !== undefined)
      ? `<span class="line-range">диапазон: $${line.range_min.toLocaleString()} – $${line.range_max.toLocaleString()} AUD</span>`
      : '';

    return `
      <div class="line">
        <span class="line-label">${line.label_bg}</span>
        <span class="line-amount">${fmtDual(line.amount)} ${rangeTag}</span>
        ${line.note_bg ? `<p class="line-note">${line.note_bg} ${sourceLink}</p>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="phase">
      <div class="phase-head">
        <h2 class="phase-title">${title}</h2>
        <span class="phase-total">${fmtDual(calc.total)}</span>
      </div>
      <div class="phase-lines">${lineHTML}</div>
    </div>`;
}

// ============================================================
// 9. INIT + RESET
// ============================================================

function resetApp() {
  Object.assign(state, {
    visaKey: null, householdType: null, adultCount: 1, childCount: 0,
    partnerEnglish: null, schoolAgeChildren: null,
    transport: null, propertyType: null, location: null, eurPerAud: null
  });
  cardHistory    = [];
  currentCardKey = null;
  document.getElementById('summary-screen').classList.add('hidden');
  document.getElementById('wizard-container').classList.remove('hidden');
  startWizard();
}

function startWizard() {
  currentCardKey = 'exchange_rate';
  cardHistory    = [];
  const cur      = document.getElementById('card-current');
  cur.innerHTML  = renderCard('exchange_rate');
  bindCardEvents('exchange_rate', cur);
  updateProgress();
}

async function init() {
  try {
    const res = await fetch('data.json');
    DATA = await res.json();
    startWizard();
  } catch (e) {
    document.getElementById('card-current').innerHTML =
      '<p class="load-error">Грешка при зареждане. Моля, презареди страницата.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('back-btn').addEventListener('click', goBack);
  init();
});
