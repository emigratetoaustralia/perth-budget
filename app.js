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
  childCount:           0,    // derived: kindyCount + schoolCount
  kindyCount:           0,    // children 0-4 yrs
  schoolCount:          0,    // children 5-18 yrs
  kindyDaysPerWeek:     5,    // days/week at Long Day Care (all kindy children)
  kindyDailyRate:       null, // AUD/day — null = use DATA.ccs.daily_rate_default
  familyIncome:         null, // combined gross annual — null = show range
  partnerEnglish:       null,
  skillsAssessmentCost: null,
  flightsCost:          null,
  vehicleCost:          null,
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
// 3b. COMPLEXITY CHECK (for Lazar affiliate block)
// ============================================================
function isComplexCase() {
  // 482 + couple or family (OVHC for all, school fees, no CCS)
  if (state.visaKey === 'visa_482' && state.householdType !== 'solo') return true;
  // Partner without functional English (second instalment $4,885)
  if (state.partnerEnglish === false) return true;
  // 482 + any children (single-parent on temp visa)
  if (state.visaKey === 'visa_482' && state.childCount > 0) return true;
  return false;
}

// ============================================================
// 3c. PASSWORD GATE (SHA-256, Web Crypto API)
// ============================================================
const PASSWORD_HASH = '2f51a508d42c5572649cc42ebe9ec8704aff916cf78dc6534dbe26c7c0bbd4c8';

async function hashInput(str) {
  const enc  = new TextEncoder();
  const buf  = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

let sessionAuthenticated = false;

// ============================================================
// 4. WIZARD ENGINE
// ============================================================
const ALL_CARDS = [
  'exchange_rate',
  'disclaimer',
  'visa_type',
  'household',
  'kindy_days',          // conditional: kindyCount > 0
  'kindy_ccs',           // conditional: kindyCount > 0 AND PR
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
    if (key === 'kindy_days') {
      return state.kindyCount > 0;
    }
    if (key === 'kindy_ccs') {
      return state.kindyCount > 0 && state.kindyDaysPerWeek > 0 &&
             (state.visaKey === 'pr_189' || state.visaKey === 'pr_190');
    }
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
    kindy_days:         cardKindyDays,
    kindy_ccs:          cardKindyCcs,
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

// Continue button shown on auto-advance cards when the user returns via back-nav
// (state already holds a value). Lets them proceed without re-selecting.
function continueBtn(show, id) {
  return show ? `<button class="primary-btn" id="${id}">Продължи →</button>` : '';
}

// --- Card 1: Exchange rate ---
function cardExchangeRate() {
  const anchor = DATA.meta.currency_anchor_eur_per_aud;
  const hasEur = state.eurPerAud !== null;
  return `
    ${msg(`Здравей! Аз ще те преведа стъпка по стъпка през всичко, което трябва да знаеш за разходите при преместване в Пърт.<br><br>Всички суми са в австралийски долари (AUD). Искаш ли да виждаш и приблизителните стойности в евро?<br><br><span class="msg-note">Насочващ курс: 1 AUD = ${anchor} EUR (средата на 2026) · <a href="${DATA.meta.source_links.xe_rate}" target="_blank" class="source-link">→ Провери текущия курс</a></span>`)}\
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
      ${continueBtn(state.visaKey !== null, 'visa-confirm')}
    </div>
  `;
}

// --- Card 4: Household ---
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
      ${(state.householdType === 'solo' || state.householdType === 'couple')
        ? continueBtn(true, 'household-simple-confirm') : ''}
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

// --- Card 5: Kindy days (conditional: kindyCount > 0) ---
function cardKindyDays() {
  const plural = state.kindyCount > 1 ? 'децата' : 'детето';
  const days   = state.kindyDaysPerWeek;
  const labels = ['Без градина', '1 ден', '2 дни', '3 дни', '4 дни', '5 дни'];
  return `
    ${msg(`Колко дни в седмицата ще ходи ${plural} на детска градина?`)}\
    <div class="card-inputs">
      <div class="choice-group kindy-days-group">
        ${[0,1,2,3,4,5].map(d => choiceBtn(String(d), labels[d], days === d)).join('')}
      </div>
      <button class="primary-btn" id="kindy-days-confirm">Продължи →</button>
    </div>
  `;
}

// --- Card 6: Kindy CCS (conditional: kindyCount > 0 AND PR) ---
function cardKindyCcs() {
  const ccs       = DATA.ccs;
  const knownRate = state.kindyDailyRate !== null;
  const knownInc  = state.familyIncome   !== null;
  return `
    ${msg(`Ако ми кажеш каква е дневната такса на градината и колко изкарвате заедно с партньора ти, мога да изчисля точно колко ще платите след субсидията (CCS).<br><br>Ако предпочиташ да пропуснеш — ще ти покажа ориентировъчен диапазон.<br><br><span class="msg-note">${ccs.note_session_hours}</span>`)}\
    <div class="card-inputs">
      <p class="input-label">Дневна такса на детската градина</p>
      <div class="choice-group--inline">
        ${choiceBtn('rate_default', `Не знам — използвай $${ccs.daily_rate_default}/ден`, !knownRate)}
        ${choiceBtn('rate_custom',  'Въведи точната такса',                                  knownRate)}
      </div>
      <div id="rate-input-row" class="input-row${knownRate ? '' : ' hidden'}">
        <input type="number" id="daily-rate-input" class="amount-input"
          placeholder="${ccs.daily_rate_default}"
          value="${knownRate ? state.kindyDailyRate : ''}"
          min="50" max="400" step="1">
        <span class="amount-suffix">AUD / ден</span>
      </div>

      <p class="input-label" style="margin-top:16px">Общ семеен доход (брутен, годишно)</p>
      <div class="choice-group--inline">
        ${choiceBtn('income_skip',  'Пропусни — покажи диапазон', !knownInc)}
        ${choiceBtn('income_enter', 'Въведи дохода',               knownInc)}
      </div>
      <div id="income-input-row" class="input-row${knownInc ? '' : ' hidden'}">
        <input type="number" id="family-income-input" class="amount-input"
          placeholder="Например: 130000"
          value="${knownInc ? state.familyIncome : ''}"
          min="0" step="1000">
        <span class="amount-suffix">AUD / год.</span>
      </div>

      <button class="primary-btn" id="ccs-confirm">Продължи →</button>
    </div>
  `;
}

// --- Card 7: Partner English (conditional) ---
function cardPartnerEnglish() {
  const si = DATA.visa.second_instalment;
  return `
    ${msg(`Важен въпрос за партньора ти: има ли валиден резултат от езиков изпит (IELTS или PTE)?<br><br>Ако не — правителството изисква задължителна втора вноска от <strong>$${si.amount.toLocaleString('en-AU')} AUD</strong> към визата.`)}\
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

// --- Card 8: Skills assessment (conditional: PR only) ---
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

// --- Card 9: Flights input ---
function cardFlightsInput() {
  const f     = DATA.arrival.flights;
  const n     = getFamilySize();
  const fMin  = f.per_person_min * n;
  const fMax  = f.per_person_max * n;
  const pWord = n === 1 ? 'човек' : 'души';
  const known = state.flightsCost !== null;
  return `
    ${msg(`Самолетните билети. За ${n} ${pWord} от София до Пърт, ориентировъчно е между <strong>$${fMin.toLocaleString('en-AU')}</strong> и <strong>$${fMax.toLocaleString('en-AU')} AUD</strong>.<br><br>${f.note_bg}`)}\
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

// --- Card 10: Transport ---
function cardTransport() {
  const v     = DATA.arrival.vehicle;
  const isCar = state.transport === 'car';
  const known = state.vehicleCost !== null;
  return `
    ${msg('Пърт е голям и разпръснат град. Общественият транспорт покрива добре центъра, но не стига до всички квартали.<br><br>Планираш ли да купиш кола, или ще разчиташ на автобуси и влакове?')}\
    <div class="card-inputs">
      <div class="choice-group--inline">
        ${choiceBtn('car',        'Купувам кола',        state.transport === 'car')}
        ${choiceBtn('transperth', 'Обществен транспорт', state.transport === 'transperth')}
      </div>
      ${state.transport === 'transperth' ? continueBtn(true, 'transport-transperth-confirm') : ''}
      ${isCar ? `
        <p class="input-label">${v.input_prompt_bg}</p>
        <div class="choice-group--inline">
          ${choiceBtn('default', `Не — използвай $${v.default_cost.toLocaleString('en-AU')}`, !known)}
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

// --- Card 11: Staying with family ---
function cardStayingWithFamily() {
  return `
    ${msg('Къде планираш да останеш първите седмици след пристигането в Пърт?')}\
    <div class="card-inputs">
      <div class="choice-group--inline">
        ${choiceBtn('temp',   'Наемам временно жилище',     state.stayingWithFamily === false)}
        ${choiceBtn('family', 'При приятели или семейство', state.stayingWithFamily === true)}
      </div>
      ${state.stayingWithFamily === true
        ? `<div class="info-note">Страхотно — ще махнем разходите за временно жилище. Депозитът и авансовият наем за постоянния ти дом са все още включени в резюмето.</div>
           <button class="primary-btn" id="staying-confirm">Продължи →</button>`
        : ''}
      ${state.stayingWithFamily === false ? continueBtn(true, 'staying-temp-confirm') : ''}
    </div>
  `;
}

// --- Card 12: Property type ---
function cardPropertyType() {
  return `
    ${msg('Какъв тип жилище търсиш?')}\
    <div class="card-inputs">
      <div class="choice-group">
        ${Object.entries(DATA.housing.types).map(([key, val]) =>
          choiceBtn(key, val.label_bg, state.propertyType === key)
        ).join('')}
      </div>
      ${continueBtn(state.propertyType !== null, 'property-confirm')}
    </div>
  `;
}

// --- Card 13: Location ---
function cardLocation() {
  const isHouse = state.propertyType === 'house_3br' || state.propertyType === 'house_4br';
  const mkt     = DATA.housing.rental_market_note_bg;

  if (!isHouse) {
    const t = DATA.housing.types[state.propertyType];
    return `
      ${msg(`Последен въпрос! В кой район на Пърт планираш да живееш?<br><br><span class="msg-note">${t.note_bg}<br><br>${mkt}</span>`)}\
      <div class="card-inputs">
        <div class="choice-group--inline">
          ${choiceBtn('suburbs', 'Предградия',          state.location === 'suburbs')}
          ${choiceBtn('city',    'Център / Крайбрежие', state.location === 'city')}
        </div>
        ${continueBtn(state.location !== null, 'location-confirm')}
      </div>
    `;
  }

  const zones    = DATA.housing.zones;
  const zoneList = Object.values(zones)
    .map(z => `· ${z.label_bg}: ${z.suburbs_bg}`)
    .join('<br>');
  return `
    ${msg(`Последен въпрос! В коя зона на Пърт искаш да живееш?<br><br><span class="msg-note">${zoneList}<br><br>${mkt}</span>`)}\
    <div class="card-inputs">
      <div class="choice-group">
        ${Object.entries(zones).map(([key, z]) =>
          choiceBtn(key, z.label_bg, state.location === key)
        ).join('')}
      </div>
      ${continueBtn(state.location !== null, 'location-confirm')}
    </div>
  `;
}

// --- Card 14: Summary trigger ---
function cardSummaryTrigger() {
  return `
    ${msg('Перфектно — имам всичко, което ми трябва. Искаш ли да видиш пълното резюме на разходите?')}\
    <div class="card-inputs">
      <div class="info-note">💡 Не затваряй прозореца, докато преглеждаш резюмето — напредъкът не се записва.</div>
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
    kindy_days:         bindKindyDays,
    kindy_ccs:          bindKindyCcs,
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
  input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm.click(); });
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
  el.querySelector('#visa-confirm')?.addEventListener('click', () =>
    goForward(getNextCard('visa_type')));
}

function bindHousehold(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value;
      state.householdType = val;
      if (val === 'solo') {
        state.kindyCount = 0; state.schoolCount = 0; state.childCount = 0;
        track('household/solo');
        goForward(getNextCard('household'));
      } else if (val === 'couple') {
        state.kindyCount = 0; state.schoolCount = 0; state.childCount = 0;
        track('household/couple');
        goForward(getNextCard('household'));
      } else {
        if (state.kindyCount + state.schoolCount < 1) state.schoolCount = 1;
        const cur = document.getElementById('card-current');
        cur.innerHTML = cardHousehold();
        bindHousehold(cur);
      }
    });
  });

  const kindyMinus   = el.querySelector('#kindy-minus');
  const kindyPlus    = el.querySelector('#kindy-plus');
  const kindyDisplay = el.querySelector('#kindy-count');
  const schoolMinus  = el.querySelector('#school-minus');
  const schoolPlus   = el.querySelector('#school-plus');
  const schoolDisplay= el.querySelector('#school-count');
  const confirm      = el.querySelector('#household-confirm');

  if (kindyMinus) kindyMinus.addEventListener('click', () => {
    if (state.kindyCount > 0) { state.kindyCount--; kindyDisplay.textContent = state.kindyCount; }
  });
  if (kindyPlus) kindyPlus.addEventListener('click', () => {
    if (state.kindyCount < 8) { state.kindyCount++; kindyDisplay.textContent = state.kindyCount; }
  });
  if (schoolMinus) schoolMinus.addEventListener('click', () => {
    if (state.schoolCount > 0) { state.schoolCount--; schoolDisplay.textContent = state.schoolCount; }
  });
  if (schoolPlus) schoolPlus.addEventListener('click', () => {
    if (state.schoolCount < 8) { state.schoolCount++; schoolDisplay.textContent = state.schoolCount; }
  });
  if (confirm) confirm.addEventListener('click', () => {
    const total = state.kindyCount + state.schoolCount;
    if (total < 1) { showError(el, 'Добави поне едно дете.'); return; }
    state.childCount = total;
    track('household/family_kindy_' + state.kindyCount + '_school_' + state.schoolCount);
    goForward(getNextCard('household'));
  });
  el.querySelector('#household-simple-confirm')?.addEventListener('click', () =>
    goForward(getNextCard('household')));
}

function bindKindyDays(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.kindyDaysPerWeek = parseInt(btn.dataset.value, 10);
      // Reflect selection without advancing — user confirms with the button
      el.querySelectorAll('.choice-btn').forEach(b =>
        b.classList.toggle('choice-btn--selected', b === btn));
    });
  });
  el.querySelector('#kindy-days-confirm')?.addEventListener('click', () => {
    track('kindy_days/' + state.kindyDaysPerWeek);
    goForward(getNextCard('kindy_days'));
  });
}

function bindKindyCcs(el) {
  const rateDefaultBtn = el.querySelector('[data-value="rate_default"]');
  const rateCustomBtn  = el.querySelector('[data-value="rate_custom"]');
  const rateRow        = el.querySelector('#rate-input-row');
  const rateInput      = el.querySelector('#daily-rate-input');
  const incomeSkipBtn  = el.querySelector('[data-value="income_skip"]');
  const incomeEnterBtn = el.querySelector('[data-value="income_enter"]');
  const incomeRow      = el.querySelector('#income-input-row');
  const incomeInput    = el.querySelector('#family-income-input');
  const confirm        = el.querySelector('#ccs-confirm');

  rateDefaultBtn.addEventListener('click', () => {
    state.kindyDailyRate = null;
    rateDefaultBtn.classList.add('choice-btn--selected');
    rateCustomBtn.classList.remove('choice-btn--selected');
    rateRow.classList.add('hidden');
  });
  rateCustomBtn.addEventListener('click', () => {
    rateCustomBtn.classList.add('choice-btn--selected');
    rateDefaultBtn.classList.remove('choice-btn--selected');
    rateRow.classList.remove('hidden');
    rateInput.focus();
  });
  incomeSkipBtn.addEventListener('click', () => {
    state.familyIncome = null;
    incomeSkipBtn.classList.add('choice-btn--selected');
    incomeEnterBtn.classList.remove('choice-btn--selected');
    incomeRow.classList.add('hidden');
  });
  incomeEnterBtn.addEventListener('click', () => {
    incomeEnterBtn.classList.add('choice-btn--selected');
    incomeSkipBtn.classList.remove('choice-btn--selected');
    incomeRow.classList.remove('hidden');
    incomeInput.focus();
  });

  confirm.addEventListener('click', () => {
    if (!rateRow.classList.contains('hidden')) {
      const val = parseFloat(rateInput.value);
      if (isNaN(val) || val < 50 || val > 400) {
        showError(el, 'Моля въведи валидна дневна такса (между $50 и $400).');
        return;
      }
      state.kindyDailyRate = val;
    } else {
      state.kindyDailyRate = null;
    }
    if (!incomeRow.classList.contains('hidden')) {
      const val = parseFloat(incomeInput.value);
      if (isNaN(val) || val < 0) {
        showError(el, 'Моля въведи валиден годишен доход.');
        return;
      }
      state.familyIncome = val;
    } else {
      state.familyIncome = null;
    }
    track('kindy_ccs/rate_' + (state.kindyDailyRate ? 'custom' : 'default') +
          '_income_' + (state.familyIncome !== null ? 'entered' : 'skipped'));
    goForward(getNextCard('kindy_ccs'));
  });
  rateInput.addEventListener('keydown',   e => { if (e.key === 'Enter') confirm.click(); });
  incomeInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirm.click(); });
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
  if (confirm) confirm.addEventListener('click', () => goForward(getNextCard('partner_english')));
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
  input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm.click(); });
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
  input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm.click(); });
}

function bindTransport(el) {
  el.querySelectorAll('.choice-group--inline .choice-btn').forEach(btn => {
    if (btn.dataset.value === 'car' || btn.dataset.value === 'transperth') {
      btn.addEventListener('click', () => {
        if (btn.dataset.value === 'transperth') {
          state.transport = 'transperth'; state.vehicleCost = null;
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
        el.querySelector('[data-value="custom"]')?.classList.remove('choice-btn--selected');
        el.querySelector('#vehicle-input-row')?.classList.add('hidden');
      });
    }
    if (btn.dataset.value === 'custom') {
      btn.addEventListener('click', () => {
        btn.classList.add('choice-btn--selected');
        el.querySelector('[data-value="default"]')?.classList.remove('choice-btn--selected');
        const row = el.querySelector('#vehicle-input-row');
        if (row) { row.classList.remove('hidden'); row.querySelector('input').focus(); }
      });
    }
  });
  const confirm = el.querySelector('#transport-confirm');
  if (confirm) confirm.addEventListener('click', () => {
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
  const vehicleInput = el.querySelector('#vehicle-cost-input');
  if (vehicleInput) vehicleInput.addEventListener('keydown', e => { if (e.key === 'Enter') el.querySelector('#transport-confirm')?.click(); });
  el.querySelector('#transport-transperth-confirm')?.addEventListener('click', () =>
    goForward(getNextCard('transport')));
}

function bindStayingWithFamily(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.value === 'temp') {
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
  el.querySelector('#staying-confirm')?.addEventListener('click', () =>
    goForward(getNextCard('staying_with_family')));
  el.querySelector('#staying-temp-confirm')?.addEventListener('click', () =>
    goForward(getNextCard('staying_with_family')));
}

function bindPropertyType(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.propertyType = btn.dataset.value;
      track('property_type/' + state.propertyType);
      goForward(getNextCard('property_type'));
    });
  });
  el.querySelector('#property-confirm')?.addEventListener('click', () =>
    goForward(getNextCard('property_type')));
}

function bindLocation(el) {
  el.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.location = btn.dataset.value;
      track('location/' + state.location);
      goForward(getNextCard('location'));
    });
  });
  el.querySelector('#location-confirm')?.addEventListener('click', () =>
    goForward(getNextCard('location')));
}

function bindSummaryTrigger(el) {
  el.querySelector('#show-summary').addEventListener('click', () => {
    if (sessionAuthenticated) {
      track('summary/viewed_cached');
      showSummary();
    } else {
      track('summary/gate_shown');
      showPasswordGate();
    }
  });
}

// ============================================================
// 7. CCS ENGINE (Child Care Subsidy, 2026-2027 FY)
// All thresholds loaded from DATA.ccs for easy annual update.
// ============================================================

function ccsStandardRate(income) {
  const c = DATA.ccs;
  if (income <= c.income_threshold_90)   return 0.90;
  if (income >= c.income_threshold_zero) return 0.00;
  return 0.90 - ((income - c.income_threshold_90) / 5000) * 0.01;
}

function ccsHigherRate(income) {
  const c = DATA.ccs;
  // Above cutoff: multi-child bonus is gone, matches standard rate
  if (income >= c.income_higher_rate_cutoff) return ccsStandardRate(income);
  // Bracket A
  if (income <= c.income_bracket_a_max) return 0.95;
  // Bracket B
  if (income <= c.income_bracket_b_max)
    return 0.95 - ((income - c.income_bracket_a_max) / 3000) * 0.01;
  // Bracket C
  if (income <= c.income_bracket_c_max) return 0.80;
  // Bracket D
  if (income <= c.income_bracket_d_max)
    return 0.80 - ((income - c.income_bracket_c_max) / 3000) * 0.01;
  // Bracket E: 360,727 < income < 370,727
  return 0.50;
}

// Returns { total (monthly AUD), perChildLines (array of display strings) }
function calcKindyCcs(dailyRate, daysPerWeek, income) {
  const c              = DATA.ccs;
  const actualHourly   = dailyRate / c.session_hours_default;
  const subsidisedHrly = Math.min(actualHourly, c.hourly_rate_cap);
  let total = 0;
  const perChildLines = [];

  for (let i = 0; i < state.kindyCount; i++) {
    const rate       = i === 0 ? ccsStandardRate(income) : ccsHigherRate(income);
    const dailySub   = subsidisedHrly * c.session_hours_default * rate;
    const dailyOOP   = dailyRate - dailySub;
    const monthlyOOP = Math.round(dailyOOP * daysPerWeek * 4.33);
    total += monthlyOOP;
    perChildLines.push(
      `Дете ${i + 1}: ${(rate * 100).toFixed(1)}% субсидия → ~$${Math.round(dailyOOP)}/ден → ~${fmtAUD(monthlyOOP)}/мес.`
    );
  }
  return { total, perChildLines };
}

// ============================================================
// 8. CALCULATIONS
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

  addFixed('Визова такса (основен кандидат)', visa.fees.primary, { source_key: 'visa_fees' });

  if (state.householdType === 'couple' || state.householdType === 'family') {
    const partnerFee = (state.visaKey === 'pr_189' || state.visaKey === 'pr_190')
      ? visa.fees.extra_adult : visa.fees.primary;
    addFixed('Визова такса (партньор)', partnerFee, { source_key: 'visa_fees' });
  }

  if (state.householdType === 'family' && state.childCount > 0) {
    const cWord = state.childCount === 1 ? 'дете' : 'деца';
    addFixed(`Визова такса (${state.childCount} ${cWord})`,
      visa.fees.child * state.childCount, { source_key: 'visa_fees' });
  }

  if ((state.visaKey === 'pr_189' || state.visaKey === 'pr_190') &&
      (state.householdType === 'couple' || state.householdType === 'family') &&
      state.partnerEnglish === false) {
    const si = DATA.visa.second_instalment;
    addFixed(si.label_bg, si.amount, { note_bg: si.note_bg, source_key: 'visa_fees' });
  }

  if (state.visaKey === 'pr_189' || state.visaKey === 'pr_190') {
    const et = DATA.predeparture.english_test;
    const bothSit = (state.householdType === 'couple' || state.householdType === 'family') &&
                    state.partnerEnglish === false;
    if (bothSit) {
      addFixed('Езиков изпит (IELTS / PTE) — двама кандидати', et.amount * 2,
        { note_bg: et.note_bg + ' И двамата кандидати трябва да положат изпит — таксата е удвоена.', source_key: 'visa_fees' });
    } else {
      addFixed('Езиков изпит (IELTS / PTE)', et.amount,
        { note_bg: et.note_bg, source_key: 'visa_fees' });
    }
    const sa = DATA.predeparture.skills_assessment;
    if (state.skillsAssessmentCost !== null) {
      addFixed('Оценка на уменията', state.skillsAssessmentCost,
        { note_bg: sa.note_bg, source_key: 'skills_assessment' });
    } else {
      addRange('Оценка на уменията', sa.range_min, sa.range_max,
        { note_bg: sa.note_bg, source_key: 'skills_assessment' });
    }
  }

  if (state.visaKey === 'pr_190') {
    addInfo('Номинация от Западна Австралия ($200)', {
      note_bg: visa.nomination_note_bg, source_key: 'wa_nomination'
    });
  }

  return { lo, hi, lines };
}

function calcArrival() {
  const lines = [];
  let lo = 0, hi = 0;
  const n    = getFamilySize();
  const isPR = state.visaKey === 'pr_189' || state.visaKey === 'pr_190';

  function addFixed(label_bg, amount, opts = {}) {
    lines.push({ label_bg, amount_min: amount, amount_max: amount, ...opts });
    lo += amount; hi += amount;
  }
  function addRange(label_bg, min, max, opts = {}) {
    lines.push({ label_bg, amount_min: min, amount_max: max, ...opts });
    lo += min; hi += max;
  }

  const f = DATA.arrival.flights;
  if (state.flightsCost !== null) {
    addFixed('Самолетни билети (въведена сума)', state.flightsCost, { note_bg: f.note_bg });
  } else {
    const pWord = n === 1 ? 'човек' : 'души';
    addRange(`Самолетни билети (${n} ${pWord})`,
      f.per_person_min * n, f.per_person_max * n, { note_bg: f.note_bg });
  }

  if (!state.stayingWithFamily) {
    const tier  = DATA.arrival.temp_accommodation.tiers.find(t => n <= t.max_persons);
    const weeks = DATA.arrival.temp_accommodation.default_weeks;
    addFixed(`Временно жилище (${weeks} седмици)`, tier.weekly * weeks,
      { note_bg: DATA.arrival.temp_accommodation.note_bg });
  }

  const wk = getWeeklyRent();
  addRange(`Депозит (${DATA.housing.bond_weeks} седмици)`,
    wk.min * DATA.housing.bond_weeks, wk.max * DATA.housing.bond_weeks,
    { source_key: 'reiwa', note_bg: DATA.housing.rental_market_note_bg });
  addRange(`Авансов наем (${DATA.housing.advance_weeks} седмици)`,
    wk.min * DATA.housing.advance_weeks, wk.max * DATA.housing.advance_weeks,
    { source_key: 'reiwa' });

  if (state.transport === 'car') {
    const v    = DATA.arrival.vehicle;
    const cost = state.vehicleCost !== null ? state.vehicleCost : v.default_cost;
    const duty = calcStampDuty(cost);
    addFixed('Автомобил', cost, { note_bg: v.note_bg_duty });
    addFixed('Данък за прехвърляне на автомобила', duty, { source_key: 'revenue_wa_duty' });
    // Licence fork: PR must test ($382); 482 drives on BG licence at $0
    if (isPR) {
      addFixed('Шофьорска книжка WA + изпити', v.licence_and_tests,
        { note_bg: v.note_bg_licence_pr, source_key: 'dot_licence' });
    } else {
      addFixed('Шофьорска книжка WA', 0, { note_bg: v.note_bg_licence_482 });
    }
  }

  // School registration (482 + school-age children only — not kindy-only families)
  if (state.visaKey === 'visa_482' && state.schoolCount > 0) {
    const s = DATA.monthly.school;
    addFixed('Еднократна регистрация в училище', s.registration_one_off,
      { note_bg: s.note_bg });
  }

  return { lo, hi, lines };
}

function calcMonthly() {
  const lines = [];
  let lo = 0, hi = 0;
  const n    = getFamilySize();
  const isPR = state.visaKey === 'pr_189' || state.visaKey === 'pr_190';

  function addFixed(label_bg, amount, opts = {}) {
    lines.push({ label_bg, amount_min: amount, amount_max: amount, ...opts });
    lo += amount; hi += amount;
  }
  function addRange(label_bg, min, max, opts = {}) {
    lines.push({ label_bg, amount_min: min, amount_max: max, ...opts });
    lo += min; hi += max;
  }

  const wk      = getWeeklyRent();
  const isHouse = state.propertyType === 'house_3br' || state.propertyType === 'house_4br';
  let rentNote  = DATA.housing.rental_market_note_bg;
  if (isHouse) {
    const zoneNote = DATA.housing.zones[state.location]?.note_bg;
    if (zoneNote) rentNote += ' ' + zoneNote;
  } else {
    const typeNote = DATA.housing.types[state.propertyType]?.note_bg;
    if (typeNote) rentNote += ' ' + typeNote;
  }
  addRange('Наем', Math.round(wk.min * 4.33), Math.round(wk.max * 4.33),
    { source_key: 'reiwa', note_bg: rentNote });
  addFixed('Хранителни стоки', calcGroceries(n), { note_bg: DATA.monthly.groceries.note_bg });
  addFixed('Сметки (ток, вода, интернет)',
    DATA.monthly.utilities.base + Math.max(0, n - 1) * DATA.monthly.utilities.per_extra_person,
    { note_bg: DATA.monthly.utilities.note_bg });

  const adults  = state.householdType === 'solo' ? 1 : 2;
  const planWrd = adults === 1 ? 'план' : 'плана';
  addFixed(`Телефонни планове (${adults} ${planWrd})`,
    DATA.monthly.phone.per_adult * adults, { note_bg: DATA.monthly.phone.note_bg });

  const t = DATA.monthly.transport;
  if (state.transport === 'car') {
    addFixed('Разходи за кола (гориво, застраховка)', t.car_running_monthly,
      { note_bg: t.note_bg_car });
  } else {
    const cardWrd = adults === 1 ? 'карта' : 'карти';
    addFixed(`Transperth (${adults} ${cardWrd})`, t.transperth_adult_monthly * adults,
      { note_bg: t.note_bg_transperth, source_key: 'transperth' });
  }

  const d = DATA.monthly.dining;
  if (state.householdType === 'solo') {
    addRange('Хранене навън и кафе', d.solo_min, d.solo_max, { note_bg: d.note_bg });
  } else if (state.householdType === 'couple') {
    addRange('Хранене навън и кафе', d.couple_min, d.couple_max, { note_bg: d.note_bg });
  } else {
    addRange('Хранене навън и кафе', d.family_min, d.family_max, { note_bg: d.note_bg });
  }

  if (state.householdType === 'family' && state.childCount > 0) {
    const ka    = DATA.monthly.kids_activities;
    const cWord = state.childCount === 1 ? 'дете' : 'деца';
    addRange(`Занимания за деца (${state.childCount} ${cWord})`,
      ka.per_child_min * state.childCount, ka.per_child_max * state.childCount,
      { note_bg: ka.note_bg });
  }

  // Детска градина — dynamic: daily rate × days × 4.33
  if (state.kindyCount > 0) {
    const k        = DATA.monthly.kindy;
    const days     = state.kindyDaysPerWeek;
    const kWord    = state.kindyCount === 1 ? 'дете' : 'деца';

    if (days === 0) {
      // Not enrolled — show $0 with context note
      addFixed(`Детска градина (${state.kindyCount} ${kWord})`, 0,
        { note_bg: 'Детето не е записано в детска градина. При нужда, планирай около $150/ден при записване.' });
    } else {
      const dayRate  = state.kindyDailyRate !== null ? state.kindyDailyRate : DATA.ccs.daily_rate_default;
      const grossPer = Math.round(dayRate * days * 4.33);
      const daysWrd  = days === 1 ? 'ден' : 'дни';

      if (!isPR) {
        // 482: no CCS, pay full gross
        const note = `${k.note_bg_482} $${dayRate}/ден × ${days} ${daysWrd} × 4.33 седм. = ~${fmtAUD(grossPer)}/мес. на дете.`;
        addFixed(`Детска градина (${state.kindyCount} ${kWord})`,
          grossPer * state.kindyCount, { note_bg: note });
      } else if (state.familyIncome !== null) {
        // PR + income entered: exact CCS calculation
        const ccs     = calcKindyCcs(dayRate, days, state.familyIncome);
        const noteStr = ccs.perChildLines.join(' · ') +
          ` Брутна цена: ~${fmtAUD(grossPer)}/мес. на дете ($${dayRate}/ден × ${days} ${daysWrd}).`;
        addFixed(`Детска градина (${state.kindyCount} ${kWord})`,
          ccs.total, { note_bg: noteStr, source_key: 'ccs_calculator' });
      } else {
        // PR + income skipped: scaled range
        const daysRatio = days / 5;
        const rangeMin  = Math.round(k.perth_aud_net_pr_min_5days * daysRatio) * state.kindyCount;
        const rangeMax  = Math.round(k.perth_aud_net_pr_max_5days * daysRatio) * state.kindyCount;
        const noteStr   = `${k.note_bg_pr_range} Брутна цена: ~${fmtAUD(grossPer)}/мес. на дете ($${dayRate}/ден × ${days} ${daysWrd}). Въведи семейния доход за точна сметка.`;
        addRange(`Детска градина (${state.kindyCount} ${kWord})`,
          rangeMin, rangeMax, { note_bg: noteStr, source_key: 'ccs_calculator' });
      }
    }
  }

  // OVHC (482 only)
  if (state.visaKey === 'visa_482') {
    const ovhc   = DATA.monthly.ovhc;
    const amount = state.householdType === 'solo' ? ovhc.single_monthly : ovhc.family_monthly;
    addFixed('OVHC здравна застраховка', amount,
      { note_bg: ovhc.note_bg, source_key: 'ovhc' });
  }

  // School (482 + school-age children)
  // Guard-rail: flat $4,000/year per family. Kindergarten-only families (schoolCount === 0) are exempt.
  if (state.visaKey === 'visa_482' && state.schoolCount > 0) {
    const s = DATA.monthly.school;
    addFixed('Такса обучение (държавно училище)', s.family_flat_rate_monthly,
      { note_bg: s.note_bg });
  }

  return { lo, hi, lines };
}

// ============================================================
// 9. CALC HELPERS
// ============================================================
function getFamilySize() {
  if (state.householdType === 'solo')   return 1;
  if (state.householdType === 'couple') return 2;
  return 2 + state.childCount;
}

function getWeeklyRent() {
  const isHouse = state.propertyType === 'house_3br' || state.propertyType === 'house_4br';
  if (!isHouse) {
    const h  = DATA.housing.types[state.propertyType];
    const wk = state.location === 'city' ? h.weekly_city : h.weekly_suburbs;
    return { min: wk, max: wk };
  }
  const z = DATA.housing.zones[state.location];
  return { min: z[state.propertyType].weekly_min, max: z[state.propertyType].weekly_max };
}

function calcGroceries(n) {
  const ratio = DATA.monthly.groceries.ratios[Math.min(n, 5) - 1];
  return Math.round(DATA.monthly.groceries.anchor_family_3 * ratio);
}

function calcStampDuty(price) {
  // Brackets from DATA.arrival.vehicle.duty_brackets.
  // Tier 1 (≤$25k): flat rate. Tier 2 (≤$50k): sliding — linear from tier-1
  // ceiling up to the tier-3 rate at $50k. Tier 3 (>$50k): flat rate.
  const b      = DATA.arrival.vehicle.duty_brackets;
  const t1Max  = b[0].max, t1Rate = b[0].rate;          // 25000, 0.0275
  const t2Max  = b[1].max;                               // 50000
  const t3Rate = b[2].rate;                              // 0.065

  if (price <= t1Max) return Math.round(price * t1Rate);
  if (price <= t2Max) {
    const dutyAtT1Ceiling = t1Max * t1Rate;             // 688
    const dutyAtT2Ceiling = t2Max * t3Rate;             // 3250
    const frac = (price - t1Max) / (t2Max - t1Max);
    return Math.round(dutyAtT1Ceiling + frac * (dutyAtT2Ceiling - dutyAtT1Ceiling));
  }
  return Math.round(price * t3Rate);
}

function fmtAUD(n) {
  return '$' + Math.round(n).toLocaleString('en-AU') + ' AUD';
}

function fmtEUR(n) {
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
  if (!err) {
    err = document.createElement('p');
    err.className = 'field-error';
    el.querySelector('.card-inputs').appendChild(err);
  }
  err.textContent = message;
}

// ============================================================
// 10a. PASSWORD GATE
// ============================================================
function showPasswordGate() {
  document.getElementById('wizard-container').classList.add('hidden');

  let gate = document.getElementById('password-gate');
  if (!gate) {
    gate = document.createElement('div');
    gate.id = 'password-gate';
    document.body.appendChild(gate);
  }
  gate.className = '';
  gate.innerHTML = `
    <div class="gate-inner">
      <img src="icons/EA.png" alt="Емигрирай в Австралия" class="gate-logo-img">
      <h1 class="gate-title">Резюмето е готово</h1>
      <p class="gate-sub">За достъп до резюмето ти трябва парола. Намери я в статията на Патреон.</p>
      <a href="https://www.patreon.com/emigratetoaustralia/posts/kolko-pari-predi-161126612"
         target="_blank" class="gate-patreon-link">→ Отвори статията в Патреон</a>
      <div class="gate-input-wrap">
        <input type="text" id="gate-password-input" class="gate-input"
          placeholder="ВЪВЕДИ ПАРОЛА"
          autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false"
          maxlength="30">
        <button class="gate-btn" id="gate-submit">Провери →</button>
      </div>
      <p class="gate-error hidden" id="gate-error">Грешна парола. Провери статията в Патреон.</p>
      <button class="gate-back-btn" id="gate-back">← Назад</button>
    </div>
  `;

  const input  = gate.querySelector('#gate-password-input');
  const submit = gate.querySelector('#gate-submit');
  const errEl  = gate.querySelector('#gate-error');

  // Force uppercase + clear error on every keystroke
  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase();
    errEl.classList.add('hidden');
  });
  input.focus();

  async function attempt() {
    const hash = await hashInput(input.value.trim());
    if (hash === PASSWORD_HASH) {
      sessionAuthenticated = true;
      track('summary/password_correct');
      gate.classList.add('hidden');
      showSummary();
    } else {
      track('summary/password_wrong');
      errEl.classList.remove('hidden');
      input.select();
    }
  }

  submit.addEventListener('click', attempt);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });

  gate.querySelector('#gate-back').addEventListener('click', () => {
    gate.classList.add('hidden');
    document.getElementById('wizard-container').classList.remove('hidden');
  });
}

// ============================================================
// 10. SUMMARY SCREEN
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
  document.getElementById('print-btn').addEventListener('click', () => window.print());
  track('summary/viewed');
}

function buildSummaryHTML(predep, arrival, monthly) {
  return `
    <div class="summary-header">
      <h1 class="summary-title">Твоето резюме</h1>
      <p class="summary-sub">Всички суми са ориентировъчни и служат за планиране.</p>
    </div>
    ${buildProfileCard()}
    <div class="phases">
      ${buildPhaseBlock('📋 Преди заминаване', predep,  'phase--predep')}
      ${buildPhaseBlock('✈️ При пристигане',   arrival, 'phase--arrival')}
    </div>
    ${isComplexCase() ? buildLazarBlock() : ''}
    <div class="phases phases--tail">
      ${buildPhaseBlock('📅 Месечни разходи',  monthly, 'phase--monthly')}
    </div>
    <div class="summary-footer">
      <p class="disclaimer">Всички суми са ориентировъчни. Препоръчвам ти буфер от 20–30% над изчисленото. Тази калкулация не е финансов съвет.</p>
      <button class="print-btn no-print" id="print-btn">🖨️ Принтирай / Запази като PDF</button>
      <button class="restart-btn no-print" id="restart-btn">← Започни отначало</button>
    </div>
  `;
}

function buildProfileCard() {
  const visaLabel = DATA.visa.options.find(o => o.key === state.visaKey)?.label_bg || '—';

  function familyLabel() {
    const parts = [];
    if (state.kindyCount  > 0) parts.push(`${state.kindyCount} ${state.kindyCount === 1 ? 'малко дете' : 'малки деца'}`);
    if (state.schoolCount > 0) parts.push(`${state.schoolCount} в училище`);
    return `Семейство (${parts.join(', ')})`;
  }

  const householdMap = {
    solo:   'Само аз',
    couple: 'Аз и партньорът ми',
    family: familyLabel()
  };

  const transportLabel = state.transport === 'car'
    ? `Кола${state.vehicleCost ? ' ($' + state.vehicleCost.toLocaleString('en-AU') + ')' : ' ($14,000 ориентир)'}`
    : 'Обществен транспорт';
  const propLabel = DATA.housing.types[state.propertyType]?.label_bg || '—';
  function getLocationLabel() {
    if (state.location === 'city')    return 'Център / Крайбрежие';
    if (state.location === 'suburbs') return 'Предградия';
    const z = DATA.housing.zones[state.location];
    return z ? `${z.label_bg} (${z.suburbs_bg})` : state.location;
  }
  const locLabel  = getLocationLabel();
  const stayLabel = state.stayingWithFamily ? 'При приятели / семейство' : 'Временно жилище';
  const eurLabel  = state.eurPerAud ? `AUD + EUR (1 AUD = ${state.eurPerAud} EUR)` : 'Само AUD';

  const chips = [
    { label: 'Виза',           value: visaLabel },
    { label: 'Домакинство',    value: householdMap[state.householdType] || '—' },
    ...(state.kindyCount > 0 ? [{ label: 'Детска градина',
        value: state.kindyDaysPerWeek === 0
          ? `${state.kindyCount} ${state.kindyCount === 1 ? 'дете' : 'деца'} · без записване`
          : `${state.kindyCount} ${state.kindyCount === 1 ? 'дете' : 'деца'} · ${state.kindyDaysPerWeek} ${state.kindyDaysPerWeek === 1 ? 'ден' : 'дни'}/седм.` }] : []),
    { label: 'Транспорт',      value: transportLabel },
    { label: 'При пристигане', value: stayLabel },
    { label: 'Жилище',         value: `${propLabel} — ${locLabel}` },
    { label: 'Валута',         value: eurLabel }
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

function buildPhaseBlock(title, calc, phaseClass) {
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
    <div class="phase ${phaseClass}">
      <div class="phase-head">
        <h2 class="phase-title">${title}</h2>
        <div class="phase-total">${fmtPhaseTotal(calc.lo, calc.hi)}</div>
      </div>
      <div class="phase-lines">${lineHTML}</div>
    </div>`;
}

function buildLazarBlock() {
  return `
    <div class="lazar-block">
      <p class="lazar-text">Виждам, че ситуацията ти е малко по-сложна. Мислил ли си да поговориш с миграционен агент? Аз лично работя с Лазар Петканчин (MARN 1688444) и мога да го препоръчам. Ако решиш да се свържеш с него, линкът по-долу ти дава AUD 50 отстъпка. Твой избор.</p>
      <a href="https://app.acuityscheduling.com/schedule/ed28cd89/appointment/30840286/calendar/3844792?certificate=Code1"
         target="_blank" class="lazar-cta">Запази час с Лазар →</a>
      <p class="lazar-disclosure">Партньорска връзка — ако запазиш час, аз може да получа комисионна.</p>
    </div>
  `;
}

// ============================================================
// ============================================================
function resetApp() {
  Object.assign(state, {
    visaKey: null, householdType: null,
    childCount: 0, kindyCount: 0, schoolCount: 0,
    kindyDaysPerWeek: 5, kindyDailyRate: null, familyIncome: null,
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

// ============================================================
// 11. THEME TOGGLE
// ============================================================
function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  function getEffectiveTheme() {
    const stored = localStorage.getItem('ea-theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ea-theme', theme);
    btn.innerHTML = theme === 'dark'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    btn.setAttribute('aria-label', theme === 'dark' ? 'Светла тема' : 'Тъмна тема');
  }

  applyTheme(getEffectiveTheme());

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || getEffectiveTheme();
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('back-btn').addEventListener('click', goBack);
  initThemeToggle();
  init();
});
