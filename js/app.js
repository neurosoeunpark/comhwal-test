/* 컴활 1급 필기 학습 앱
 * - data/subjects.json 에 과목을 등록하고, 과목별 장(chapter) JSON 파일을 불러온다.
 * - 학습 상태는 localStorage 에 저장한다.
 */
(() => {
  'use strict';

  const STORE_KEY = 'comhwal.v1';
  const $app = document.getElementById('app');
  const $title = document.getElementById('pageTitle');
  const $back = document.getElementById('backBtn');
  const $right = document.getElementById('topbarRight');
  const $badge = document.getElementById('wrongBadge');

  /* ---------------- 저장소 ---------------- */
  const blank = () => ({ done: {}, ans: {}, note: {}, subject: null, theme: 'system', random: {} });
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? Object.assign(blank(), JSON.parse(raw)) : blank();
    } catch (e) { return blank(); }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가 환경 */ }
    updateBadge();
  }

  /* ---------------- 데이터 ---------------- */
  const DB = { subjects: [], loaded: {}, sec: {}, q: {} };

  async function fetchJSON(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  }

  async function loadSubjects() {
    const idx = await fetchJSON('data/subjects.json');
    DB.subjects = idx.subjects;
    if (!S.subject || !DB.subjects.find(s => s.id === S.subject && s.chapters.length)) {
      S.subject = (DB.subjects.find(s => s.chapters.length) || DB.subjects[0]).id;
    }
  }

  async function loadSubject(id) {
    if (DB.loaded[id]) return DB.loaded[id];
    const subj = DB.subjects.find(s => s.id === id);
    const chapters = await Promise.all(subj.chapters.map(fetchJSON));
    chapters.sort((a, b) => a.number - b.number);
    for (const ch of chapters) {
      ch.subject = id;
      for (const sec of ch.sections) {
        sec.chapter = ch;
        sec.subject = id;
        DB.sec[sec.id] = sec;
        for (const q of sec.quizzes || []) {
          q.section = sec;
          DB.q[q.id] = q;
        }
      }
    }
    DB.loaded[id] = chapters;
    return chapters;
  }
  const loadAll = () => Promise.all(DB.subjects.filter(s => s.chapters.length).map(s => loadSubject(s.id)));
  const subjName = id => { const s = DB.subjects.find(x => x.id === id); return s ? s.name : ''; };

  /* ---------------- 유틸 ---------------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // **굵게**, ==형광펜== 만 지원하는 최소 마크업
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/==(.+?)==/g, '<mark>$1</mark>');
  // 지문: 빈 줄로 나눈 덩어리마다, 모든 줄이 '|' 또는 두 칸 이상 공백으로 나뉘면 표로, 아니면 줄바꿈·들여쓰기를 살린 글로
  const passageHTML = p => p.split(/\n\s*\n/).map(b => {
    const lines = b.split('\n').filter(l => l.trim());
    const pipe = lines.length > 1 && lines.every(l => l.includes('|'));
    const split = l => pipe ? l.split('|').map(c => c.trim()) : l.replace(/\s+$/, '').split(/\s{2,}/);
    if (lines.length > 1 && (pipe || lines.every(l => split(l).length > 1))) {
      const rows = lines.map(split), n = Math.max(...rows.map(r => r.length));
      return `<div class="p-table"><table>${rows.map(r => `<tr>${Array.from({ length: n }, (_, j) => `<td>${fmt(r[j] || '')}</td>`).join('')}</tr>`).join('')}</table></div>`;
    }
    return `<div class="p-text">${fmt(b.replace(/^\n+|\n+$/g, ''))}</div>`;
  }).join('');
  const CIRCLE = ['①', '②', '③', '④', '⑤'];
  const chev = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const typeTag = q => q.type === 'pred' ? '<span class="tag pred">예상</span>' : '<span class="tag past">기출</span>';
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  function updateBadge() {
    const n = Object.keys(S.note).length;
    $badge.hidden = !n;
    $badge.textContent = n > 99 ? '99+' : n;
  }

  function setChrome({ title = '컴활 1급 필기', back = false, tab = '', right = '' }) {
    $title.textContent = title;
    document.title = title === '컴활 1급 필기' ? title : title + ' · 컴활 1급';
    $back.hidden = !back;
    $right.innerHTML = right;
    document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  }
  $back.addEventListener('click', () => {
    if (history.length > 1) history.back(); else location.hash = '#/';
  });

  function applyTheme() {
    const r = document.documentElement;
    if (S.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.theme);
  }

  /* ---------------- 통계 ---------------- */
  function secStats(sec) {
    const qs = sec.quizzes || [];
    let solved = 0, ok = 0;
    for (const q of qs) { const a = S.ans[q.id]; if (a) { solved++; if (a.ok) ok++; } }
    return { total: qs.length, solved, ok };
  }
  function chaptersStats(chapters) {
    let secs = 0, done = 0, total = 0, solved = 0, ok = 0;
    for (const ch of chapters) for (const sec of ch.sections) {
      secs++; if (S.done[sec.id]) done++;
      const s = secStats(sec); total += s.total; solved += s.solved; ok += s.ok;
    }
    return { secs, done, total, solved, ok };
  }

  function recordAnswer(q, choice) {
    const ok = choice === q.answer;
    const a = S.ans[q.id] || { n: 0, w: 0 };
    a.n++; if (!ok) a.w++;
    a.c = choice; a.ok = ok; a.t = Date.now();
    S.ans[q.id] = a;
    if (!ok) S.note[q.id] = S.note[q.id] || Date.now();
    save();
    return ok;
  }

  /* ---------------- 라우터 ---------------- */
  function parseHash() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = h.split('?');
    return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs || '') };
  }

  let cleanup = null;
  async function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    const { parts, query } = parseHash();
    try {
      if (!DB.subjects.length) await loadSubjects();
      const [p0, p1] = parts;
      if (!p0) await viewHome();
      else if (p0 === 'sec' && p1) await viewSection(p1, query);
      else if (p0 === 'wrong') await viewWrong(query);
      else if (p0 === 'random') await viewRandom();
      else if (p0 === 'play') await viewPlay(p1);
      else if (p0 === 'settings') await viewSettings();
      else location.hash = '#/';
    } catch (e) {
      console.error(e);
      $app.innerHTML = `<div class="empty"><div class="big">⚠️</div>데이터를 불러오지 못했어요.<br><span class="small">${esc(e.message)}</span></div>`;
    }
  }
  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });

  /* ---------------- 홈(목차) ---------------- */
  async function viewHome() {
    setChrome({ tab: 'home' });
    const chapters = await loadSubject(S.subject);
    const st = chaptersStats(chapters);
    const openKey = 'comhwal.open.' + S.subject;
    let opened = [];
    try { opened = JSON.parse(sessionStorage.getItem(openKey) || '[]'); } catch (e) { }

    const subjTabs = DB.subjects.map(s =>
      `<button class="chip ${s.id === S.subject ? 'on' : ''}" data-subj="${s.id}" ${s.chapters.length ? '' : 'disabled'}>${esc(s.short || s.name)}${s.chapters.length ? '' : ' · 준비 중'}</button>`).join('');

    const chHtml = chapters.map(ch => {
      const cs = chaptersStats([ch]);
      const secs = ch.sections.map(sec => {
        const s = secStats(sec);
        return `<a class="sec-item" href="#/sec/${sec.id}">
          <span class="sec-no">${esc(sec.number)}</span>
          <div class="grow">
            <div class="sec-title">${esc(sec.title)}</div>
            <div class="sec-meta">${sec.grade ? `<span class="grade ${sec.grade}">${sec.grade}</span>` : ''}<span>문제 ${s.solved}/${s.total}</span>${s.solved ? `<span>정답률 ${pct(s.ok, s.solved)}%</span>` : ''}</div>
          </div>
          <span class="check ${S.done[sec.id] ? 'on' : ''}"></span>
        </a>`;
      }).join('');
      return `<details class="card chapter" data-ch="${ch.id}" ${opened.includes(ch.id) ? 'open' : ''}>
        <summary>
          <span class="ch-num">${ch.number}</span>
          <div class="grow"><div class="ch-title">${esc(ch.title)}</div>
            <div class="ch-meta">섹션 ${cs.done}/${cs.secs} 완료 · 문제 ${cs.solved}/${cs.total}</div></div>
          ${chev}
        </summary>
        <div class="sec-list">${secs}</div>
      </details>`;
    }).join('');

    $app.innerHTML = `
      <div class="subject-tabs">${subjTabs}</div>
      <h1 class="h1">${esc(subjName(S.subject))}</h1>
      <p class="sub">섹션을 골라 핵심 요약을 읽고 기출문제를 풀어보세요.</p>
      <div class="overview">
        <div class="stat"><div class="l">학습 완료</div><div class="v">${st.done}<span class="muted small">/${st.secs}</span></div><div class="bar"><i style="width:${pct(st.done, st.secs)}%"></i></div></div>
        <div class="stat"><div class="l">푼 문제</div><div class="v">${st.solved}<span class="muted small">/${st.total}</span></div><div class="bar"><i style="width:${pct(st.solved, st.total)}%"></i></div></div>
        <div class="stat"><div class="l">정답률</div><div class="v">${st.solved ? pct(st.ok, st.solved) + '%' : '–'}</div><div class="bar"><i style="width:${pct(st.ok, st.solved)}%;background:var(--ok)"></i></div></div>
      </div>
      ${continueCard(chapters)}
      ${chHtml}`;

    $app.querySelectorAll('[data-subj]').forEach(b => b.addEventListener('click', () => {
      S.subject = b.dataset.subj; save(); route();
    }));
    $app.querySelectorAll('details.chapter').forEach(d => d.addEventListener('toggle', () => {
      const ids = [...$app.querySelectorAll('details.chapter[open]')].map(x => x.dataset.ch);
      try { sessionStorage.setItem(openKey, JSON.stringify(ids)); } catch (e) { }
    }));
  }

  function continueCard(chapters) {
    const all = chapters.flatMap(c => c.sections);
    const next = all.find(s => !S.done[s.id]);
    if (!next) return '';
    return `<a class="card row" href="#/sec/${next.id}" style="margin-top:12px">
      <div class="grow"><div class="small muted" style="font-weight:700">이어서 학습하기</div>
      <div style="font-weight:700">${esc(next.number)}. ${esc(next.title)}</div></div>${chev}</a>`;
  }

  /* ---------------- 섹션 ---------------- */
  const secSession = {}; // 섹션별 현재 풀이 세션 (페이지 이동 사이 유지)

  async function viewSection(id, query) {
    await loadAll();
    const sec = DB.sec[id];
    if (!sec) { location.hash = '#/'; return; }
    if (sec.subject !== S.subject) { S.subject = sec.subject; save(); }
    const tab = query.get('tab') === 'quiz' ? 'quiz' : 'sum';
    setChrome({ title: `${sec.number}. ${sec.title}`, back: true, tab: 'home' });

    const all = flatSections();
    const i = all.indexOf(sec);
    const prev = all[i - 1], next = all[i + 1];

    $app.innerHTML = `
      <div class="sec-head">
        <div class="no">${esc(sec.chapter.number)}장 ${esc(sec.chapter.title)} · SECTION ${esc(sec.number)} ${sec.grade ? `<span class="grade ${sec.grade}">${sec.grade}등급</span>` : ''}</div>
        <h1 class="h1">${esc(sec.title)}</h1>
      </div>
      <div class="seg" role="tablist">
        <button data-tab="sum" class="${tab === 'sum' ? 'on' : ''}" role="tab">핵심 요약</button>
        <button data-tab="quiz" class="${tab === 'quiz' ? 'on' : ''}" role="tab">문제 풀기 <span class="muted">${(sec.quizzes || []).length}</span></button>
      </div>
      <div id="secBody"></div>`;

    $app.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
      history.replaceState(null, '', `#/sec/${id}?tab=${b.dataset.tab}`);
      $app.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b));
      render(b.dataset.tab);
      const seg = $app.querySelector('.seg');
      if (seg.getBoundingClientRect().top < 60) window.scrollTo(0, 0);
    }));

    const body = $app.querySelector('#secBody');
    function render(t) {
      if (cleanup) { cleanup(); cleanup = null; }
      if (t === 'sum') renderSummary(body, sec, prev, next);
      else {
        const sess = secSession[id] || (secSession[id] = { idx: 0, picks: {}, filter: 'all' });
        renderSectionQuiz(body, sec, sess);
      }
    }
    render(tab);
  }

  function flatSections() {
    return DB.loaded[S.subject] ? DB.loaded[S.subject].flatMap(c => c.sections) : [];
  }

  function renderSummary(body, sec, prev, next) {
    const blocks = (sec.summary || []).map(b => `
      <section class="card sum-card">
        ${b.h ? `<h3>${fmt(b.h)}</h3>` : ''}
        <ul>${(b.items || []).map(li).join('')}</ul>
      </section>`).join('');
    const done = !!S.done[sec.id];
    body.innerHTML = `
      ${(sec.key_terms || []).length ? `<div class="terms" style="margin-bottom:14px">${sec.key_terms.map(t => `<span class="term">#${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="stack">${blocks || '<div class="empty">요약이 아직 없어요.</div>'}</div>
      <div class="stack" style="margin-top:18px">
        <button class="btn block ${done ? 'ok' : ''}" id="doneBtn">${done ? '✓ 학습 완료' : '학습 완료로 표시'}</button>
        ${(sec.quizzes || []).length ? `<a class="btn primary block" href="#/sec/${sec.id}?tab=quiz" id="toQuiz">문제 풀러 가기 (${sec.quizzes.length})</a>` : ''}
        <div class="btn-row">
          ${prev ? `<a class="btn sm" href="#/sec/${prev.id}">‹ ${esc(prev.number)}</a>` : '<span></span>'}
          ${next ? `<a class="btn sm" href="#/sec/${next.id}">${esc(next.number)} ›</a>` : '<span></span>'}
        </div>
      </div>`;
    body.querySelector('#doneBtn').addEventListener('click', e => {
      if (S.done[sec.id]) delete S.done[sec.id]; else S.done[sec.id] = Date.now();
      save();
      const on = !!S.done[sec.id];
      e.currentTarget.classList.toggle('ok', on);
      e.currentTarget.textContent = on ? '✓ 학습 완료' : '학습 완료로 표시';
      if (on) toast('학습 완료! 진도율에 반영했어요.');
    });
    const tq = body.querySelector('#toQuiz');
    if (tq) tq.addEventListener('click', e => {
      e.preventDefault();
      $app.querySelector('.seg button[data-tab="quiz"]').click();
    });
  }
  function li(it) {
    if (typeof it === 'string') return `<li>${fmt(it)}</li>`;
    return `<li>${fmt(it.t)}${it.sub ? `<ul>${it.sub.map(li).join('')}</ul>` : ''}</li>`;
  }

  function renderSectionQuiz(body, sec, sess) {
    const allQ = sec.quizzes || [];
    const hasPred = allQ.some(q => q.type === 'pred');
    const list = () => allQ.filter(q => sess.filter === 'all' || (sess.filter === 'pred' ? q.type === 'pred' : q.type !== 'pred'));
    const top = el => {
      if (!hasPred) return;
      const f = document.createElement('div');
      f.className = 'filter';
      const cnt = t => allQ.filter(q => t === 'all' || (t === 'pred' ? q.type === 'pred' : q.type !== 'pred')).length;
      f.innerHTML = [['all', '전체'], ['past', '기출'], ['pred', '예상']].map(([k, l]) =>
        `<button class="chip ${sess.filter === k ? 'on' : ''}" data-f="${k}">${l} ${cnt(k)}</button>`).join('');
      f.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        sess.filter = b.dataset.f; sess.idx = 0; renderSectionQuiz(body, sec, sess);
      }));
      el.prepend(f);
    };
    mountQuiz(body, list(), sess, { header: top, doneText: '섹션 문제를 모두 풀었어요' });
  }

  /* ---------------- 공용 퀴즈 엔진 ---------------- */
  // sess: { idx, picks: {qid: choice} }
  function mountQuiz(body, qs, sess, opts = {}) {
    if (!qs.length) { body.innerHTML = `<div class="empty"><div class="big">📭</div>${opts.emptyText || '문제가 없어요.'}</div>`; return; }
    if (sess.idx > qs.length) sess.idx = 0;

    function draw() {
      if (sess.idx >= qs.length) return drawScore();
      const q = qs[sess.idx];
      const pick = sess.picks[q.id];
      const answered = pick != null;
      const inNote = !!S.note[q.id];
      const rec = S.ans[q.id];
      const solvedN = qs.filter(x => sess.picks[x.id] != null).length;

      const optsHtml = q.options.map((o, k) => {
        const n = k + 1;
        let cls = '';
        if (answered) {
          if (n === q.answer) cls = 'correct';
          else if (n === pick) cls = 'wrong';
          else cls = 'dim';
        }
        return `<button class="opt ${cls}" data-n="${n}" ${answered ? 'disabled' : ''}><span class="n">${n}</span><span>${fmt(o)}</span></button>`;
      }).join('');

      const ok = answered && pick === q.answer;
      body.innerHTML = `
        <div class="card">
          <div class="q-top">
            <span class="q-count">${sess.idx + 1} / ${qs.length}</span>
            ${typeTag(q)}
            ${q.source ? `<span class="tag">${esc(q.source)}</span>` : ''}
            ${opts.showSection ? `<a class="tag" href="#/sec/${q.section.id}">${esc(q.section.number)} ${esc(q.section.title)}</a>` : ''}
            ${rec && !answered ? `<span class="small muted" style="margin-left:auto">이전: ${rec.ok ? '<span style="color:var(--ok)">정답</span>' : '<span style="color:var(--bad)">오답</span>'}${rec.w ? ` · 오답 ${rec.w}회` : ''}</span>` : ''}
          </div>
          <div class="q-progress"><i style="width:${pct(solvedN, qs.length)}%"></i></div>
          <p class="q-text">${fmt(q.question)}</p>
          ${q.passage ? `<div class="q-passage">${passageHTML(q.passage)}</div>` : ''}
          <div class="opts">${optsHtml}</div>
          ${answered ? `
            <details class="result ${ok ? 'ok' : 'bad'}" open>
              <summary>${ok ? '정답입니다!' : `오답이에요 · 정답 ${CIRCLE[q.answer - 1]}`}${chev}</summary>
              <div class="explain">${fmt(q.explanation)}</div>
            </details>` : ''}
          <div class="q-actions">
            <button class="btn sm toggle-note ${inNote ? 'on' : ''}" id="noteBtn">${inNote ? '★ 오답노트에 있음 (제외)' : '☆ 오답노트에 추가'}</button>
            ${answered ? '<button class="btn sm" id="retryBtn">다시 풀기</button>' : ''}
          </div>
        </div>
        <div class="q-nav">
          <button class="btn" id="prevBtn" ${sess.idx === 0 ? 'disabled style="opacity:.4"' : ''}>이전</button>
          <button class="btn ${answered ? 'primary' : ''}" id="nextBtn">${sess.idx === qs.length - 1 ? '결과 보기' : '다음'}</button>
        </div>
        <div class="dots">${qs.map((x, k) => {
          const p = sess.picks[x.id];
          const c = p == null ? '' : (p === x.answer ? 'ok' : 'bad');
          return `<button class="dot ${c} ${k === sess.idx ? 'cur' : ''}" data-i="${k}">${k + 1}</button>`;
        }).join('')}</div>`;

      if (opts.header) opts.header(body);

      body.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => choose(+b.dataset.n)));
      body.querySelector('#noteBtn').addEventListener('click', () => {
        if (S.note[q.id]) { delete S.note[q.id]; toast('오답노트에서 제외했어요'); }
        else { S.note[q.id] = Date.now(); toast('오답노트에 추가했어요'); }
        save(); draw();
      });
      const rb = body.querySelector('#retryBtn');
      if (rb) rb.addEventListener('click', () => { delete sess.picks[q.id]; draw(); });
      body.querySelector('#prevBtn').addEventListener('click', () => go(sess.idx - 1));
      body.querySelector('#nextBtn').addEventListener('click', () => go(sess.idx + 1));
      body.querySelectorAll('.dot').forEach(d => d.addEventListener('click', () => go(+d.dataset.i)));

      if (answered) {
        const r = body.querySelector('.result');
        if (r && r.getBoundingClientRect().bottom > window.innerHeight) {
          r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }

    function choose(n) {
      const q = qs[sess.idx];
      if (!q || sess.picks[q.id] != null) return;
      sess.picks[q.id] = n;
      recordAnswer(q, n);
      if (opts.onAnswer) opts.onAnswer(q, n);
      draw();
    }
    function go(i) {
      if (i < 0 || i > qs.length) return;
      sess.idx = i;
      if (opts.onMove) opts.onMove();
      draw();
      const top = body.getBoundingClientRect().top + window.scrollY - 130;
      if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top) });
    }

    function drawScore() {
      const answered = qs.filter(q => sess.picks[q.id] != null);
      const ok = answered.filter(q => sess.picks[q.id] === q.answer).length;
      const wrong = answered.filter(q => sess.picks[q.id] !== q.answer);
      body.innerHTML = `
        <div class="card score">
          <div class="muted small" style="font-weight:700">${opts.doneText || '풀이 완료'}</div>
          <div class="big">${ok} <span class="muted" style="font-size:22px">/ ${qs.length}</span></div>
          <div class="muted">정답률 ${pct(ok, answered.length)}% · 안 푼 문제 ${qs.length - answered.length}개</div>
          <div class="bar" style="margin:14px auto 0;max-width:260px"><i style="width:${pct(ok, qs.length)}%;background:var(--ok)"></i></div>
        </div>
        <div class="stack" style="margin-top:12px">
          ${wrong.length ? `<button class="btn primary block" id="wrongOnly">틀린 ${wrong.length}문제만 다시 풀기</button>` : ''}
          <button class="btn block" id="again">처음부터 다시 풀기</button>
          <button class="btn block" id="review">문제 다시 보기</button>
        </div>
        ${opts.after || ''}`;
      if (opts.header) opts.header(body);
      const wo = body.querySelector('#wrongOnly');
      if (wo) wo.addEventListener('click', () => {
        startPlay('retry', wrong.map(q => q.id), '틀린 문제 다시 풀기');
      });
      body.querySelector('#again').addEventListener('click', () => { sess.picks = {}; sess.idx = 0; if (opts.onMove) opts.onMove(); draw(); });
      body.querySelector('#review').addEventListener('click', () => go(0));
    }

    const onKey = e => {
      if (e.target.matches('input, textarea, select')) return;
      if (/^[1-4]$/.test(e.key)) choose(+e.key);
      else if (e.key === 'ArrowRight') go(sess.idx + 1);
      else if (e.key === 'ArrowLeft') go(sess.idx - 1);
    };
    document.addEventListener('keydown', onKey);
    cleanup = () => document.removeEventListener('keydown', onKey);
    draw();
  }

  /* ---------------- 세션 풀이 (오답노트/랜덤) ---------------- */
  function startPlay(mode, ids, title) {
    const sess = { ids, title, idx: 0, picks: {} };
    try { sessionStorage.setItem('comhwal.play.' + mode, JSON.stringify(sess)); } catch (e) { }
    playMem[mode] = sess;
    if (location.hash === '#/play/' + mode) route(); else location.hash = '#/play/' + mode;
  }
  const playMem = {};

  async function viewPlay(mode) {
    await loadAll();
    let sess = playMem[mode];
    if (!sess) { try { sess = JSON.parse(sessionStorage.getItem('comhwal.play.' + mode) || 'null'); } catch (e) { } }
    if (!sess) { location.hash = mode === 'random' ? '#/random' : '#/wrong'; return; }
    playMem[mode] = sess;
    const tab = mode === 'random' ? 'random' : 'wrong';
    setChrome({ title: sess.title || '문제 풀이', back: true, tab });
    const qs = sess.ids.map(id => DB.q[id]).filter(Boolean);
    const persist = () => { try { sessionStorage.setItem('comhwal.play.' + mode, JSON.stringify(sess)); } catch (e) { } };
    $app.innerHTML = '<div id="playBody"></div>';
    mountQuiz($app.querySelector('#playBody'), qs, sess, {
      showSection: true, onAnswer: persist, onMove: persist,
      doneText: sess.title,
      after: `<a class="btn block ghost" style="margin-top:8px" href="${mode === 'random' ? '#/random' : '#/wrong'}">${mode === 'random' ? '새 랜덤 풀이 만들기' : '오답노트로 돌아가기'}</a>`
    });
  }

  /* ---------------- 오답노트 ---------------- */
  async function viewWrong(query) {
    await loadAll();
    setChrome({ title: '오답노트', tab: 'wrong' });
    const filter = query.get('s') || 'all';
    const ids = Object.keys(S.note).filter(id => DB.q[id]);
    // 데이터에서 사라진 문제는 정리
    Object.keys(S.note).forEach(id => { if (!DB.q[id] && DB.loaded[(id.split('_')[0])]) delete S.note[id]; });
    const items = ids.map(id => DB.q[id])
      .filter(q => filter === 'all' || q.section.subject === filter)
      .sort((a, b) => a.id < b.id ? -1 : 1);

    const subjChips = DB.subjects.filter(s => s.chapters.length).length > 1
      ? `<div class="filter"><a class="chip ${filter === 'all' ? 'on' : ''}" href="#/wrong">전체</a>${DB.subjects.filter(s => s.chapters.length).map(s => `<a class="chip ${filter === s.id ? 'on' : ''}" href="#/wrong?s=${s.id}">${esc(s.short || s.name)}</a>`).join('')}</div>` : '';

    if (!items.length) {
      $app.innerHTML = `<h1 class="h1">오답노트</h1>${subjChips}
        <div class="empty"><div class="big">🎉</div>오답노트가 비어 있어요.<br><span class="small">틀린 문제는 자동으로 여기에 모이고,<br>문제 화면에서 직접 추가할 수도 있어요.</span></div>`;
      return;
    }
    const bySec = {};
    for (const q of items) (bySec[q.section.id] = bySec[q.section.id] || []).push(q);

    $app.innerHTML = `
      <h1 class="h1">오답노트</h1>
      <p class="sub">틀린 문제와 직접 추가한 문제 ${items.length}개</p>
      ${subjChips}
      <div class="btn-row" style="margin-bottom:6px">
        <button class="btn primary" id="playAll">전체 다시 풀기</button>
        <button class="btn" id="playShuffle">섞어서 풀기</button>
      </div>
      ${Object.values(bySec).map(qs => {
        const sec = qs[0].section;
        return `<div class="h2">${esc(sec.number)}. ${esc(sec.title)} <span class="muted">${qs.length}</span></div>
        <div class="stack">${qs.map(q => {
          const a = S.ans[q.id];
          return `<div class="card wn-item">
            <div class="q">${fmt(q.question)}</div>
            <div class="m">${typeTag(q)}${a ? `<span>오답 ${a.w}회 · 최근 ${a.ok ? '<span style="color:var(--ok)">정답</span>' : '<span style="color:var(--bad)">오답</span>'}</span>` : '<span>직접 추가</span>'}
              <span class="grow"></span>
              <button class="btn sm" data-one="${q.id}">풀기</button>
              <button class="btn sm ghost" data-del="${q.id}">제외</button></div>
          </div>`;
        }).join('')}</div>`;
      }).join('')}`;

    const allIds = items.map(q => q.id);
    $app.querySelector('#playAll').addEventListener('click', () => startPlay('wrong', allIds, '오답노트 풀이'));
    $app.querySelector('#playShuffle').addEventListener('click', () => startPlay('wrong', shuffle(allIds), '오답노트 풀이'));
    $app.querySelectorAll('[data-one]').forEach(b => b.addEventListener('click', () => startPlay('wrong', [b.dataset.one], '오답노트 풀이')));
    $app.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      delete S.note[b.dataset.del]; save(); toast('오답노트에서 제외했어요'); route();
    }));
  }

  /* ---------------- 랜덤 풀이 ---------------- */
  async function viewRandom() {
    await loadAll();
    setChrome({ title: '랜덤 풀이', tab: 'random' });
    const cfg = Object.assign({ subject: S.subject, chapter: 'all', type: 'all', status: 'all', count: 20 }, S.random);
    const subjects = DB.subjects.filter(s => s.chapters.length);

    const chapterOptions = sid => (DB.loaded[sid] || []).map(c => `<option value="${c.id}">${c.number}장 ${esc(c.title)}</option>`).join('');
    const chips = (name, list, cur) => `<div class="seg3" data-name="${name}">${list.map(([v, l]) => `<button type="button" class="chip ${String(cur) === String(v) ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;

    $app.innerHTML = `
      <h1 class="h1">랜덤 풀이</h1>
      <p class="sub">범위와 조건을 골라 실전처럼 섞어서 풀어보세요.</p>
      <form class="card" id="rf">
        <div class="field"><label>과목</label>
          <select name="subject">${subjects.map(s => `<option value="${s.id}" ${s.id === cfg.subject ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}${subjects.length > 1 ? `<option value="all" ${cfg.subject === 'all' ? 'selected' : ''}>전 과목</option>` : ''}</select></div>
        <div class="field" id="chField"><label>장</label>
          <select name="chapter"><option value="all">전체</option></select></div>
        <div class="field"><label>문제 유형</label>${chips('type', [['all', '전체'], ['past', '기출'], ['pred', '예상']], cfg.type)}</div>
        <div class="field"><label>풀이 상태</label>${chips('status', [['all', '전체'], ['new', '안 푼 문제'], ['wrong', '틀렸던 문제']], cfg.status)}</div>
        <div class="field"><label>문제 수</label>${chips('count', [[10, '10'], [20, '20'], [40, '40'], [0, '전부']], cfg.count)}</div>
        <div class="muted small" id="avail" style="margin:-4px 0 12px"></div>
        <button class="btn primary block" type="submit">시작하기</button>
      </form>`;

    const f = $app.querySelector('#rf');
    const chSel = f.elements.chapter;
    function fillChapters() {
      const sid = f.elements.subject.value;
      $app.querySelector('#chField').hidden = sid === 'all';
      chSel.innerHTML = '<option value="all">전체</option>' + (sid === 'all' ? '' : chapterOptions(sid));
      chSel.value = [...chSel.options].some(o => o.value === cfg.chapter) ? cfg.chapter : 'all';
    }
    function pool() {
      const sid = f.elements.subject.value;
      let qs = Object.values(DB.q);
      if (sid !== 'all') qs = qs.filter(q => q.section.subject === sid);
      if (sid !== 'all' && chSel.value !== 'all') qs = qs.filter(q => q.section.chapter.id === chSel.value);
      if (cfg.type !== 'all') qs = qs.filter(q => (cfg.type === 'pred') === (q.type === 'pred'));
      if (cfg.status === 'new') qs = qs.filter(q => !S.ans[q.id]);
      if (cfg.status === 'wrong') qs = qs.filter(q => S.ans[q.id] && S.ans[q.id].w > 0);
      return qs;
    }
    function refresh() { $app.querySelector('#avail').textContent = `조건에 맞는 문제 ${pool().length}개`; }
    fillChapters(); refresh();
    f.elements.subject.addEventListener('change', () => { cfg.chapter = 'all'; fillChapters(); refresh(); });
    chSel.addEventListener('change', () => { cfg.chapter = chSel.value; refresh(); });
    f.querySelectorAll('.seg3').forEach(g => g.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      cfg[g.dataset.name] = g.dataset.name === 'count' ? +b.dataset.v : b.dataset.v;
      refresh();
    }));
    f.addEventListener('submit', e => {
      e.preventDefault();
      cfg.subject = f.elements.subject.value; cfg.chapter = chSel.value;
      S.random = cfg; save();
      let qs = shuffle(pool());
      if (!qs.length) { toast('조건에 맞는 문제가 없어요'); return; }
      if (cfg.count) qs = qs.slice(0, cfg.count);
      startPlay('random', qs.map(q => q.id), `랜덤 풀이 ${qs.length}문제`);
    });
  }

  /* ---------------- 설정 ---------------- */
  async function viewSettings() {
    setChrome({ title: '설정', tab: 'settings' });
    const nAns = Object.keys(S.ans).length, nDone = Object.keys(S.done).length, nNote = Object.keys(S.note).length;
    $app.innerHTML = `
      <h1 class="h1">설정</h1>
      <div class="h2">화면 테마</div>
      <div class="card"><div class="seg3" id="theme">${[['system', '시스템 설정'], ['light', '라이트'], ['dark', '다크']].map(([v, l]) =>
        `<button class="chip ${S.theme === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div></div>

      <div class="h2">학습 기록 백업 / 옮기기</div>
      <div class="card">
        <p class="small muted" style="margin:0 0 10px">학습 기록은 이 기기의 브라우저에만 저장돼요. 휴대폰 ↔ 컴퓨터로 옮기려면 백업 코드를 복사해 다른 기기에서 붙여넣으세요.<br>현재: 완료 섹션 ${nDone} · 푼 문제 ${nAns} · 오답노트 ${nNote}</p>
        <textarea id="bk" placeholder="여기에 백업 코드를 붙여넣고 [불러오기]를 누르세요"></textarea>
        <div class="btn-row" style="margin-top:8px">
          <button class="btn sm" id="exp">백업 코드 복사</button>
          <button class="btn sm" id="imp">불러오기</button>
        </div>
      </div>

      <div class="h2">초기화</div>
      <div class="card">
        <button class="btn sm block" id="reset" style="color:var(--bad)">모든 학습 기록 지우기</button>
        <div id="resetConfirm" hidden style="margin-top:10px">
          <p class="small" style="margin:0 0 8px">정말 지울까요? 되돌릴 수 없어요.</p>
          <div class="btn-row"><button class="btn sm" id="resetNo">취소</button><button class="btn sm" id="resetYes" style="background:var(--bad);border-color:var(--bad);color:#fff">지우기</button></div>
        </div>
      </div>
      <p class="small muted" style="text-align:center;margin-top:24px">컴활 1급 필기 학습 앱 · 키보드: 1~4 선택, ←/→ 이동</p>`;

    $app.querySelector('#theme').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      S.theme = b.dataset.v; save(); applyTheme(); viewSettings();
    });
    $app.querySelector('#exp').addEventListener('click', async () => {
      const code = btoa(unescape(encodeURIComponent(JSON.stringify({ app: 'comhwal', v: 1, data: S }))));
      const ta = $app.querySelector('#bk');
      ta.value = code;
      try { await navigator.clipboard.writeText(code); toast('백업 코드를 복사했어요'); }
      catch (e) { ta.select(); toast('코드를 길게 눌러 복사하세요'); }
    });
    $app.querySelector('#imp').addEventListener('click', () => {
      try {
        const obj = JSON.parse(decodeURIComponent(escape(atob($app.querySelector('#bk').value.trim()))));
        if (obj.app !== 'comhwal') throw 0;
        S = Object.assign(blank(), obj.data); save(); applyTheme();
        toast('학습 기록을 불러왔어요'); viewSettings();
      } catch (e) { toast('올바른 백업 코드가 아니에요'); }
    });
    $app.querySelector('#reset').addEventListener('click', () => { $app.querySelector('#resetConfirm').hidden = false; });
    $app.querySelector('#resetNo').addEventListener('click', () => { $app.querySelector('#resetConfirm').hidden = true; });
    $app.querySelector('#resetYes').addEventListener('click', () => {
      const theme = S.theme; S = blank(); S.theme = theme; save();
      Object.keys(secSession).forEach(k => delete secSession[k]);
      toast('학습 기록을 모두 지웠어요'); viewSettings();
    });
  }

  /* ---------------- 시작 ---------------- */
  applyTheme();
  updateBadge();
  route();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }
})();
