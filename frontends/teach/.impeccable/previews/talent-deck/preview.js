const copy = {
  zh: {
    brand: "天赋测试", hall: "挑战大厅", board: "排行榜", preview: "交互预览 · 本次成绩不保存", footer: "从一个小挑战开始。",
    title: "挑一项，看看你的天赋。", intro: "四个小挑战，四种不同的节奏。选一张卡片，开始试试。", play: "试一试", details: "看玩法", close: "返回卡片", previous: "上一个挑战", next: "下一个挑战", chosen: "当前选择", hint: "左右切换，也可以直接点选卡片", rule: "玩法", score: "计分", keys: "操作", go: "开始挑战", back: "返回大厅", again: "再试一次", end: "结束试玩", waiting: "等一等…", green: "现在，点击！", early: "点早了", earlyHint: "点击重试这一轮", sampleHint: "点击进入下一轮", round: "第", rounds: "轮", level: "关卡", watch: "记住亮起的顺序", repeat: "按相同顺序点击", memoryKeys: "数字键 1–9 对应九个格子", memoryEnd: "顺序断在这里", complete: "完成挑战", result: "本次试玩成绩", resultNote: "这是本轮结果。正式测试登录后记录个人最佳。", levels: "关", points: "分", seconds: "秒", correct: "答对", wrong: "答错", inkPrompt: "选择文字显示的颜色", sequencePrompt: "下一项是多少？", correctFeedback: "答对了，继续。", wrongFeedback: "答错了，下一题。", chooseHint: "点击选项，或按数字键 1–4", colors: ["红", "蓝", "绿", "黄"], boardTitle: "每一项，都有自己的排行榜。", boardIntro: "反应力比耗时，其他项目比分数。每位玩家只保留个人最佳。", empty: "你的第一份成绩，还在路上。", emptyNote: "这里预览排行榜的空状态。正式测试完成后，登录账号的最佳成绩会出现在对应项目中。", boardGo: "去试一个挑战", rankRule: "同分并列，展示前 100 位玩家。", bestRule: "反应力取 5 轮平均耗时，越短越好；其他项目取最高成绩。", cell: "格子", interrupted: "试玩已暂停，请重新开始。", invalid: "这一轮再试一次", invalidHint: "点击重新等待绿色信号", switchLanguage: "切换为英文", cardGroup: "选择挑战", backPreview: "玩法示意", memoryDescription: "亮起、熄灭，再按顺序点回来。", reasoningDescription: "从数字之间，找到下一步。", focusDescription: "看清颜色，别被文字带走。", reactionDescription: "等待一个信号，抓住变绿的瞬间。",
  },
  en: {
    brand: "Talent tests", hall: "Challenges", board: "Rankings", preview: "Interactive preview · Scores are not saved", footer: "Start with a small challenge.",
    title: "Pick a challenge. Find your rhythm.", intro: "Four small tests, four different rhythms. Pick a card and give it a try.", play: "Try it", details: "How it works", close: "Back to card", previous: "Previous challenge", next: "Next challenge", chosen: "Selected", hint: "Use the arrows, or pick a card", rule: "Task", score: "Score", keys: "Input", go: "Start challenge", back: "Back to challenges", again: "Try again", end: "End preview", waiting: "Wait for it…", green: "Click now!", early: "Too soon", earlyHint: "Click to retry this round", sampleHint: "Click for the next round", round: "Round", rounds: "", level: "Level", watch: "Watch the sequence", repeat: "Repeat the sequence", memoryKeys: "Keys 1–9 map to the nine cells", memoryEnd: "That broke the sequence", complete: "Challenge complete", result: "Your preview result", resultNote: "This is your result for this round. Sign in to the full test to record a personal best.", levels: "levels", points: "points", seconds: "s", correct: "Correct", wrong: "Wrong", inkPrompt: "Choose the displayed ink color", sequencePrompt: "What comes next?", correctFeedback: "Correct. Keep going.", wrongFeedback: "Not quite. Next question.", chooseHint: "Click a choice, or use keys 1–4", colors: ["Red", "Blue", "Green", "Yellow"], boardTitle: "A separate leaderboard for each test.", boardIntro: "Reaction ranks by time. Other tests rank by score. Each player keeps their personal best.", empty: "Your first result is still ahead of you.", emptyNote: "This is a preview of the empty leaderboard. Your best score appears here after a signed-in test.", boardGo: "Try a challenge", rankRule: "Ties share a rank. The top 100 players are shown.", bestRule: "Reaction uses the average of 5 rounds, with lower times first. Other tests use the highest score.", cell: "Cell", interrupted: "Preview interrupted. Start again when ready.", invalid: "Let's repeat this round", invalidHint: "Click to wait for the green signal again", switchLanguage: "Switch to Chinese", cardGroup: "Choose a challenge", backPreview: "How it looks", memoryDescription: "Watch it light up. Tap it back in order.", reasoningDescription: "Find the next step between the numbers.", focusDescription: "See the color. Ignore the word.", reactionDescription: "Wait for the signal. Catch the instant it turns green.",
  },
};
const games = [
  { id: "reaction", name: ["反应力", "Reaction"], description: "reactionDescription", tags: [["5 轮", "毫秒"], ["5 rounds", "Milliseconds"]], rule: ["背景变绿时立即点击。抢点会重试当前轮。", "Click as soon as the background turns green. Early clicks repeat the round."], score: ["完成 5 轮，取平均耗时。越短越好。", "Complete 5 rounds. Your average time is the score; lower is better."], input: ["点击、空格或 Enter", "Click, Space or Enter"], detail: ["每轮随机等待 2–5 秒。看到绿色信号再点击；提前点击不计入成绩。", "Each round waits a random 2–5 seconds. Click on green. Early clicks do not count."] },
  { id: "memory", name: ["记忆力", "Memory"], description: "memoryDescription", tags: [["九宫格", "顺序记忆"], ["3 × 3 grid", "Sequence"]], rule: ["格子依次亮起，按相同顺序点击。", "Cells flash in sequence. Tap them back in the same order."], score: ["每关增加一个位置。记录完成的最高关卡。", "One position is added per level. Your last completed level is the score."], input: ["点击或数字键 1–9", "Click or keys 1–9"], detail: ["先观察，再输入。亮格阶段不能点击；顺序出错后结束，最多 20 关。", "Watch first, then repeat. Input is disabled during playback. A wrong tap ends the test. Up to 20 levels."] },
  { id: "reasoning", name: ["思考速度", "Thinking speed"], description: "reasoningDescription", tags: [["60 秒", "数字规律"], ["60 seconds", "Number patterns"]], rule: ["观察数字序列，从四个选项中选出下一项。", "Look at the number sequence. Choose the next number from four options."], score: ["答对 +1，答错 −1，最低 0 分。", "Correct +1, wrong −1. Scores never fall below zero."], input: ["点击或数字键 1–4", "Click or keys 1–4"], detail: ["在 60 秒内连续判断。题目包括等差、倍数、递增差值与相邻项求和。", "Keep answering for 60 seconds. Patterns include equal steps, doubling, growing differences and adjacent sums."] },
  { id: "focus", name: ["专注度", "Focus"], description: "focusDescription", tags: [["60 秒", "颜色干扰"], ["60 seconds", "Color interference"]], rule: ["选择文字实际显示的颜色，忽略文字含义。", "Choose the ink color and ignore what the word says."], score: ["答对 +1，答错 −1，最低 0 分。", "Correct +1, wrong −1. Scores never fall below zero."], input: ["点击或数字键 1–4", "Click or keys 1–4"], detail: ["例如“蓝”字显示成红色，就选红色。文字含义与显示颜色随机组合。", "If the word “Blue” is displayed in red, choose red. Words and ink colors are independently chosen."] },
];
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const chevron = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m7 4 6 6-6 6"/></svg>';
const burst = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M24 3v9m0 24v9M3 24h9m24 0h9M9 9l7 7m16 16 7 7m0-30-7 7m-16 16-7 7"/></svg>';
const main = document.querySelector("main");
let locale = "zh", selected = 0, flipped = new Set(), activeGame = null, run = null;
const timers = new Set();
const t = () => copy[locale];
const bi = values => values[locale === "zh" ? 0 : 1];
const rand = n => Math.floor(Math.random() * n);
const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
function stop() { for (const id of timers) clearTimeout(id); timers.clear(); }
function preview(game) {
  if (game.id === "reaction") return `<div class="mini-signal">${burst}</div>`;
  if (game.id === "memory") return `<div class="mini-memory">${"<i></i>".repeat(9)}</div>`;
  if (game.id === "reasoning") return '<div class="mini-sequence"><span>2</span><span>4</span><span>8</span><span>16</span><b>?</b></div>';
  return `<div class="mini-word">${t().colors[1]}</div>`;
}
function setText() {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.title = `${t().brand} · ${locale === "zh" ? "卡片交互预览" : "Card preview"}`;
  document.querySelectorAll("[data-copy]").forEach(el => { el.textContent = t()[el.dataset.copy]; });
  document.querySelector("nav").setAttribute("aria-label", t().brand);
  document.querySelector(".skip").textContent = locale === "zh" ? "跳到内容" : "Skip to content";
  document.querySelector("#language").setAttribute("aria-label", t().switchLanguage);
  document.querySelectorAll("nav a").forEach(a => { if (a.hash === (location.hash === "#board" ? "#board" : "#hall")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
}
function hall() {
  stop(); activeGame = null; run = null; setText();
  main.innerHTML = `<section class="intro"><h1>${t().title}</h1><p>${t().intro}</p></section><section class="deck-shell" aria-label="${t().cardGroup}"><div class="deck">${games.map((game, index) => `<article class="card ${selected === index ? "selected" : ""} ${flipped.has(index) ? "flipped" : ""}" style="--fan:${[-.65,.8,-.6,.65][index]}deg" data-index="${index}" tabindex="0" aria-label="${bi(game.name)}"><div class="card-inner"><div class="face front" aria-hidden="${flipped.has(index)}" ${flipped.has(index) ? "inert" : ""}><h2>${bi(game.name)}</h2><p class="card-description">${t()[game.description]}</p><div class="tags">${bi(game.tags).map(tag => `<span class="tag">${tag}</span>`).join("")}</div><dl class="facts"><div><dt>${t().rule}</dt><dd>${bi(game.rule)}</dd></div><div><dt>${t().score}</dt><dd>${bi(game.score)}</dd></div><div><dt>${t().keys}</dt><dd>${bi(game.input)}</dd></div></dl><div class="card-actions"><button class="button" data-enter="${index}">${t().play}${arrow}</button><button class="text-button" data-flip="${index}">${t().details}</button></div></div><div class="face back" aria-hidden="${!flipped.has(index)}" ${flipped.has(index) ? "" : "inert"}><h2>${bi(game.name)}</h2><div class="mini" aria-hidden="true">${preview(game)}</div><p>${bi(game.detail)}</p><div class="card-actions"><button class="button" data-enter="${index}">${t().play}${arrow}</button><button class="text-button" data-flip="${index}">${t().close}</button></div></div></div></article>`).join("")}</div><button class="pager prev" aria-label="${t().previous}" ${selected === 0 ? "disabled" : ""} style="--dir:-1">${chevron.replace('viewBox="', 'style="transform:rotate(180deg)" viewBox="')}</button><button class="pager next" aria-label="${t().next}" ${selected === 3 ? "disabled" : ""}>${chevron}</button></section><div class="deck-status"><span>${t().hint}</span><div class="dots" role="group" aria-label="${t().cardGroup}">${games.map((game, i) => `<button class="dot" data-select="${i}" aria-pressed="${selected === i}" aria-label="${bi(game.name)}"></button>`).join("")}</div><span id="selected-label" aria-live="polite">${t().chosen} · ${bi(games[selected].name)}</span></div>`;
  main.querySelector(".prev").onclick = () => select(selected - 1);
  main.querySelector(".next").onclick = () => select(selected + 1);
  main.querySelectorAll("[data-enter]").forEach(button => { button.onclick = () => enter(Number(button.dataset.enter)); });
  main.querySelectorAll("[data-select]").forEach(button => { button.onclick = () => select(Number(button.dataset.select)); });
  main.querySelectorAll("[data-flip]").forEach(button => { button.onclick = () => flip(Number(button.dataset.flip)); });
  main.querySelectorAll(".card").forEach(card => { card.onclick = event => { if (!event.target.closest("button")) select(Number(card.dataset.index), false); }; card.onfocus = () => select(Number(card.dataset.index), false); });
  const deck = main.querySelector(".deck");
  deck.addEventListener("scrollend", () => {
    if (deck.scrollWidth <= deck.clientWidth) return;
    const middle = deck.getBoundingClientRect().left + deck.clientWidth / 2;
    let distance = Infinity, index = selected;
    deck.querySelectorAll(".card").forEach((card, i) => { const rect = card.getBoundingClientRect(); const d = Math.abs(rect.left + rect.width / 2 - middle); if (d < distance) { distance = d; index = i; } });
    select(index, false);
  });
  select(selected, true, false);
}
function select(index, scroll = true, animate = true) {
  selected = Math.max(0, Math.min(3, index));
  main.querySelectorAll(".card").forEach((card, i) => card.classList.toggle("selected", selected === i));
  main.querySelectorAll(".dot").forEach((dot, i) => dot.setAttribute("aria-pressed", String(selected === i)));
  main.querySelector(".prev").disabled = selected === 0; main.querySelector(".next").disabled = selected === 3;
  main.querySelector("#selected-label").textContent = `${t().chosen} · ${bi(games[selected].name)}`;
  if (scroll) {
    const deck = main.querySelector(".deck"), card = main.querySelectorAll(".card")[selected];
    deck.scrollTo({ left: card.offsetLeft - (deck.clientWidth - card.offsetWidth) / 2, behavior: !animate || matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
}
function flip(index) {
  select(index, false);
  const card = main.querySelectorAll(".card")[index];
  const showBack = !flipped.has(index); if (showBack) flipped.add(index); else flipped.delete(index);
  card.classList.toggle("flipped", showBack);
  card.querySelector(".front").inert = showBack; card.querySelector(".back").inert = !showBack;
  card.querySelector(".front").setAttribute("aria-hidden", String(showBack)); card.querySelector(".back").setAttribute("aria-hidden", String(!showBack));
  card.querySelector(showBack ? ".back [data-flip]" : ".front [data-flip]").focus({ preventScroll: true });
}
function enter(index) {
  stop(); selected = index; activeGame = games[index]; run = null;
  location.hash = `test-${activeGame.id}`;
  renderGame(); main.querySelector(".go").focus({ preventScroll: true });
}
function renderGame() {
  setText();
  const game = activeGame;
  main.innerHTML = `<section class="workspace"><div class="workspace-bar"><h1>${bi(game.name)}</h1><button class="text-button back-to-hall">${t().back}</button></div><div class="play-surface"></div><div class="play-notes"><p>${bi(game.rule)} ${bi(game.score)}</p><span>${t().preview}</span></div></section>`;
  main.querySelector(".back-to-hall").onclick = () => { location.hash = "hall"; hall(); main.querySelectorAll(".card")[selected].focus({ preventScroll: true }); };
  if (!run) renderReady(); else if (run.result !== undefined) renderResult(); else renderRun();
}
function renderReady(message) {
  const surface = main.querySelector(".play-surface");
  surface.innerHTML = `<div class="mini" aria-hidden="true">${preview(activeGame)}</div><h2>${bi(activeGame.name)}</h2><p ${message ? 'role="status"' : ""}>${message ?? bi(activeGame.detail)}</p><button class="button primary go">${t().go}${arrow}</button>`;
  surface.querySelector(".go").onclick = start;
}
function start() {
  stop();
  run = { phase: "waiting", samples: [], started: performance.now(), result: undefined, count: { correct: 0, wrong: 0 }, level: 1, position: 0, last: 0, lit: -1, watching: true, sequence: Array.from({ length: 20 }, () => rand(9)), question: null, feedback: null };
  if (activeGame.id === "reaction") waitSignal();
  else if (activeGame.id === "memory") flashMemory();
  else { nextQuestion(); renderTimed(); tick(); }
}
function renderRun() {
  if (activeGame.id === "reaction") renderReaction();
  else if (activeGame.id === "memory") renderMemory();
  else renderTimed();
}
function waitSignal() {
  run.phase = "waiting"; renderReaction();
  later(() => { if (!run) return; run.phase = "green"; renderReaction(); run.shown = performance.now(); }, 2000 + rand(3000));
}
function renderReaction() {
  const title = run.phase === "waiting" ? t().waiting : run.phase === "green" ? t().green : run.phase === "early" ? t().early : run.phase === "invalid" ? t().invalid : `${run.samples.at(-1)} ms`;
  const hint = run.phase === "early" ? t().earlyHint : run.phase === "sample" ? t().sampleHint : run.phase === "invalid" ? t().invalidHint : bi(activeGame.input);
  main.querySelector(".play-surface").innerHTML = `<button class="signal" data-phase="${run.phase}" type="button"><strong>${title}</strong><small>${hint}</small></button><div class="rounds">${Array.from({ length: 5 }, (_, i) => `<span class="${i < run.samples.length ? "done" : ""}">${i < run.samples.length ? `${run.samples[i]} ms` : `${t().round} ${i + 1} ${t().rounds}`}</span>`).join("")}</div>`;
  const button = main.querySelector(".signal");
  button.onpointerdown = event => { if (event.isPrimary && event.button === 0) { event.preventDefault(); react(); } };
  button.onclick = event => { if (event.detail === 0) react(); };
  button.onkeydown = event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (!event.repeat) react(); } };
  button.focus({ preventScroll: true });
}
function react() {
  if (!run || run.result !== undefined) return;
  if (run.phase === "waiting") { stop(); run.phase = "early"; renderReaction(); return; }
  if (run.phase === "green") {
    const elapsed = Math.round(performance.now() - run.shown);
    if (elapsed < 80 || elapsed > 5000) { run.phase = "invalid"; renderReaction(); return; }
    run.samples.push(elapsed); run.phase = "sample"; run.last = performance.now();
    if (run.samples.length === 5) finish(Math.round(run.samples.reduce((sum, value) => sum + value, 0) / 5)); else renderReaction();
    return;
  }
  if (performance.now() - run.last < 250) return;
  waitSignal();
}
function flashMemory() {
  run.watching = true; run.position = 0; run.lit = -1; renderMemory();
  let i = 0;
  function flash() {
    run.lit = run.sequence[i]; paintMemory();
    later(() => {
      run.lit = -1; paintMemory(); i++;
      if (i < run.level) later(flash, 200);
      else later(() => { run.watching = false; paintMemory(); main.querySelector(".memory-grid button").focus({ preventScroll: true }); }, 350);
    }, 500);
  }
  later(flash, 700);
}
function renderMemory() {
  main.querySelector(".play-surface").innerHTML = `<div class="game-top"><strong>${t().level} ${run.level}</strong><span id="memory-state"></span></div><div class="memory-grid">${Array.from({ length: 9 }, (_, i) => `<button type="button" data-cell="${i}" aria-label="${t().cell} ${i + 1}">${i + 1}</button>`).join("")}</div><p>${t().memoryKeys}</p>`;
  main.querySelectorAll("[data-cell]").forEach(button => { button.onclick = () => memoryTap(Number(button.dataset.cell)); });
  paintMemory();
}
function paintMemory() {
  main.querySelector("#memory-state").textContent = run.watching ? t().watch : `${t().repeat} · ${run.position}/${run.level}`;
  main.querySelectorAll("[data-cell]").forEach((button, i) => { button.disabled = run.watching; button.classList.toggle("lit", run.lit === i); });
}
function memoryTap(cell) {
  if (!run || run.result !== undefined || run.watching || performance.now() - run.last < 100) return;
  run.last = performance.now();
  if (cell !== run.sequence[run.position]) { finish(run.level - 1); return; }
  run.position++; paintMemory();
  if (run.position === run.level) { if (run.level === 20) finish(20); else { run.level++; flashMemory(); } }
}
function nextQuestion() {
  if (activeGame.id === "focus") { run.question = { ink: rand(4), word: rand(4) }; return; }
  const a = rand(8) + 1, d = rand(4) + 2, kind = rand(4);
  let numbers, answer;
  if (kind === 0) { numbers = [a, a+d, a+2*d, a+3*d]; answer = a+4*d; }
  else if (kind === 1) { numbers = [a, a*2, a*4, a*8]; answer = a*16; }
  else if (kind === 2) { numbers = [a, a+d, a+2*d+1, a+3*d+3]; answer = a+4*d+6; }
  else { numbers = [a, a+d, 2*a+d, 3*a+2*d]; answer = 5*a+3*d; }
  const correct = rand(4), choices = [answer-2, answer-1, answer+1, answer+2]; choices[correct] = answer;
  run.question = { numbers, correct, choices };
}
function renderTimed() {
  const focus = activeGame.id === "focus", q = run.question;
  const remaining = Math.max(0, Math.ceil(60 - (performance.now() - run.started) / 1000));
  main.querySelector(".play-surface").innerHTML = `<div class="game-top"><strong><span id="timer">${remaining}</span> ${t().seconds}</strong><span>${t().correct} ${run.count.correct} · ${t().wrong} ${run.count.wrong}</span></div><div class="question-area"><p>${focus ? t().inkPrompt : t().sequencePrompt}</p>${focus ? `<strong class="ink-word ink-${q.ink}">${t().colors[q.word]}</strong>` : `<div class="sequence">${q.numbers.map(n => `<span>${n}</span>`).join("")}<strong>?</strong></div>`}</div><div class="choices">${Array.from({ length: 4 }, (_, i) => `<button type="button" data-choice="${i}"><kbd>${i+1}</kbd><strong>${focus ? t().colors[i] : q.choices[i]}</strong></button>`).join("")}</div><div class="feedback" role="status">${run.feedback === null ? t().chooseHint : run.feedback ? t().correctFeedback : t().wrongFeedback}</div>`;
  main.querySelectorAll("[data-choice]").forEach(button => { button.onclick = () => timedTap(Number(button.dataset.choice)); });
}
function tick() {
  if (!run || run.result !== undefined) return;
  const remaining = Math.max(0, Math.ceil(60 - (performance.now() - run.started) / 1000));
  if (!remaining) { finish(Math.max(0, run.count.correct - run.count.wrong)); return; }
  const timer = main.querySelector("#timer"); if (timer) timer.textContent = remaining;
  later(tick, 100);
}
function timedTap(choice) {
  if (!run || run.result !== undefined || performance.now() - run.last < 120) return;
  if (performance.now() - run.started >= 60000) { finish(Math.max(0, run.count.correct - run.count.wrong)); return; }
  run.last = performance.now();
  const correct = choice === (activeGame.id === "focus" ? run.question.ink : run.question.correct);
  run.count[correct ? "correct" : "wrong"]++; run.feedback = correct;
  nextQuestion(); renderTimed(); main.querySelectorAll("[data-choice]")[choice].focus({ preventScroll: true });
}
function finish(score) { stop(); run.result = score; renderResult(); main.querySelector(".again").focus({ preventScroll: true }); }
function renderResult() {
  const unit = activeGame.id === "reaction" ? "ms" : activeGame.id === "memory" ? t().levels : t().points;
  main.querySelector(".play-surface").innerHTML = `<h2>${activeGame.id === "memory" && run.result < 20 ? t().memoryEnd : t().complete}</h2><span>${t().result}</span><strong class="result-number">${run.result}<small>${unit}</small></strong><p>${t().resultNote}</p><div class="result-actions"><button class="button primary again">${t().again}</button><a href="#hall" class="button">${t().back}</a></div>`;
  main.querySelector(".again").onclick = start;
}
function board() {
  stop(); run = null; activeGame = null; setText();
  main.innerHTML = `<section class="board"><h1>${t().boardTitle}</h1><p style="color:var(--muted);max-width:60ch">${t().boardIntro}</p><div class="board-tabs" role="group" aria-label="${t().cardGroup}">${games.map((game, i) => `<button class="button" data-board="${i}" aria-pressed="${selected === i}">${bi(game.name)}</button>`).join("")}</div><div class="board-empty"><h2>${t().empty}</h2><p>${t().emptyNote}</p><button class="button board-go">${t().boardGo}${arrow}</button></div><div class="board-rules"><p>${t().rankRule}</p><p>${t().bestRule}</p></div></section>`;
  main.querySelectorAll("[data-board]").forEach(button => { button.onclick = () => { selected = Number(button.dataset.board); board(); main.querySelectorAll("[data-board]")[selected].focus(); }; });
  main.querySelector(".board-go").onclick = () => enter(selected);
}
function route() {
  if (location.hash === "#board") { board(); return; }
  const index = games.findIndex(game => `#test-${game.id}` === location.hash);
  if (index >= 0) { if (activeGame?.id !== games[index].id) { stop(); selected = index; activeGame = games[index]; run = null; renderGame(); } return; }
  const returning = !!activeGame;
  hall();
  if (returning) main.querySelectorAll(".card")[selected].focus({ preventScroll: true });
}
document.querySelector("#language").onclick = () => { locale = locale === "zh" ? "en" : "zh"; if (activeGame) renderGame(); else route(); };
window.addEventListener("hashchange", route);
window.addEventListener("keydown", event => {
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.repeat && (event.key === "Enter" || event.key === " " || /^[1-9]$/.test(event.key))) { event.preventDefault(); return; }
  if (event.key === "Escape" && activeGame) { location.hash = "hall"; return; }
  if (event.key === "Escape" && !activeGame && flipped.has(selected)) { flip(selected); return; }
  if (!activeGame && location.hash !== "#board" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); select(selected + (event.key === "ArrowRight" ? 1 : -1)); return; }
  if (!run || run.result !== undefined) return;
  if (activeGame.id === "memory" && /^[1-9]$/.test(event.key)) { event.preventDefault(); memoryTap(Number(event.key)-1); }
  else if ((activeGame.id === "focus" || activeGame.id === "reasoning") && /^[1-4]$/.test(event.key)) { event.preventDefault(); timedTap(Number(event.key)-1); }
}, true);
document.addEventListener("visibilitychange", () => { if (document.hidden && activeGame && run && run.result === undefined) { stop(); run = null; renderReady(t().interrupted); } });
route();
