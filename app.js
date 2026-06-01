const BANK_URL = "./Salesforce_Admin_Practice_Questions_Draft.md";
const STORAGE_KEY = "salesforce-admin-drill-v1";
const app = document.querySelector("#app");

const initialState = {
  attempts: {},
  bookmarks: [],
  sessions: [],
  preferences: { shuffleAll: false },
};

let bank = [];
let state = loadState();
let session = null;
let deferredInstallPrompt = null;

function loadState() {
  try {
    return { ...initialState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parseBank(markdown) {
  const answerStart = markdown.indexOf("## 正答と解説");
  const questionPart = markdown.slice(0, answerStart);
  const answerPart = markdown.slice(answerStart);
  const answers = {};

  for (const line of answerPart.split(/\r?\n/)) {
    const match = line.match(/^\| (Q\d{3}) \| ([^|]+) \| (.+) \|$/);
    if (match) {
      answers[match[1]] = {
        correct: match[2].split(",").map((value) => value.trim()),
        explanation: match[3].trim(),
      };
    }
  }

  const blocks = questionPart.split(/^#### /m).slice(1);
  return blocks.map((block) => {
    const lines = block.trim().split(/\r?\n/);
    const header = lines.shift();
    const headerMatch = header.match(/^(Q\d{3}) \[(単一選択|複数選択: (\d+)つ)\]$/);
    if (!headerMatch) return null;

    const textLines = [];
    const choices = [];
    for (const line of lines) {
      const choice = line.match(/^([A-Z])\. (.+)$/);
      if (choice) choices.push({ key: choice[1], text: choice[2].trim() });
      else if (line.trim()) textLines.push(line.trim());
    }
    const id = headerMatch[1];
    return {
      id,
      type: headerMatch[2].startsWith("複数") ? "multiple" : "single",
      required: Number(headerMatch[3] || 1),
      text: textLines.join(" "),
      choices,
      ...answers[id],
    };
  }).filter(Boolean);
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function stats() {
  const attempted = Object.values(state.attempts).filter((item) => item.total > 0);
  const correct = attempted.filter((item) => item.lastCorrect).length;
  const weak = attempted.filter((item) => !item.lastCorrect).length;
  return { attempted: attempted.length, correct, weak, bookmarks: state.bookmarks.length };
}

function setNav(view) {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
}

function renderHome() {
  session = null;
  setNav("home");
  const summary = stats();
  const progress = Math.round((summary.attempted / bank.length) * 100);
  app.innerHTML = `
    <section class="hero card">
      <div class="hero-row">
        <div>
          <h2>今日も一問ずつ。</h2>
          <p>全${bank.length}問を収録。解説を確認しながら、苦手な問題を繰り返せます。</p>
        </div>
        <span class="badge">${progress}%</span>
      </div>
      <div class="progress-track"><div class="progress-value" style="width:${progress}%"></div></div>
      <div class="progress-label"><span>回答済み ${summary.attempted}問</span><span>${bank.length}問中</span></div>
    </section>

    <h2 class="section-title">学習モード</h2>
    <section class="mode-grid">
      ${modeCard("all", "全問題", `全${bank.length}問を${state.preferences.shuffleAll ? "シャッフル" : "順番"}で学習します。`, `${bank.length}問`)}
      ${modeCard("exam", "模擬試験", "本番相当の60問をランダム出題します。解説は終了後に確認できます。", "60問")}
      ${modeCard("weak", "間違えた問題", "直近で間違えた問題だけを解き直します。", `${summary.weak}問`, summary.weak === 0)}
      ${modeCard("bookmarks", "ブックマーク", "あとで確認したい問題をまとめて復習します。", `${summary.bookmarks}問`, summary.bookmarks === 0)}
    </section>

    <h2 class="section-title">学習状況</h2>
    <section class="stat-grid">
      <article class="stat card"><strong>${summary.attempted}</strong><span>回答済み</span></article>
      <article class="stat card"><strong>${summary.correct}</strong><span>直近で正解</span></article>
      <article class="stat card"><strong>${summary.weak}</strong><span>要復習</span></article>
    </section>
  `;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => startSession(button.dataset.mode));
  });
}

function modeCard(mode, title, description, badge, disabled = false) {
  return `
    <button class="mode-card" data-mode="${mode}" type="button" ${disabled ? "disabled" : ""}>
      <span class="mode-title"><span>${title}</span><span class="badge ${disabled ? "warn" : ""}">${badge}</span></span>
      <span class="mode-description">${description}</span>
    </button>
  `;
}

function startSession(mode) {
  let questions = bank;
  let title = "全問題";
  let exam = false;
  if (mode === "all" && state.preferences.shuffleAll) questions = shuffle(bank);
  if (mode === "exam") {
    questions = shuffle(bank).slice(0, 60);
    title = "模擬試験";
    exam = true;
  }
  if (mode === "weak") {
    questions = bank.filter((q) => state.attempts[q.id] && !state.attempts[q.id].lastCorrect);
    title = "間違えた問題";
  }
  if (mode === "bookmarks") {
    questions = bank.filter((q) => state.bookmarks.includes(q.id));
    title = "ブックマーク";
  }
  if (!questions.length) return;

  session = {
    mode, title, exam, questions, index: 0, selected: [], checked: false,
    answers: [], startedAt: new Date().toISOString(),
  };
  renderQuestion();
}

function renderQuestion() {
  const q = session.questions[session.index];
  const bookmarked = state.bookmarks.includes(q.id);
  const isLast = session.index === session.questions.length - 1;
  const canCheck = session.selected.length === q.required;
  const feedback = session.checked && !session.exam ? renderFeedback(q) : "";

  app.innerHTML = `
    <section class="session-header">
      <div>
        <h2 class="session-title">${session.title}</h2>
        <p class="session-meta">${session.index + 1} / ${session.questions.length}</p>
      </div>
      <button class="text-button" id="quit-button" type="button">終了</button>
    </section>
    <section class="question-card card">
      <div class="question-top">
        <span class="question-number">${q.id}</span>
        <button class="bookmark-button ${bookmarked ? "active" : ""}" id="bookmark-button" type="button" aria-label="ブックマーク">${bookmarked ? "★" : "☆"}</button>
      </div>
      <p class="question-text">${q.text}</p>
      ${q.type === "multiple" ? `<p class="select-hint">正しいものを${q.required}つ選択してください</p>` : ""}
      <div class="choices">
        ${q.choices.map((choice) => renderChoice(q, choice)).join("")}
      </div>
      ${feedback}
      <div class="question-actions">
        ${session.checked
          ? `<button class="primary-button wide" id="next-button" type="button">${isLast ? "結果を見る" : "次の問題"}</button>`
          : `<button class="primary-button wide" id="check-button" type="button" ${canCheck ? "" : "disabled"}>${session.exam ? (isLast ? "回答して結果を見る" : "回答して次へ") : "回答する"}</button>`
        }
      </div>
    </section>
  `;

  document.querySelector("#quit-button").addEventListener("click", renderHome);
  document.querySelector("#bookmark-button").addEventListener("click", () => toggleBookmark(q.id));
  document.querySelectorAll(".choice").forEach((button) => {
    button.addEventListener("click", () => toggleChoice(button.dataset.key));
  });
  document.querySelector("#check-button")?.addEventListener("click", checkAnswer);
  document.querySelector("#next-button")?.addEventListener("click", nextQuestion);
}

function renderChoice(q, choice) {
  const selected = session.selected.includes(choice.key);
  let resultClass = "";
  if (session.checked && !session.exam) {
    if (q.correct.includes(choice.key)) resultClass = "correct";
    else if (selected) resultClass = "incorrect";
  }
  return `
    <button class="choice ${selected ? "selected" : ""} ${resultClass}" data-key="${choice.key}" type="button" ${session.checked ? "disabled" : ""}>
      <span class="choice-key">${choice.key}</span><span class="choice-text">${choice.text}</span>
    </button>
  `;
}

function toggleChoice(key) {
  const q = session.questions[session.index];
  if (q.type === "single") session.selected = [key];
  else if (session.selected.includes(key)) session.selected = session.selected.filter((item) => item !== key);
  else if (session.selected.length < q.required) session.selected.push(key);
  renderQuestion();
}

function checkAnswer() {
  const q = session.questions[session.index];
  if (session.selected.length !== q.required) return;
  const selected = [...session.selected].sort();
  const correct = [...q.correct].sort();
  const isCorrect = selected.join() === correct.join();
  session.answers.push({ id: q.id, selected, correct: isCorrect });
  const attempt = state.attempts[q.id] || { total: 0, correct: 0, lastCorrect: false };
  attempt.total += 1;
  attempt.correct += isCorrect ? 1 : 0;
  attempt.lastCorrect = isCorrect;
  state.attempts[q.id] = attempt;
  saveState();

  if (session.exam) {
    nextQuestion();
  } else {
    session.checked = true;
    renderQuestion();
  }
}

function renderFeedback(q) {
  const answer = session.answers.at(-1);
  return `
    <section class="feedback ${answer.correct ? "correct" : "incorrect"}">
      <h3>${answer.correct ? "正解です" : `正解: ${q.correct.join(", ")}`}</h3>
      <p>${q.explanation}</p>
    </section>
  `;
}

function nextQuestion() {
  if (session.index >= session.questions.length - 1) {
    finishSession();
    return;
  }
  session.index += 1;
  session.selected = [];
  session.checked = false;
  renderQuestion();
}

function finishSession() {
  const correct = session.answers.filter((answer) => answer.correct).length;
  const total = session.questions.length;
  const percentage = Math.round((correct / total) * 100);
  state.sessions.unshift({
    mode: session.mode, title: session.title, correct, total, percentage,
    finishedAt: new Date().toISOString(),
  });
  state.sessions = state.sessions.slice(0, 30);
  saveState();
  app.innerHTML = `
    <section class="result card">
      <div class="result-score" style="--score:${percentage}%"><div class="result-score-inner"><strong>${percentage}%</strong><span>${correct} / ${total} 正解</span></div></div>
      <h2>${session.title} 完了</h2>
      <p>${percentage >= 65 ? "合格基準の65%に到達しました。" : "間違えた問題を復習して、理解を固めましょう。"}</p>
      <div class="result-actions">
        <button class="primary-button wide" id="home-button" type="button">ホームへ戻る</button>
        <button class="secondary-button wide" id="weak-button" type="button">間違えた問題を復習</button>
      </div>
    </section>
  `;
  document.querySelector("#home-button").addEventListener("click", renderHome);
  document.querySelector("#weak-button").addEventListener("click", () => startSession("weak"));
}

function toggleBookmark(id) {
  state.bookmarks = state.bookmarks.includes(id)
    ? state.bookmarks.filter((item) => item !== id)
    : [...state.bookmarks, id];
  saveState();
  renderQuestion();
}

function renderHistory() {
  session = null;
  setNav("history");
  const summary = stats();
  app.innerHTML = `
    <h2 class="section-title">学習記録</h2>
    <section class="stat-grid">
      <article class="stat card"><strong>${summary.attempted}</strong><span>回答済み</span></article>
      <article class="stat card"><strong>${summary.correct}</strong><span>直近で正解</span></article>
      <article class="stat card"><strong>${summary.weak}</strong><span>要復習</span></article>
    </section>
    <h2 class="section-title">最近のセッション</h2>
    <section class="history-list">
      ${state.sessions.length ? state.sessions.map((item) => `
        <article class="history-item card">
          <div class="row"><h3>${item.title}</h3><span class="badge">${item.percentage}%</span></div>
          <p>${formatDate(item.finishedAt)} ・ ${item.correct} / ${item.total} 正解</p>
        </article>`).join("") : `<div class="empty card">まだ学習記録はありません。</div>`}
    </section>
  `;
}

function renderSettings() {
  session = null;
  setNav("settings");
  app.innerHTML = `
    <h2 class="section-title">設定</h2>
    <section class="settings-list">
      <article class="settings-item card">
        <div class="row">
          <div><h3>全問題をシャッフル</h3><p>全問題モードの出題順をランダムにします。</p></div>
          <input id="shuffle-toggle" type="checkbox" ${state.preferences.shuffleAll ? "checked" : ""} aria-label="全問題をシャッフル" />
        </div>
      </article>
      <article class="settings-item card">
        <h3>端末内の学習記録</h3>
        <p>回答履歴、復習対象、ブックマークはこの端末のブラウザに保存されます。</p>
        <button class="danger-button wide" id="reset-button" type="button">学習記録をリセット</button>
      </article>
      <article class="settings-item card">
        <h3>問題集</h3>
        <p>${bank.length}問を収録。修正履歴は問題集Markdownに保存されています。</p>
      </article>
    </section>
  `;
  document.querySelector("#shuffle-toggle").addEventListener("change", (event) => {
    state.preferences.shuffleAll = event.target.checked;
    saveState();
  });
  document.querySelector("#reset-button").addEventListener("click", () => {
    if (!confirm("学習記録、復習対象、ブックマークを削除しますか？")) return;
    state = structuredClone(initialState);
    saveState();
    renderSettings();
  });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

async function bootstrap() {
  try {
    const response = await fetch(BANK_URL);
    if (!response.ok) throw new Error("問題集を取得できませんでした。");
    bank = parseBank(await response.text());
    if (!bank.length || bank.some((question) => !question.correct)) throw new Error("問題集の解析に失敗しました。");
    renderHome();
  } catch (error) {
    app.innerHTML = `<section class="empty card"><strong>読み込みエラー</strong><p>${error.message}</p><p>Webサーバーから開いてください。</p></section>`;
  }
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.view === "home") renderHome();
    if (button.dataset.view === "history") renderHistory();
    if (button.dataset.view === "settings") renderSettings();
  });
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.querySelector("#install-button").classList.remove("hidden");
});

document.querySelector("#install-button").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.querySelector("#install-button").classList.add("hidden");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

bootstrap();
