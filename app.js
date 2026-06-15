'use strict';

// ============================================================
// 1. DATA
// ============================================================
let DATA = null;

// ============================================================
// 2. STATE
// ============================================================
const state = {
  visaKey:              null,
  householdType:        null,
  adultCount:           1,
  childCount:           0,   // derived: kindyCount + schoolCount
  kindyCount:           0,   // children 0-4 yrs
  schoolCount:          0,   // children 5-18 yrs
  partnerEnglish:       null,
  skillsAssessmentCost: null,   // null = use range; number = user input
  flightsCost:          null,   // null = use range; number = user input
  vehicleCost:          null,   // null = use default $14k; number = user input
  transport:            null,
  stayingWithFamily:    null,
  propertyType:         null,
  location:             null,
  eurPerAud:            null
};

// ============================================================
// 3. ANALYTICS
// ============================================================
function track(path) {
  try {
    if (window.goatcounter && typeof window.goatcounter.count === 'function') {
      window.goatcounter.count({ path: 'wizard/' + path, event: true });
    }
  } catch (e) { /* silent */ }
}

// ============================================================
// 4. WIZARD ENGINE
// ============================================================
const ALL_CARDS = [
  'exchange_rate',
  'disclaimer',
  'visa_type',
  'household',
  'partner_english',     // conditional: PR + couple or family
  'skills_assessment',   // conditional: PR only
  'flights_input',
  'transport',
  'staying_with_family',
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
    if (key === 'skills_assessment') {
      return state.visaKey === 'pr_189' || state.visaKey === 'pr_190';
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

  const viewport = document.getElementById('card-viewport');
  const oldCard  = document.getElementById('card-current');
  const newCard  = document.createElement('div');

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
      oldCard.style.transition = `transform ${ANIM_MS}ms cubic-bezier(0.4,0,0.2,1)`;
      newCard.style.transition = `transform ${ANIM_MS}ms cubic-bezier(0.4,0,0.2,1)`;
      oldCard.style.transform  = `translateX(${exitTo})`;
      newCard.style.transform  = 'translateX(0)';

      setTimeout(() => {
        oldCard.remove();
        newCard.id               = 'card-current';
        newCard.style.transition = '';
        newCard.style.transform  = '';
        currentCardKey           = targetKey;
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
  navigate(cardHistory.pop(), 'back');
}

function updateProgress() {
  const fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = (getCurrentProgress() * 100) + '%';
  const back = document.getElementById('back-btn');
  if (back) back.style.visibility = cardHistory.length > 0 ? 'visible' : 'hidden';
}

// ============================================================
// 5. CARD RENDERERS
// ============================================================
function renderCard(key) {
  const map = {
    exchange_rate:      cardExchangeRate,
    disclaimer:         cardDisclaimer,
    visa_type:          cardVisaType,
    household:          cardHousehold,
    partner_english:    cardPartnerEnglish,
    skills_assessment:  cardSkillsAssessment,
    flights_input:      cardFlightsInput,
    transport:          cardTransport,
    staying_with_family:cardStayingWithFamily,
    property_type:      cardPropertyType,
    location:           cardLocation,
    summary_trigger:    cardSummaryTrigger
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
  const anchor  = DATA.meta.currency_anchor_eur_per_aud;
  const hasEur  = state.eurPerAud !== null;
  return `
    ${msg(`Здравей! Аз ще те преведа стъпка по стъпка през всичко, което трябва да знаеш за разходите при преместване в Пърт.<br><br>Всички суми са в австралийски долари (AUD). Искаш ли да виждаш и приблизителните стойности в евро?<br><br><span class="msg-note">Насочващ курс: 1 AUD = ${anchor} EUR (средата на 2026)</span>`)}\
    <div class="card-inputs">
      <div class="choice-group--inline">
        ${choiceBtn('aud', 'Само AUD', !hasEur)}
        ${choiceBtn('eur', 'AUD + EUR', hasEur)}
      </div>
      <div id="eur-row" class="input-row${hasEur ? '' : ' hidden'}">
        <div class="amount-row">
          <span class="amount-label">1 AUD =</span>
          <input type="number" id="eur-input" class="amount-input"
            placeholder="${anchor}" value="${hasEur ? state.eurPerAud : ''}"
            min="0.1" max="2" step="0.01">
          <span class="amount-label">EUR</span>
        </div>
      </div>
      <button class="primary-btn" id="rate-confirm">Продължи →</button>
    </div>
  `;
}

// --- Card 2: Disclaimer ---
function cardDisclaimer() {
  const d = DATA.disclaimer;
  return `
    ${msg(`Преди да продължим — две важни неща.<br><br>${d.paragraphs_bg[0]}<br><br>${d.paragraphs_bg[1]}<br><br>${d.paragraphs_bg[2]}`)}\
    <div class="card-inputs">
      <button class="primary-btn" id="disclaimer-confirm">${d.confirm_bg}</button>
    </div>
  `;
}

// --- Card 3: Visa type ---
function cardVisaType() {
  return `
    ${msg('Добре. Кажи ми — по какъв път отиваш в Австралия?')}\
    <div class="card-inputs">
      <div class="choice-group">
        ${DATA.visa.options.map(o => choiceBtn(o.key, o.label_bg, state.visaKey === o.key)).join('')}
      </div>
    </div>
  `;
}

// --- Card 4: Household ---
// Two age-split child counters shown when householdType === 'family'
function cardHousehold() {
  const isFamily = state.householdType === 'family';
  return `
    ${msg('Само ти ли заминаваш, или пътувате заедно с някой?')}\
    <div class="card-inputs">
      <div class="choice-group">
        ${choiceBtn('solo',   'Само аз',            state.householdType === 'solo')}
        ${choiceBtn('couple', 'Аз и партньорът ми', state.householdType === 'couple')}
        ${choiceBtn('family', 'Семейство с деца',   state.householdType === 'family')}
      </div>
      ${isFamily ? `
        <div class="child-counters">
          <div class="child-counter">
            <div class="counter-label-wrap">
              <span class="counter-label">Малки деца</span>
              <span class="counter-age">0–4 г.</span>
            </div>
            <div class="counter-controls">
              <button class="counter-btn" id="kindy-minus">−</button>
              <span class="counter-value" id="kindy-count">${state.kindyCount}</span>
              <button class="counter-btn" id="kindy-plus">+</button>
            </div>
          </div>
          <div class="child-counter">
            <div class="counter-label-wrap">
              <span class="counter-label">Деца в училище</span>
              <span class="counter-age">5–18 г.</span>
            </div>
            <div class="counter-controls">
              <button class="counter-btn" id="school-minus">−</button>
              <span class="counter-value" id="school-count">${state.schoolCount}</span>
              <button class="counter-btn" id="school-plus">+</button>
            </div>
          </div>
        </div>
        <button class="primary-btn" id="household-confirm">Продължи →</button>
      ` : ''}
    </div>
  `;
}

// --- Card 5: Partner English (conditional) ---
function cardPartnerEnglish() {
  const si = DATA.visa.second_instalment;
  return `
    ${msg(`Важен въпрос за партньорът ти: има ли валиден резултат от езиков изпит (IELTS или PTE)?<br><br>Ако не — правителството изисква задължителна втора вноска от <strong>$${si.amount.toLocaleString()} AUD</strong> към визата.`)}\
    <div class="card-inputs">
      <div class="choice-group--inline">
        ${choiceBtn('yes', 'Да, има / ще се яви', state.partnerEnglish === true)}
        ${choiceBtn('no',  'Не / Не сме сигурни',  state.partnerEnglish === false)}
      </div>
      ${state.partnerEnglish === false
        ? `<div class="info-note">${si.note_bg}</div>
           <button class="primary-btn" id="partner-english-confirm">Продължи →</button>`
        : ''}
    </div>
  `;
}

// --- Card 6: Skills assessment (conditional: PR only) ---
function cardSkillsAssessment() {
  const sa    = DATA.predeparture.skills_assessment;
  const link  = DATA.meta.source_links[sa.source_key];
  const known = state.skillsAssessmentCost !== null;
  return `
    ${msg(`Преди да кандидатстваш за постоянно пребиваване ще ти трябва оценка на уменията от признат австралийски орган.<br><br>Цената варира: от <strong>$${sa.range_min}</strong> до <strong>$${sa.range_max} AUD</strong> — зависи от професията и оценяващия орган.<br><br><a href="${link}" target="_blank" class="source-link">→ Провери таксата за твоята специалност</a>`)}\
    <div class="card-inputs">
      <p class="input-label">${sa.input_prompt_bg}</p>
      <div class="choice-group--inline">
        ${choiceBtn('range',  'Не — използвай диапазона', !known)}
        ${choiceBtn('custom', 'Да — въведи сумата',        known)}
      </div>
      <div id="skills-input-row" class="input-row${known ? '' : ' hidden'}">
        <input type="number" id="skills-cost-input" class="amount-input"
          placeholder="${sa.input_placeholder_bg}"
          value="${known ? state.skillsAssessmentCost : ''}">
        <span class="amount-suffix">AUD</span>
      </div>
      <button class="primary-btn" id="skills-confirm">Продължи →</button>
    </div>
  `;
}

// --- Card 7: Flights input ---
function cardFlightsInput() {
  const f    = DATA.arrival.flights;
  const n    = getFamilySize();
  const fMin = f.per_person_min * n;
  const fMax = f.per_person_max * n;
  const pWord = n === 1 ? 'човек' : 'души';
  const known = state.flightsCost !== null;
  return `
    ${msg(`Самолетните билети. За ${n} ${pWord} от София до Пърт, ориентировъчно е между <strong>$${fMin.toLocaleString()}</strong> и <strong>$${fMax.toLocaleString()} AUD</strong>.<br><br>${f.note_bg}`)}\
    <div class="card-inputs">
      <p class="input-label">${f.input_prompt_bg}</p>
      <div class="choice-group--inline">
        ${choiceBtn('range',  'Не — използвай диапазона', !known)}
        ${choiceBtn('custom', 'Да — въведи сумата',        known)}
      </div>
      <div id="flights-input-row" class="input-row${known ? '' : ' hidden'}">
        <input type="number" id="flights-cost-input" class="amount-input"
          placeholder="${f.input_placeholder_bg}"
          value="${known ? state.flightsCost : ''}">
        <span class="amount-suffix">AUD</span>
      </div>
      <button class="primary-btn" id="flights-confirm">Продължи →</button>
    </div>
  `;
}

// --- Card 8: Transport (+ vehicle cost if car) ---
function cardTransport() {
  const t     = DATA.monthly.transport;
  const v     = DATA.arrival.vehicle;
  const isCar = state.transport === 'car';
  const known = state.vehicleCost !== null;
  return `
    ${msg('Пърт е голям и разпръснат град. Общественият транспорт покрива добре центъра, но не стига до всички квартали.<br><br>Планираш ли да купиш кола, или ще разчиташ на автобуси и влакове?')}\
    <div class="card-inputs">
      <div class="choice-group--inline">
        ${choiceBtn('car',        'Купувам кола', state.transport === 'car')}
        ${choiceBtn('transperth', 'Обществен транспорт', state.transport === 'transperth')}
      </div>
      ${isCar ? `
        <p class="input-label">${v.input_prompt_bg}</p>
        <div class="choice-group--inline">
          ${choiceBtn('default', `Не — използвай $${v.default_cost.toLocaleString()}`, !known)}
          ${choiceBtn('custom',  'Да — въведи бюджета',                                  known)}
        </div>
        <div id="vehicle-input-row" class="input-row${known ? '' : ' hidden'}">
          <input type="number" id="vehicle-cost-input" class="amount-input"
            placeholder="${v.input_placeholder_bg}"
            value="${known ? state.vehicleCost : ''}">
          <span class="amount-suffix">AUD</span>
        </div>
        <div class="info-note">${v.default_cost_note_bg}</div>
        <button class="primary-btn" id="transport-confirm">Продължи →</button>
      ` : ''}
    </div>
  `;
}

// --- Card 9: Staying with family ---
function cardStayingWithFamily() {
  return `
    ${msg('Как планираш първите седмици в Пърт след пристигането?')}\
    <div class="card-inputs">
      <div class="choice-group--inline">
        ${choiceBtn('temp',   'Наемам временно жилище',      state.stayingWithFamily === false)}
        ${choiceBtn('family', 'При приятели или семейство',  state.stayingWithFamily === true)}
      </div>
      ${state.stayingWithFamily === true
        ? `<div class="info-note">Страхотно — ще махнем разходите за временно жилище. Депозитът и авансовият наем за постоянния ти дом са все още включени в резюмето.</div>
           <button class="primary-btn" id="staying-confirm">Продължи →</button>`
        : ''}
    </div>
  `;
}

// --- Card 10: Property type ---
function cardPropertyType() {
  return `
    ${msg('Какъв тип жилище търсиш?')}\
    <div class="card-inputs">
      <div class="choice-group">
        ${Object.entries(DATA.housing.types).map(([key, val]) =>
          choiceBtn(key, val.label_bg, state.propertyType === key)
        ).join('')}
      </div>
    </div>
  `;
}

// --- Card 11: Location ---
function cardLocation() {
  return `
    ${msg(`Последен въпрос! Как си представяш живота в Пърт?<br><br><span class="msg-note">${DATA.housing.city_premium_note_bg}</span>`)}\
    <div class="card-inputs">
      <div class="choice-group--inline">
        ${choiceBtn('suburbs', 'Предградия',              state.location === 'suburbs')}
        ${choiceBtn('city',    'Център / Крайбрежие',     state.location === 'city')}
      </div>
    </div>
  `;
}

// --- Card 12: Summary trigger ---
function cardSummaryTrigger() {
  return `
    ${msg('Перфектно — имам всичко, което ми трябва. Готов ли си да видиш пълното резюме на разходите?')}\
    <div class="card-inputs">
      <button class="primary-btn" id="show-summary">Покажи резюмето →</button>
    </div>
  `;
}

// ============================================================
// 6. EVENT BINDING
// ============================================================
function bindCardEvents(key, el) {
  const map = {
    exchange_rate:      bindExchangeRate,
    disclaimer:         bindDisclaimer,
    visa_type:          bindVisaType,
    household:          bindHousehold,
    partner_english:    bindPartnerEnglish,
    skills_assessment:  bindSkillsAssessment,
    flights_input:      bindFlightsInput,
    transport:          bindTransport,
    staying_with_family:bindStayingWithFamily,
    property_type:      bindPropertyType,
    location:           bindLocation,
    summary_trigger:    bindSummaryTrigger
  };
  if (map[key]) map[key](el);
}

function bindExchangeRate(el) {
  const audBtn  = el.querySelector('[data-value="aud"]');
  const eurBtn  = el.querySelector('[data-value="eur"]');
  const eurRow  = el.querySelector('#eur-row');
  const input   = el.querySelector('#eur-input');
  const confirm = el.querySelector('#rate-confirm');

  audBtn.addEventListener('click', () => {
    state.eurPerAud = null;
    audBtn.classList.add('choice-btn--selected');
    eurBtn.classList.remove('choice-btn--selected');
    eurRow.classList.add('hidden');
  });

  eurBtn.addEventListener('click', () => {
    eurBtn.classList.add('choice-btn--selected');
    audBtn.classList.remove('choice-btn--selected');
    eurRow.classList.remove('hidden');
    input.focus();
  });

  confirm.addEventListener('click', () => {
    if (!eurRow.classList.contains('hidden')) {
      const val = parseFloat(input.value);
      if (isNaN(val) || val < 0.1 || val > 2) {
        showError(el, 'Моля въведи валиден курс — например 0.61');
        return;
      }
      state.eurPerAud = val;
      track('exchange_rate/eur_' + val);
    } else {
      state.eurPerAud = null;
      track('exchange_rate/aud_only');
    }
    goForward(getNextCard('exchange_rate'));
  });
}

function bindDisclaimer(el) {
  el.querySelector('#disclaimer-confirm').addEventListener('click', () => {
    track('disclaimer/accepted');
    goForward(getNextCard('disclaimer'));
  });
}

function bindVisaType(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.visaKey = btn.dataset.value;
      track('visa_type/' + state.visaKey);
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
        state.kindyCount = 0; state.schoolCount = 0; state.childCount = 0;
        track('household/solo');
        goForward(getNextCard('household'));
      } else if (val === 'couple') {
        state.adultCount = 2;
        state.kindyCount = 0; state.schoolCount = 0; state.childCount = 0;
        track('household/couple');
        goForward(getNextCard('household'));
      } else {
        // family — show counters; ensure at least one child as default
        state.adultCount = 2;
        if (state.kindyCount + state.schoolCount < 1) state.schoolCount = 1;
        const cur = document.getElementById('card-current');
        cur.innerHTML = cardHousehold();
        bindHousehold(cur);
      }
    });
  });

  // Kindy counter
  const kindyMinus   = el.querySelector('#kindy-minus');
  const kindyPlus    = el.querySelector('#kindy-plus');
  const kindyDisplay = el.querySelector('#kindy-count');

  if (kindyMinus) kindyMinus.addEventListener('click', () => {
    if (state.kindyCount > 0) { state.kindyCount--; kindyDisplay.textContent = state.kindyCount; }
  });
  if (kindyPlus) kindyPlus.addEventListener('click', () => {
    if (state.kindyCount < 8) { state.kindyCount++; kindyDisplay.textContent = state.kindyCount; }
  });

  // School counter
  const schoolMinus   = el.querySelector('#school-minus');
  const schoolPlus    = el.querySelector('#school-plus');
  const schoolDisplay = el.querySelector('#school-count');

  if (schoolMinus) schoolMinus.addEventListener('click', () => {
    if (state.schoolCount > 0) { state.schoolCount--; schoolDisplay.textContent = state.schoolCount; }
  });
  if (schoolPlus) schoolPlus.addEventListener('click', () => {
    if (state.schoolCount < 8) { state.schoolCount++; schoolDisplay.textContent = state.schoolCount; }
  });

  const confirm = el.querySelector('#household-confirm');
  if (confirm) confirm.addEventListener('click', () => {
    const total = state.kindyCount + state.schoolCount;
    if (total < 1) { showError(el, 'Добави поне едно дете.'); return; }
    state.childCount = total;
    track('household/family_kindy_' + state.kindyCount + '_school_' + state.schoolCount);
    goForward(getNextCard('household'));
  });
}

function bindPartnerEnglish(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.partnerEnglish = btn.dataset.value === 'yes';
      track('partner_english/' + btn.dataset.value);
      if (!state.partnerEnglish) {
        const cur = document.getElementById('card-current');
        cur.innerHTML = cardPartnerEnglish();
        bindPartnerEnglish(cur);
      } else {
        goForward(getNextCard('partner_english'));
      }
    });
  });
  const confirm = el.querySelector('#partner-english-confirm');
  if (confirm) confirm.addEventListener('click', () => {
    goForward(getNextCard('partner_english'));
  });
}

function bindSkillsAssessment(el) {
  const rangeBtn  = el.querySelector('[data-value="range"]');
  const customBtn = el.querySelector('[data-value="custom"]');
  const inputRow  = el.querySelector('#skills-input-row');
  const input     = el.querySelector('#skills-cost-input');
  const confirm   = el.querySelector('#skills-confirm');

  rangeBtn.addEventListener('click', () => {
    state.skillsAssessmentCost = null;
    rangeBtn.classList.add('choice-btn--selected');
    customBtn.classList.remove('choice-btn--selected');
    inputRow.classList.add('hidden');
  });

  customBtn.addEventListener('click', () => {
    customBtn.classList.add('choice-btn--selected');
    rangeBtn.classList.remove('choice-btn--selected');
    inputRow.classList.remove('hidden');
    input.focus();
  });

  confirm.addEventListener('click', () => {
    if (!inputRow.classList.contains('hidden')) {
      const val = parseFloat(input.value);
      if (isNaN(val) || val < 100) { showError(el, 'Моля въведи валидна сума'); return; }
      state.skillsAssessmentCost = val;
      track('skills_assessment/custom_' + Math.round(val));
    } else {
      state.skillsAssessmentCost = null;
      track('skills_assessment/range');
    }
    goForward(getNextCard('skills_assessment'));
  });
}

function bindFlightsInput(el) {
  const rangeBtn  = el.querySelector('[data-value="range"]');
  const customBtn = el.querySelector('[data-value="custom"]');
  const inputRow  = el.querySelector('#flights-input-row');
  const input     = el.querySelector('#flights-cost-input');
  const confirm   = el.querySelector('#flights-confirm');

  rangeBtn.addEventListener('click', () => {
    state.flightsCost = null;
    rangeBtn.classList.add('choice-btn--selected');
    customBtn.classList.remove('choice-btn--selected');
    inputRow.classList.add('hidden');
  });

  customBtn.addEventListener('click', () => {
    customBtn.classList.add('choice-btn--selected');
    rangeBtn.classList.remove('choice-btn--selected');
    inputRow.classList.remove('hidden');
    input.focus();
  });

  confirm.addEventListener('click', () => {
    if (!inputRow.classList.contains('hidden')) {
      const val = parseFloat(input.value);
      if (isNaN(val) || val < 100) { showError(el, 'Моля въведи валидна сума'); return; }
      state.flightsCost = val;
      track('flights/custom');
    } else {
      state.flightsCost = null;
      track('flights/range');
    }
    goForward(getNextCard('flights_input'));
  });
}

function bindTransport(el) {
  el.querySelectorAll('.choice-group--inline .choice-btn').forEach(btn => {
    if (btn.dataset.value === 'car' || btn.dataset.value === 'transperth') {
      btn.addEventListener('click', () => {
        const val = btn.dataset.value;
        if (val === 'transperth') {
          state.transport = 'transperth';
          state.vehicleCost = null;
          track('transport/transperth');
          goForward(getNextCard('transport'));
        } else {
          state.transport = 'car';
          track('transport/car');
          const cur = document.getElementById('card-current');
          cur.innerHTML = cardTransport();
          bindTransport(cur);
        }
      });
    }
    if (btn.dataset.value === 'default') {
      btn.addEventListener('click', () => {
        state.vehicleCost = null;
        btn.classList.add('choice-btn--selected');
        const customBtn = el.querySelector('[data-value="custom"]');
        if (customBtn) customBtn.classList.remove('choice-btn--selected');
        const row = el.querySelector('#vehicle-input-row');
        if (row) row.classList.add('hidden');
      });
    }
    if (btn.dataset.value === 'custom') {
      btn.addEventListener('click', () => {
        btn.classList.add('choice-btn--selected');
        const defBtn = el.querySelector('[data-value="default"]');
        if (defBtn) defBtn.classList.remove('choice-btn--selected');
        const row = el.querySelector('#vehicle-input-row');
        if (row) { row.classList.remove('hidden'); row.querySelector('input').focus(); }
      });
    }
  });

  const confirm = el.querySelector('#transport-confirm');
  if (confirm) {
    confirm.addEventListener('click', () => {
      const row   = el.querySelector('#vehicle-input-row');
      const input = el.querySelector('#vehicle-cost-input');
      if (row && !row.classList.contains('hidden') && input) {
        const val = parseFloat(input.value);
        if (isNaN(val) || val < 1000) { showError(el, 'Моля въведи валидна сума'); return; }
        state.vehicleCost = val;
        track('vehicle/custom_' + Math.round(val));
      } else {
        state.vehicleCost = null;
        track('vehicle/default');
      }
      goForward(getNextCard('transport'));
    });
  }
}

function bindStayingWithFamily(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value;
      if (val === 'temp') {
        state.stayingWithFamily = false;
        track('staying/temp_housing');
        goForward(getNextCard('staying_with_family'));
      } else {
        state.stayingWithFamily = true;
        track('staying/family_friends');
        const cur = document.getElementById('card-current');
        cur.innerHTML = cardStayingWithFamily();
        bindStayingWithFamily(cur);
      }
    });
  });
  const confirm = el.querySelector('#staying-confirm');
  if (confirm) confirm.addEventListener('click', () => goForward(getNextCard('staying_with_family')));
}

function bindPropertyType(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.propertyType = btn.dataset.value;
      track('property_type/' + state.propertyType);
      goForward(getNextCard('property_type'));
    });
  });
}

function bindLocation(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.location = btn.dataset.value;
      track('location/' + state.location);
      goForward(getNextCard('location'));
    });
  });
}

function bindSummaryTrigger(el) {
  el.querySelector('#show-summary').addEventListener('click', () => {
    track('summary/viewed');
    showSummary();
  });
}

// ============================================================
// 7. CALCULATIONS (with low/high range support)
// ============================================================

function calcPredeparture() {
  const visa  = DATA.visa.options.find(o => o.key === state.visaKey);
  const lines = [];
  let lo = 0, hi = 0;

  function addFixed(label_bg, amount, opts = {}) {
    lines.push({ label_bg, amount_min: amount, amount_max: amount, ...opts });
    lo += amount; hi += amount;
  }
  function addRange(label_bg, min, max, opts = {}) {
    lines.push({ label_bg, amount_min: min, amount_max: max, ...opts });
    lo += min; hi += max;
  }
  function addInfo(label_bg, opts = {}) {
    lines.push({ label_bg, excluded: true, ...opts });
  }

  // Visa fees
  addFixed('Визова такса (основен кандидат)', visa.fees.primary, { source_key: 'visa_fees' });

  if (state.householdType === 'couple' || state.householdType === 'family') {
    const partnerFee = (state.visaKey === 'pr_189' || state.visaKey === 'pr_190')
      ? visa.fees.extra_adult
      : visa.fees.primary;
    addFixed('Визова такса (партньор)', partnerFee, { source_key: 'visa_fees' });
  }

  if (state.householdType === 'family' && state.childCount > 0) {
    const cWord = state.childCount === 1 ? 'дете' : 'деца';
    addFixed(`Визова такса (${state.childCount} ${cWord})`, visa.fees.child * state.childCount, { source_key: 'visa_fees' });
  }

  // Second instalment (PR + partner + no English)
  if ((state.visaKey === 'pr_189' || state.visaKey === 'pr_190') &&
      (state.householdType === 'couple' || state.householdType === 'family') &&
      state.partnerEnglish === false) {
    const si = DATA.visa.second_instalment;
    addFixed('Втора вноска (английски)', si.amount, { note_bg: si.note_bg, source_key: 'visa_fees' });
  }

  // English test (PR only)
  if (state.visaKey === 'pr_189' || state.visaKey === 'pr_190') {
    const et = DATA.predeparture.english_test;
    addFixed('Езиков изпит (IELTS / PTE)', et.amount, { note_bg: et.note_bg, source_key: 'visa_fees' });
  }

  // Skills assessment (PR only)
  if (state.visaKey === 'pr_189' || state.visaKey === 'pr_190') {
    const sa = DATA.predeparture.skills_assessment;
    if (state.skillsAssessmentCost !== null) {
      addFixed('Оценка на уменията', state.skillsAssessmentCost, { note_bg: sa.note_bg, source_key: 'skills_assessment' });
    } else {
      addRange('Оценка на уменията', sa.range_min, sa.range_max, { note_bg: sa.note_bg, source_key: 'skills_assessment' });
    }
  }

  // WA nomination — info only, not in total
  if (state.visaKey === 'pr_190') {
    addInfo('Номинация от Западна Австралия ($200)', {
      note_bg: visa.nomination_note_bg,
      source_key: 'wa_nomination'
    });
  }

  return { lo, hi, lines };
}

function calcArrival() {
  const lines = [];
  let lo = 0, hi = 0;
  const n = getFamilySize();

  function addFixed(label_bg, amount, opts = {}) {
    lines.push({ label_bg, amount_min: amount, amount_max: amount, ...opts });
    lo += amount; hi += amount;
  }
  function addRange(label_bg, min, max, opts = {}) {
    lines.push({ label_bg, amount_min: min, amount_max: max, ...opts });
    lo += min; hi += max;
  }

  // Flights
  const f = DATA.arrival.flights;
  if (state.flightsCost !== null) {
    addFixed(`Самолетни билети (въведена сума)`, state.flightsCost, { note_bg: f.note_bg });
  } else {
    const pWord = n === 1 ? 'човек' : 'души';
    addRange(`Самолетни билети (${n} ${pWord})`, f.per_person_min * n, f.per_person_max * n, { note_bg: f.note_bg });
  }

  // Temp accommodation
  if (!state.stayingWithFamily) {
    const tier  = DATA.arrival.temp_accommodation.tiers.find(t => n <= t.max_persons);
    const weeks = DATA.arrival.temp_accommodation.default_weeks;
    addFixed(`Временно жилище (${weeks} седмици)`, tier.weekly * weeks, { note_bg: DATA.arrival.temp_accommodation.note_bg });
  }

  // Bond + advance
  const wkRent = getWeeklyRent();
  addFixed(`Депозит (${DATA.housing.bond_weeks} седмици)`, wkRent * DATA.housing.bond_weeks, { source_key: 'reiwa' });
  addFixed(`Авансов наем (${DATA.housing.advance_weeks} седмици)`, wkRent * DATA.housing.advance_weeks, { source_key: 'reiwa' });

  // Vehicle
  if (state.transport === 'car') {
    const v    = DATA.arrival.vehicle;
    const cost = state.vehicleCost !== null ? state.vehicleCost : v.default_cost;
    const duty = calcStampDuty(cost);
    addFixed('Автомобил', cost, { note_bg: v.note_bg_duty });
    addFixed('Гербова такса (stamp duty)', duty, { source_key: 'revenue_wa_duty' });
    addFixed('Шофьорска книжка + изпити', v.licence_and_tests, { note_bg: v.note_bg_licence, source_key: 'dot_licence' });
  }

  // School registration one-off (482 + school-age children)
  // BUG-001 guard: uses schoolCount (5-18), not childCount
  if (state.visaKey === 'visa_482' && state.schoolCount > 0) {
    const s = DATA.monthly.school;
    addFixed('Еднократна регистрация в училище', s.registration_one_off, { note_bg: s.note_bg });
  }

  return { lo, hi, lines };
}

function calcMonthly() {
  const lines = [];
  let lo = 0, hi = 0;
  const n = getFamilySize();

  function addFixed(label_bg, amount, opts = {}) {
    lines.push({ label_bg, amount_min: amount, amount_max: amount, ...opts });
    lo += amount; hi += amount;
  }
  function addRange(label_bg, min, max, opts = {}) {
    lines.push({ label_bg, amount_min: min, amount_max: max, ...opts });
    lo += min; hi += max;
  }

  // Rent
  addFixed('Наем', Math.round(getWeeklyRent() * 4.33), { source_key: 'reiwa' });

  // Groceries
  addFixed('Хранителни стоки', calcGroceries(n), { note_bg: DATA.monthly.groceries.note_bg });

  // Utilities
  addFixed('Сметки (ток, вода, интернет)',
    DATA.monthly.utilities.base + Math.max(0, n - 1) * DATA.monthly.utilities.per_extra_person,
    { note_bg: DATA.monthly.utilities.note_bg });

  // Phone
  const adults = state.householdType === 'solo' ? 1 : 2;
  addFixed(`Телефонни планове (${adults} ${adults === 1 ? 'план' : 'плана'})`,
    DATA.monthly.phone.per_adult * adults,
    { note_bg: DATA.monthly.phone.note_bg });

  // Transport
  const t = DATA.monthly.transport;
  if (state.transport === 'car') {
    addFixed('Разходи за кола (гориво, застраховка)', t.car_running_monthly, { note_bg: t.note_bg_car });
  } else {
    const cardWord = adults === 1 ? 'карта' : 'карти';
    addFixed(`Transperth (${adults} ${cardWord})`, t.transperth_adult_monthly * adults,
      { note_bg: t.note_bg_transperth, source_key: 'transperth' });
  }

  // Dining out
  const d = DATA.monthly.dining;
  if (state.householdType === 'solo') {
    addRange('Хранене навън и кафе', d.solo_min, d.solo_max, { note_bg: d.note_bg });
  } else if (state.householdType === 'couple') {
    addRange('Хранене навън и кафе', d.couple_min, d.couple_max, { note_bg: d.note_bg });
  } else {
    addRange('Хранене навън и кафе', d.family_min, d.family_max, { note_bg: d.note_bg });
  }

  // Kids activities — all children (kindy + school)
  if (state.householdType === 'family' && state.childCount > 0) {
    const ka    = DATA.monthly.kids_activities;
    const cWord = state.childCount === 1 ? 'дете' : 'деца';
    addRange(`Занимания за деца (${state.childCount} ${cWord})`,
      ka.per_child_min * state.childCount,
      ka.per_child_max * state.childCount,
      { note_bg: ka.note_bg });
  }

  // Kindy childcare — only when kindyCount > 0
  if (state.kindyCount > 0) {
    const k     = DATA.monthly.kindy;
    const isPR  = state.visaKey === 'pr_189' || state.visaKey === 'pr_190';
    const kWord = state.kindyCount === 1 ? 'дете' : 'деца';
    if (isPR) {
      addRange(
        `Детска грижа (${state.kindyCount} ${kWord})`,
        k.perth_aud_net_pr_min * state.kindyCount,
        k.perth_aud_net_pr_max * state.kindyCount,
        { note_bg: k.note_bg_pr, source_key: 'ccs_calculator' }
      );
    } else {
      addFixed(
        `Детска грижа (${state.kindyCount} ${kWord})`,
        k.perth_aud_gross * state.kindyCount,
        { note_bg: k.note_bg_482 }
      );
    }
  }

  // OVHC (482 only)
  if (state.visaKey === 'visa_482') {
    const ovhc   = DATA.monthly.ovhc;
    const amount = state.householdType === 'solo' ? ovhc.single_monthly : ovhc.family_monthly;
    addFixed('OVHC здравна застраховка', amount, { note_bg: ovhc.note_bg, source_key: 'ovhc' });
  }

  // School (482 + school-age children)
  // BUG-001 guard-rail: fee is per family, not per child.
  // Uses schoolCount (5-18 yrs only), NOT childCount.
  if (state.visaKey === 'visa_482' && state.schoolCount > 0) {
    const s   = DATA.monthly.school;
    const fee = s.first_child_monthly + Math.max(0, state.schoolCount - 1) * s.subsequent_child_monthly;
    addFixed('Такса обучение (държавно училище)', fee, { note_bg: s.note_bg });
  }

  return { lo, hi, lines };
}

// ============================================================
// 8. CALC HELPERS
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

function calcGroceries(n) {
  const ratio = DATA.monthly.groceries.ratios[Math.min(n, 5) - 1];
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

function fmtEUR(n) {
  // Format with non-breaking space as thousands separator: €7 707
  const str = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return '€\u00A0' + str;
}

function fmtDual(n) {
  if (!state.eurPerAud) return fmtAUD(n);
  return `${fmtAUD(n)} <span class="eur">(≈ ${fmtEUR(n * state.eurPerAud)})</span>`;
}

function fmtRangeLine(min, max) {
  if (min === max) return fmtDual(min);
  if (!state.eurPerAud) return `${fmtAUD(min)} – ${fmtAUD(max)}`;
  return `${fmtAUD(min)} – ${fmtAUD(max)}<br><span class="eur">≈ ${fmtEUR(min * state.eurPerAud)} – ${fmtEUR(max * state.eurPerAud)}</span>`;
}

function fmtPhaseTotal(lo, hi) {
  if (lo === hi) return fmtDual(lo);
  if (!state.eurPerAud) return `${fmtAUD(lo)} – ${fmtAUD(hi)}`;
  return `${fmtAUD(lo)} – ${fmtAUD(hi)}<br><span class="eur phase-eur">≈ ${fmtEUR(lo * state.eurPerAud)} – ${fmtEUR(hi * state.eurPerAud)}</span>`;
}

function showError(el, message) {
  let err = el.querySelector('.field-error');
  if (!err) { err = document.createElement('p'); err.className = 'field-error'; el.querySelector('.card-inputs').appendChild(err); }
  err.textContent = message;
}

// ============================================================
// 9. SUMMARY SCREEN
// ============================================================
function showSummary() {
  const predep  = calcPredeparture();
  const arrival = calcArrival();
  const monthly = calcMonthly();

  document.getElementById('wizard-container').classList.add('hidden');
  const screen = document.getElementById('summary-screen');
  screen.classList.remove('hidden');
  screen.innerHTML = buildSummaryHTML(predep, arrival, monthly);
  screen.scrollTop = 0;
  document.getElementById('restart-btn').addEventListener('click', resetApp);
}

function buildSummaryHTML(predep, arrival, monthly) {
  return `
    <div class="summary-header">
      <h1 class="summary-title">Твоето резюме</h1>
      <p class="summary-sub">Всички суми са ориентировъчни и служат за планиране.</p>
    </div>
    ${buildProfileCard()}
    <div class="phases">
      ${buildPhaseBlock('📋 Преди заминаване', predep)}
      ${buildPhaseBlock('✈️ При пристигане',   arrival)}
      ${buildPhaseBlock('📅 Месечни разходи',  monthly)}
    </div>
    <div class="summary-footer">
      <p class="disclaimer">Всички суми са ориентировъчни. Препоръчваме буфер от 20–30% над изчисленото. Тази калкулация не е финансов съвет.</p>
      <button class="restart-btn" id="restart-btn">← Започни отначало</button>
    </div>
  `;
}

function buildProfileCard() {
  const visaLabel = DATA.visa.options.find(o => o.key === state.visaKey)?.label_bg || '—';

  function familyLabel() {
    const parts = [];
    if (state.kindyCount > 0) parts.push(`${state.kindyCount} ${state.kindyCount === 1 ? 'малко дете' : 'малки деца'}`);
    if (state.schoolCount > 0) parts.push(`${state.schoolCount} в училище`);
    return `Семейство (${parts.join(', ')})`;
  }

  const householdMap = {
    solo:   'Само аз',
    couple: 'Аз и партньорът ми',
    family: familyLabel()
  };

  const transportLabel = state.transport === 'car'
    ? `Кола${state.vehicleCost ? ' ($' + state.vehicleCost.toLocaleString() + ')' : ' ($14,000 ориентир)'}`
    : 'Обществен транспорт';
  const propLabel  = DATA.housing.types[state.propertyType]?.label_bg || '—';
  const locLabel   = state.location === 'city' ? 'Център / Крайбрежие' : 'Предградия';
  const stayLabel  = state.stayingWithFamily ? 'При приятели / семейство' : 'Временно жилище';
  const eurLabel   = state.eurPerAud ? `AUD + EUR (1 AUD = ${state.eurPerAud} EUR)` : 'Само AUD';

  const chips = [
    { label: 'Виза',         value: visaLabel },
    { label: 'Домакинство',  value: householdMap[state.householdType] || '—' },
    { label: 'Транспорт',    value: transportLabel },
    { label: 'При пристигане', value: stayLabel },
    { label: 'Жилище',       value: `${propLabel} — ${locLabel}` },
    { label: 'Валута',       value: eurLabel }
  ];

  return `
    <div class="profile-card">
      <h3 class="profile-title">Твоят профил</h3>
      <div class="profile-chips">
        ${chips.map(c => `
          <div class="profile-chip">
            <span class="chip-label">${c.label}</span>
            <span class="chip-value">${c.value}</span>
          </div>`).join('')}
      </div>
    </div>
  `;
}

function buildPhaseBlock(title, calc) {
  const lineHTML = calc.lines.map(line => {
    const srcLink = line.source_key
      ? ` <a href="${DATA.meta.source_links[line.source_key]}" target="_blank" class="source-link">→ Провери</a>`
      : '';

    if (line.excluded) {
      return `
        <div class="line line--info">
          <span class="line-label">${line.label_bg}</span>
          <p class="line-note">${line.note_bg || ''}${srcLink}</p>
        </div>`;
    }

    return `
      <div class="line">
        <div class="line-head">
          <span class="line-label">${line.label_bg}</span>
          <span class="line-amount">${fmtRangeLine(line.amount_min, line.amount_max)}</span>
        </div>
        ${line.note_bg ? `<p class="line-note">${line.note_bg}${srcLink}</p>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="phase">
      <div class="phase-head">
        <h2 class="phase-title">${title}</h2>
        <div class="phase-total">${fmtPhaseTotal(calc.lo, calc.hi)}</div>
      </div>
      <div class="phase-lines">${lineHTML}</div>
    </div>`;
}

// ============================================================
// 10. INIT + RESET
// ============================================================
function resetApp() {
  Object.assign(state, {
    visaKey: null, householdType: null, adultCount: 1,
    childCount: 0, kindyCount: 0, schoolCount: 0,
    partnerEnglish: null,
    skillsAssessmentCost: null, flightsCost: null, vehicleCost: null,
    transport: null, stayingWithFamily: null,
    propertyType: null, location: null, eurPerAud: null
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
