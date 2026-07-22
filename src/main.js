const STORAGE_KEY = 'speaking-gap-cards';
const $ = (selector) => document.querySelector(selector);

const ratings = {
  Again: { label: '말을 시작하지 못했거나 정답을 먼저 봄', days: 0, delta: -1 },
  Hard: { label: '힌트를 사용했거나 8초 이상 걸림', days: 1, delta: 0 },
  Good: { label: '도움 없이 의미를 전달함', days: 3, delta: 1 },
  Easy: { label: '자연스럽게 말하고 후속 질문에도 대응함', days: 7, delta: 1 },
};

const nowIso = () => new Date().toISOString();
const today = nowIso();

const seedCards = [
  {
    id: 'seed-1',
    situation: 'A coworker asks whether the current data is enough to make a decision.',
    prompt: '회의에서 동료가 현재 데이터만으로 결론을 내려도 되냐고 묻습니다. 정중하게 아직 이르다고 말하세요.',
    intent: '데이터가 아직 부족해서 결론 내리기 이르다고 말하고 싶었음',
    attempt: 'It is early to make a conclusion because we need more data.',
    target: 'I think it’s still too early to draw a conclusion because we don’t have enough data yet.',
    chunks: ['too early to', 'draw a conclusion', 'need more data'],
    alternatives: ['We probably need more data before drawing any conclusions.', 'I’d hold off on making a final call until we have more data.'],
    variants: [
      '데이터는 충분하지만 검증이 끝나지 않아 결론 내리기 어렵다고 말하세요.',
      '어제는 결론 내리기 일렀지만 지금은 가능하다고 말하세요.',
      '상대방이 “그럼 어떤 데이터가 더 필요하죠?”라고 묻습니다.',
    ],
    followUp: 'What additional data do you think we need?',
    tag: '업무',
    level: 1,
    dueAt: today,
    createdAt: today,
    history: [],
  },
  {
    id: 'seed-2',
    situation: 'Your team asks if the current project plan still works.',
    prompt: '상대방을 탓하지 않으면서 일정이 촉박해 보여 우선순위를 다시 정해야 할 것 같다고 말하세요.',
    intent: '일정이 좀 빡빡해 보여서 우선순위를 다시 정해야 할 것 같다.',
    attempt: 'The schedule is very difficult, so we should change the priority.',
    target: 'The schedule looks a little tight, so I think we may need to revisit our priorities.',
    chunks: ['looks a little tight', 'revisit our priorities', 'reprioritize'],
    alternatives: ['This timeline feels a bit aggressive.', 'We may need to reprioritize a few things.'],
    variants: [
      '일정은 가능하지만 우선순위를 하나 줄여야 한다고 말하세요.',
      '다음 주가 아니라 이번 주 안에 우선순위를 다시 정해야 한다고 말하세요.',
      '상대방이 “무엇부터 조정해야 하죠?”라고 묻습니다.',
    ],
    followUp: 'Which priorities would you revisit first?',
    tag: '업무',
    level: 1,
    dueAt: today,
    createdAt: today,
    history: [],
  },
];

let state = {
  tab: 'home',
  active: 0,
  answer: '',
  repeatAnswer: '',
  revealed: false,
  repeat: false,
  startedAt: 0,
  hintLevel: 0,
  libraryQuery: '',
  libraryFilter: 'all',
  librarySort: 'due',
  cards: JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || seedCards,
};

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cards));
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[m]));
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function dueCards() {
  return state.cards.filter((card) => new Date(card.dueAt) <= new Date());
}

function createDraft(form) {
  const text = `${form.situation} ${form.intent}`.toLowerCase();
  const data = text.includes('데이터') || text.includes('data') || text.includes('결론');
  const schedule = text.includes('일정') || text.includes('schedule') || text.includes('우선순위');
  const apology = text.includes('사과') || text.includes('미안') || text.includes('선을 넘');

  if (data) {
    return {
      situation: 'A coworker asks whether the current data is enough to make a decision.',
      target: 'I think it’s still too early to draw a conclusion because we don’t have enough data yet.',
      alternatives: ['We probably need more data before drawing any conclusions.', 'I’d hold off until we have enough evidence.'],
      followUp: 'What additional data do you think we need?',
      chunks: ['too early to', 'draw a conclusion', 'enough data'],
      variants: ['검증이 끝나지 않아 아직 결론 내리기 어렵다고 말하세요.', '이제 정보가 충분해서 결론을 내려도 된다고 말하세요.'],
    };
  }

  if (schedule) {
    return {
      situation: 'A teammate asks whether the current timeline still looks realistic.',
      target: 'The schedule looks a little tight, so I think we may need to revisit our priorities.',
      alternatives: ['This timeline feels a bit aggressive.', 'We may need to reprioritize a few things.'],
      followUp: 'What would you suggest we change first?',
      chunks: ['looks tight', 'revisit our priorities', 'reprioritize'],
      variants: ['일정은 가능하지만 업무 범위를 줄여야 한다고 말하세요.', '상대방이 어떤 우선순위를 바꿀지 묻습니다.'],
    };
  }

  if (apology) {
    return {
      situation: 'You realize you put someone in an uncomfortable position during a meeting.',
      target: 'I’m sorry. I didn’t mean to put you on the spot.',
      alternatives: ['I didn’t mean to make things awkward for you.', 'Sorry if that question put you in a difficult position.'],
      followUp: 'How would you handle that next time?',
      chunks: ['didn’t mean to', 'put you on the spot', 'make things awkward'],
      variants: ['질문이 너무 갑작스러웠다면 미안하다고 말하세요.', '다음에는 미리 공유하겠다고 덧붙이세요.'],
    };
  }

  return {
    situation: form.situation || 'Someone asks for your opinion in a real conversation.',
    target: 'I want to be careful about how I say this, but I think we should talk through it once more.',
    alternatives: ['Could we revisit this before deciding?', 'I’m not fully comfortable moving forward yet.'],
    followUp: 'What part would you like to revisit?',
    chunks: ['be careful about', 'talk through it', 'revisit this'],
    variants: ['결정하기 전에 한 번 더 이야기하고 싶다고 말하세요.', '상대방이 어떤 부분이 불편한지 묻습니다.'],
  };
}

function generateCard(form) {
  const draft = createDraft(form);
  return {
    id: crypto.randomUUID(),
    prompt: form.situation || form.intent,
    intent: form.intent,
    attempt: form.attempt,
    tag: form.tag,
    level: 1,
    dueAt: today,
    createdAt: today,
    history: [],
    ...draft,
  };
}

function shell(content) {
  $('#root').innerHTML = `<div class="app">
    <header>
      <div><p class="eyebrow">Speaking Gap</p><h1>못 했던 말을 다음엔 바로 꺼내는 훈련</h1></div>
      <button data-tab="save" class="primary">＋ 방금 못 한 말 저장</button>
    </header>
    <nav>${[['home', '홈'], ['review', '오늘 복습'], ['mission', '실전 대화'], ['library', '표현 보관함']].map(([id, label]) => `<button data-tab="${id}" class="${state.tab === id ? 'on' : ''}">${label}</button>`).join('')}</nav>
    ${content}
  </div>`;
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.onclick = () => {
      state = { ...state, tab: button.dataset.tab, answer: '', repeatAnswer: '', revealed: false, repeat: false, hintLevel: 0, startedAt: 0 };
      render();
    };
  });
}

function render() {
  const due = dueCards();
  if (state.tab === 'save') return renderSave();
  if (state.tab === 'review') return renderReview();
  if (state.tab === 'mission') return renderMission(due.length ? due : state.cards);
  if (state.tab === 'library') return renderLibrary();
  shell(`<main class="grid">
    <section class="hero"><h2>오늘 복습할 말 ${due.length}개</h2><p>문장이 아니라 “그 상황에서 하고 싶었던 말”을 저장하고, 정답을 가린 채 다시 말합니다.</p><button data-tab="review" class="primary">🎙️ 오늘 복습 시작</button></section>
    <section class="panel"><h2>⏰ 최근 저장한 못 한 말</h2>${state.cards.slice(0, 3).map((c) => `<p>${esc(c.intent)}</p>`).join('')}</section>
    <section class="panel"><h2>🔁 다음 단계</h2><ol><li>힌트 없이 시작 시간 측정</li><li>핵심 표현 조각 확인</li><li>수정 문장 다시 말하기</li><li>변형 상황으로 한 번 더 조립</li></ol></section>
  </main>`);
}

function renderSave() {
  shell(`<main><section class="panel"><h2>✨ 이걸 어떻게 말하지?</h2>
    <label>어떤 상황이었나요?<textarea id="situation" placeholder="예: 오늘 회의에서 PM이 일정 가능 여부를 물어봄"></textarea></label>
    <label>무슨 말을 하고 싶었나요?<textarea id="intent" placeholder="한국어로 대충 적어도 됩니다"></textarea></label>
    <label>실제로 영어로 어떻게 말했나요? (선택)<textarea id="attempt"></textarea></label>
    <label>태그<select id="tag"><option>업무</option><option>일상</option><option>여행</option><option>감정</option><option>의견</option></select></label>
    <div id="draft"></div>
  </section></main>`);
  ['situation', 'intent', 'attempt', 'tag'].forEach((id) => { $(`#${id}`).oninput = updateDraft; });
}

function updateDraft() {
  const form = { situation: $('#situation').value, intent: $('#intent').value, attempt: $('#attempt').value, tag: $('#tag').value };
  if (!form.intent.trim()) {
    $('#draft').innerHTML = '<p class="muted">말하고 싶었던 내용을 입력하면 기본 표현 1개와 대안 2개만 제안합니다.</p>';
    return;
  }
  const draft = generateCard(form);
  $('#draft').innerHTML = `<div class="recommend"><b>AI 추천 기본 표현</b><p>${esc(draft.target)}</p><small>대안: ${draft.alternatives.map(esc).join(' / ')}</small><p class="chips">${draft.chunks.map((chunk) => `<span>${esc(chunk)}</span>`).join('')}</p><button id="save-card" class="primary">내 기본 표현으로 저장</button></div>`;
  $('#save-card').onclick = () => {
    state.cards = [draft, ...state.cards];
    persist();
    state.tab = 'review';
    render();
  };
}

function renderReview() {
  const due = dueCards();
  const card = due[state.active % Math.max(due.length, 1)];
  if (!card) return shell('<main><section class="panel"><h2>오늘 복습 완료</h2><p>새로운 “못 한 말”을 저장하거나 실전 대화 테스트를 해보세요.</p></section></main>');
  if (!state.startedAt) state.startedAt = Date.now();
  const hint = state.hintLevel === 0 ? '' : `<div class="hint"><b>힌트 ${state.hintLevel}</b><p>${state.hintLevel === 1 ? esc(card.chunks.join(' · ')) : esc(card.target.replace(/[A-Za-z]/g, '_'))}</p></div>`;
  shell(`<main><section class="review"><p class="eyebrow">상황 시뮬레이션 · Level ${card.level}</p><h2>${esc(card.prompt)}</h2><div class="timer">준비 5초 → 도움 없이 말하기</div>${hint}
    <div class="actions"><button id="hint">힌트 보기</button><button id="voice">🎙️ 음성 입력 시작</button></div>
    <textarea id="answer" placeholder="음성 인식 결과가 여기에 들어옵니다. 지금은 직접 입력해 테스트하세요.">${esc(state.answer)}</textarea>
    <button id="reveal" class="primary">말하기 완료 / 피드백 보기</button><div id="feedback"></div></section></main>`);
  $('#answer').oninput = (event) => { state.answer = event.target.value; };
  $('#hint').onclick = () => { state.hintLevel = Math.min(2, state.hintLevel + 1); renderReview(); };
  $('#voice').onclick = startSpeechRecognition;
  $('#reveal').onclick = () => { state.revealed = true; showFeedback(card); };
  if (state.revealed) showFeedback(card);
}

function scoreAnswer(card) {
  const elapsed = (Date.now() - state.startedAt) / 1000;
  const words = state.answer.toLowerCase();
  const matchedChunks = card.chunks.filter((chunk) => words.includes(chunk.split(' ')[0].toLowerCase()));
  const meaningOk = state.answer.length > 24 && matchedChunks.length > 0;
  const recommended = !state.answer.trim() ? 'Again' : state.hintLevel || elapsed > 8 ? 'Hard' : meaningOk && elapsed < 6 ? 'Easy' : meaningOk ? 'Good' : 'Hard';
  return { elapsed, matchedChunks, meaningOk, recommended };
}

function showFeedback(card) {
  const score = scoreAnswer(card);
  const variant = card.variants[(card.history.length + state.hintLevel) % card.variants.length];
  $('#feedback').innerHTML = `<div class="feedback"><b>${score.meaningOk ? '의미 전달 성공' : '핵심 의미가 아직 부족해요'}</b>
    <p>추천 평가: <strong>${score.recommended}</strong> · 말이 나오기까지 ${score.elapsed.toFixed(1)}초 · 힌트 ${state.hintLevel}회</p>
    <p>자연스러운 답변: ${esc(card.target)}</p>
    <p>차이 한 가지: 다음 발화에서는 <strong>${esc(card.chunks[1] || card.chunks[0])}</strong> 표현을 먼저 떠올려 보세요.</p>
    <p class="variant">변형 말하기: ${esc(variant)}</p>
    ${state.repeat ? `<textarea id="repeat-answer" placeholder="수정된 표현이나 변형 답변을 한 번 더 말한 결과">${esc(state.repeatAnswer)}</textarea><div class="ratings">${Object.keys(ratings).map((rating) => `<button data-rate="${rating}" class="${rating === score.recommended ? 'suggested' : ''}">${rating}<small>${ratings[rating].label}</small></button>`).join('')}</div>` : '<button id="repeat" class="primary">수정된 문장 다시 말하기</button>'}
  </div>`;
  const repeat = $('#repeat');
  if (repeat) repeat.onclick = () => { state.repeat = true; showFeedback(card); };
  const repeatAnswer = $('#repeat-answer');
  if (repeatAnswer) repeatAnswer.oninput = (event) => { state.repeatAnswer = event.target.value; };
  document.querySelectorAll('[data-rate]').forEach((button) => { button.onclick = () => rate(card, button.dataset.rate, score); });
}

function rate(card, rating, score) {
  const schedule = ratings[rating];
  state.cards = state.cards.map((candidate) => candidate.id === card.id ? {
    ...candidate,
    level: Math.max(1, candidate.level + schedule.delta),
    dueAt: addDays(schedule.days),
    history: [...candidate.history, { rating, answer: state.answer, repeatAnswer: state.repeatAnswer, elapsed: score.elapsed, hintLevel: state.hintLevel, at: nowIso() }],
  } : candidate);
  state.active += 1;
  state.answer = '';
  state.repeatAnswer = '';
  state.revealed = false;
  state.repeat = false;
  state.hintLevel = 0;
  state.startedAt = 0;
  persist();
  renderReview();
}

function startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('이 브라우저는 Web Speech API를 지원하지 않습니다. 직접 입력으로 테스트하세요.');
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    state.answer = event.results[0][0].transcript;
    renderReview();
  };
  recognition.start();
}

function renderMission(cards) {
  shell(`<main><section class="panel"><h2>💬 Targeted Conversation</h2><p>오늘 목표 표현 ${Math.min(cards.length, 3)}개를 실제 대화 속에서 꺼내는 최종 테스트입니다.</p>${cards.slice(0, 3).map((card, index) => `<div class="mission"><b>AI ${index + 1}: ${index === 0 ? 'Based on the current situation, should we decide today?' : esc(card.followUp)}</b><p>목표 표현: ${esc(card.target)}</p><p class="chips">${card.chunks.map((chunk) => `<span>${esc(chunk)}</span>`).join('')}</p></div>`).join('')}</section></main>`);
}

function renderLibrary() {
  const query = state.libraryQuery.toLowerCase();
  const filtered = state.cards
    .filter((card) => state.libraryFilter === 'all' || (state.libraryFilter === 'due' ? new Date(card.dueAt) <= new Date() : card.tag === state.libraryFilter))
    .filter((card) => [card.intent, card.target, card.prompt, card.tag].join(' ').toLowerCase().includes(query))
    .sort((a, b) => state.librarySort === 'new' ? new Date(b.createdAt) - new Date(a.createdAt) : new Date(a.dueAt) - new Date(b.dueAt));
  shell(`<main><section class="panel"><h2>📚 표현 보관함</h2><div class="toolbar"><input id="library-query" placeholder="검색" value="${esc(state.libraryQuery)}"><select id="library-filter"><option value="all">전체</option><option value="due">Due</option>${['업무', '일상', '여행', '감정', '의견'].map((tag) => `<option ${state.libraryFilter === tag ? 'selected' : ''}>${tag}</option>`).join('')}</select><select id="library-sort"><option value="due">복습 예정순</option><option value="new" ${state.librarySort === 'new' ? 'selected' : ''}>최신순</option></select></div>${filtered.map((card) => `<article class="item"><span>🏷️ ${esc(card.tag)}</span><h3>${esc(card.intent)}</h3><p>${esc(card.target)}</p><small>Level ${card.level} · Due ${new Date(card.dueAt).toLocaleDateString()} · Reviews ${card.history.length}</small></article>`).join('') || '<p>검색 결과가 없습니다.</p>'}</section></main>`);
  $('#library-query').oninput = (event) => { state.libraryQuery = event.target.value; renderLibrary(); };
  $('#library-filter').onchange = (event) => { state.libraryFilter = event.target.value; renderLibrary(); };
  $('#library-sort').onchange = (event) => { state.librarySort = event.target.value; renderLibrary(); };
}

render();
