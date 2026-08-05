const app = document.getElementById("app");
const { createClient } = supabase;
const sb = createClient(
  window.ND_CONFIG.supabaseUrl,
  window.ND_CONFIG.supabaseAnonKey
);

const DIFFS = [
  { id: 3, label: "سهل", meta: "٣ أرقام" },
  { id: 4, label: "متوسط", meta: "٤ أرقام" },
  { id: 5, label: "صعب", meta: "٥ أرقام" },
];

const THEMES = [
  { id: "classic", label: "كلاسيك" },
  { id: "day", label: "نهاري" },
  { id: "ramadan", label: "رمضاني" },
];

const TIMER_OPTS = [
  { id: 0, label: "بدون مؤقت" },
  { id: 30, label: "٣٠ ث" },
  { id: 45, label: "٤٥ ث" },
  { id: 60, label: "٦٠ ث" },
];

const state = {
  screen: "home",
  name: localStorage.getItem("nd_name") || "",
  room: null,
  playerId: null,
  error: "",
  secretDraft: "",
  guessDraft: "",
  busy: false,
  joinCode: "",
  trackerOpen: false,
  infoOpen: false,
  crossed: new Set(),
  trackerGameKey: null,
  digitCount: Number(localStorage.getItem("nd_digits") || 4),
  muted: localStorage.getItem("nd_muted") === "1",
  theme: localStorage.getItem("nd_theme") || "classic",
  timerSec: Number(localStorage.getItem("nd_timer") || 0),
  mode: "online", // online | ai
  aiSecret: null,
  aiPlayerId: "ai-bot",
  aiCandidates: [],
  lastHint: "",
  reconnecting: false,
  presenceNote: "",
  turnEndsAt: null,
  timerLeft: 0,
  tutorialStep: localStorage.getItem("nd_tutorial_done") === "1" ? null : 0,
  streakHandledFor: null,
};

let roomChannel = null;
let audioCtx = null;
let prevTurn = null;
let heartbeatTimer = null;
let countdownTimer = null;

function digitCount() {
  return state.room?.digitCount || state.digitCount || 4;
}

function getStreak() {
  return Number(localStorage.getItem("nd_streak") || 0);
}

function getBestStreak() {
  return Number(localStorage.getItem("nd_best_streak") || 0);
}

function recordResult(won) {
  if (won) {
    const next = getStreak() + 1;
    localStorage.setItem("nd_streak", String(next));
    if (next > getBestStreak()) localStorage.setItem("nd_best_streak", String(next));
  } else {
    localStorage.setItem("nd_streak", "0");
  }
}

function isValidNumber(value, digits = digitCount()) {
  if (typeof value !== "string" || value.length !== digits || !new RegExp(`^\\d{${digits}}$`).test(value)) {
    return { ok: false, error: `لازم ${digits} أرقام` };
  }
  if (value === value[0].repeat(digits)) {
    return { ok: false, error: "ما ينفع تكرر نفس الرقم في كل الخانات" };
  }
  return { ok: true };
}

function randomSecret(digits) {
  let s = "";
  do {
    s = Array.from({ length: digits }, () => Math.floor(Math.random() * 10)).join("");
  } while (s === s[0].repeat(digits));
  return s;
}

function scoreGuess(secret, guess) {
  let n = 0;
  for (let i = 0; i < secret.length; i++) if (secret[i] === guess[i]) n++;
  return n;
}

function buildCandidates(digits) {
  const out = [];
  const max = 10 ** digits;
  for (let i = 0; i < max; i++) {
    const s = String(i).padStart(digits, "0");
    if (s !== s[0].repeat(digits)) out.push(s);
  }
  return out;
}

function aiPickGuess() {
  if (!state.aiCandidates.length) state.aiCandidates = buildCandidates(digitCount());
  const pool = state.aiCandidates;
  // فضّل تخمين يقلل الاحتمالات: عينة عشوائية من المرشحين
  const sample = pool.length <= 40 ? pool : Array.from({ length: 40 }, () => pool[Math.floor(Math.random() * pool.length)]);
  let best = sample[0];
  let bestScore = Infinity;
  for (const g of sample) {
    const buckets = new Map();
    const probe = pool.length <= 250 ? pool : Array.from({ length: 250 }, () => pool[Math.floor(Math.random() * pool.length)]);
    for (const c of probe) {
      const sc = scoreGuess(c, g);
      buckets.set(sc, (buckets.get(sc) || 0) + 1);
    }
    const worst = Math.max(...buckets.values());
    if (worst < bestScore) {
      bestScore = worst;
      best = g;
    }
  }
  return best;
}

function aiLearn(guess, correct) {
  state.aiCandidates = (state.aiCandidates.length ? state.aiCandidates : buildCandidates(digitCount())).filter(
    (c) => scoreGuess(c, guess) === correct
  );
}

function clearTracker() {
  state.crossed = new Set();
  state.trackerOpen = false;
  state.trackerGameKey = null;
  state.lastHint = "";
}

function ensureTrackerForRoom() {
  const key = state.room?.code || (state.mode === "ai" ? "ai" : null);
  if (!key) return;
  if (state.trackerGameKey !== key) {
    state.crossed = new Set();
    state.trackerGameKey = key;
    state.trackerOpen = false;
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function me() {
  return state.room?.players?.find((p) => p.isYou) || null;
}

function opponent() {
  return state.room?.players?.find((p) => !p.isYou) || null;
}

function playerName(id) {
  const p = state.room?.players?.find((x) => x.id === id);
  return p?.name || "لاعب";
}

function setError(msg) {
  state.error = msg || "";
  render();
}

function setBusy(v) {
  state.busy = v;
  render();
}

function saveSession() {
  if (state.mode === "ai" || !state.room?.code || !state.playerId) {
    localStorage.removeItem("nd_active");
    return;
  }
  localStorage.setItem(
    "nd_active",
    JSON.stringify({ code: state.room.code, playerId: state.playerId })
  );
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  localStorage.setItem("nd_theme", state.theme);
}

function vibrate(pattern = 30) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {}
}

function beep(freq = 520, dur = 0.08, type = "sine", gain = 0.04) {
  if (state.muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur);
  } catch {}
}

function soundGuess(correct, digits) {
  if (correct >= digits) {
    beep(660, 0.1);
    setTimeout(() => beep(880, 0.12), 90);
    setTimeout(() => beep(990, 0.16), 180);
    vibrate([40, 40, 80]);
  } else {
    beep(420 + correct * 40, 0.07);
    vibrate(20);
  }
}

function soundTurn() {
  beep(540, 0.09, "triangle", 0.035);
  vibrate(25);
}

function inviteText() {
  const url = `${location.origin}${location.pathname}?code=${state.room.code}`;
  const d = digitCount();
  const label = DIFFS.find((x) => x.id === d)?.label || "متوسط";
  return `يلا نلعب مبارزة الأرقام 🔢\nالصعوبة: ${label} (${d} خانات)\nالكود: ${state.room.code}\nادخل من هنا: ${url}`;
}

function inviteUrl() {
  return `${location.origin}${location.pathname}?code=${state.room.code}`;
}

function applyRoom(room, { silent } = {}) {
  const prevStatus = state.room?.status;
  const wasMyTurn = state.room?.turn === state.playerId;
  const prevPresence = state.room?.opponentPresence;
  state.room = room;
  state.error = "";
  if (room.status === "waiting") state.screen = "lobby";
  else if (room.status === "setup") state.screen = "setup";
  else if (room.status === "playing") state.screen = "play";
  else if (room.status === "finished") state.screen = "finished";
  if (prevStatus === "finished" && room.status === "setup") {
    state.crossed = new Set();
    state.trackerOpen = false;
    state.lastHint = "";
    state.streakHandledFor = null;
  }

  // سلسلة الانتصارات
  if (room.status === "finished" && prevStatus !== "finished") {
    const key = `${room.code}:${room.winner}`;
    if (state.streakHandledFor !== key) {
      recordResult(room.winner === state.playerId);
      state.streakHandledFor = key;
    }
  }

  // رسائل حضور الخصم
  if (room.opponentPresence === "left" || (prevStatus && prevStatus !== "waiting" && room.status === "waiting" && (room.players?.length || 0) < 2)) {
    state.presenceNote = "الخصم طلع من الغرفة";
  } else if (room.opponentPresence === "offline") {
    state.presenceNote = "يبدو إن نت الخصم انقطع";
  } else if (room.opponentPresence === "slow") {
    state.presenceNote = "الخصم بطيء أو النت ضعيف... استنى شوي";
  } else if (room.opponentPresence === "online") {
    if (prevPresence === "slow" || prevPresence === "offline") state.presenceNote = "";
    else if (state.presenceNote && state.presenceNote.includes("انقطع")) state.presenceNote = "";
  }

  if (!silent && room.status === "playing" && room.turn === state.playerId && !wasMyTurn && prevTurn !== room.turn) {
    soundTurn();
  }
  if (!silent && room.status === "finished" && prevStatus !== "finished") {
    soundGuess(digitCount(), digitCount());
  }

  const turnChanged = prevTurn !== room.turn || wasMyTurn !== (room.turn === state.playerId);
  prevTurn = room.turn;
  if (room.status === "playing" && room.turn === state.playerId) {
    if (turnChanged || !state.turnEndsAt) startTurnTimer();
  } else {
    stopTurnTimer();
  }
  saveSession();
  ensureHeartbeat();
}

function presenceBanner() {
  if (state.mode !== "online" || !state.presenceNote) return "";
  const kind = state.room?.opponentPresence || "slow";
  return `<div class="presence-banner ${escapeHtml(kind)}">${escapeHtml(state.presenceNote)}</div>`;
}

function startTurnTimer() {
  stopTurnTimer(false);
  if (!state.timerSec || state.timerSec <= 0) {
    state.turnEndsAt = null;
    state.timerLeft = 0;
    return;
  }
  state.turnEndsAt = Date.now() + state.timerSec * 1000;
  state.timerLeft = state.timerSec;
  countdownTimer = setInterval(() => {
    if (!state.turnEndsAt) return;
    const left = Math.max(0, Math.ceil((state.turnEndsAt - Date.now()) / 1000));
    state.timerLeft = left;
    const el = document.getElementById("timerVal");
    if (el) {
      el.textContent = String(left);
      el.parentElement?.classList.toggle("urgent", left <= 5);
    }
    if (left <= 0) {
      stopTurnTimer(false);
      onTurnTimeout();
    }
  }, 200);
}

function stopTurnTimer(clearState = true) {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  if (clearState) {
    state.turnEndsAt = null;
    state.timerLeft = 0;
  }
}

async function onTurnTimeout() {
  if (state.room?.status !== "playing" || state.room.turn !== state.playerId) return;
  state.error = "انتهى الوقت — انتقل الدور";
  beep(220, 0.12, "sawtooth", 0.03);
  vibrate(40);
  if (state.mode === "ai") {
    state.room.turn = state.aiPlayerId;
    aiPublicRoomPatch();
    applyRoom(state.room, { silent: true });
    render();
    setTimeout(aiTakeTurn, 500);
    return;
  }
  const { data } = await sb.rpc("nd_skip_turn", {
    p_code: state.room.code,
    p_player_id: state.playerId,
  });
  if (data?.ok) {
    applyRoom(data.room, { silent: true });
    render();
  }
}

function timerBadge() {
  if (!state.timerSec || state.room?.status !== "playing" || state.room.turn !== state.playerId) return "";
  return `<div class="timer-badge ${state.timerLeft <= 5 ? "urgent" : ""}">الوقت: <strong id="timerVal">${state.timerLeft || state.timerSec}</strong>ث</div>`;
}

function ensureHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(async () => {
    if (state.mode !== "online" || !state.room?.code || !state.playerId) return;
    if (!navigator.onLine) {
      state.presenceNote = "نتّك انقطع... استنى شوي";
      const banner = document.querySelector(".presence-banner");
      if (!banner) render();
      return;
    }
    try {
      const { data } = await sb.rpc("nd_heartbeat", {
        p_code: state.room.code,
        p_player_id: state.playerId,
      });
      if (data?.ok && data.room) {
        applyRoom(data.room, { silent: true });
        // تحديث خفيف للبانر بدون إعادة رسم كاملة إن أمكن
        const noteChanged = true;
        if (noteChanged) {
          const host = document.querySelector(".presence-slot");
          if (host) host.innerHTML = presenceBanner();
          else render();
        }
      }
    } catch {}
  }, 5000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function leaveRoomQuiet() {
  if (state.mode !== "online" || !state.room?.code || !state.playerId) return;
  try {
    await sb.rpc("nd_leave_room", {
      p_code: state.room.code,
      p_player_id: state.playerId,
    });
  } catch {}
}

async function refreshRoom() {
  if (state.mode === "ai" || !state.room?.code || !state.playerId) return;
  const { data, error } = await sb.rpc("nd_get_room", {
    p_code: state.room.code,
    p_player_id: state.playerId,
  });
  if (error) return;
  if (data?.ok) {
    applyRoom(data.room);
    render();
  }
}

function subscribeRoom(code) {
  if (roomChannel) {
    sb.removeChannel(roomChannel);
    roomChannel = null;
  }
  roomChannel = sb
    .channel(`nd-room-${code}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "nd_rooms", filter: `code=eq.${code}` },
      () => refreshRoom()
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") state.reconnecting = false;
    });
}

async function tryReconnect() {
  const raw = localStorage.getItem("nd_active");
  if (!raw) return false;
  try {
    const { code, playerId } = JSON.parse(raw);
    if (!code || !playerId) return false;
    state.reconnecting = true;
    render();
    const { data, error } = await sb.rpc("nd_get_room", {
      p_code: code,
      p_player_id: playerId,
    });
    state.reconnecting = false;
    if (error || !data?.ok) {
      localStorage.removeItem("nd_active");
      return false;
    }
    state.mode = "online";
    state.playerId = playerId;
    applyRoom(data.room, { silent: true });
    subscribeRoom(code);
    render();
    return true;
  } catch {
    state.reconnecting = false;
    return false;
  }
}

function render() {
  applyTheme();
  if (state.screen === "home") return renderHome();
  if (!state.room) return renderHome();
  if (state.room.status === "waiting") return renderLobby();
  if (state.room.status === "setup") return renderSetup();
  if (state.room.status === "playing") return renderPlay();
  if (state.room.status === "finished") return renderFinished();
  return renderHome();
}

function settingsBar() {
  return `
    <div class="settings-bar">
      <button class="chip ${state.muted ? "on" : ""}" id="muteBtn" type="button">${state.muted ? "صوت: مكتوم" : "صوت: شغال"}</button>
      <div class="theme-row">
        ${THEMES.map(
          (t) =>
            `<button type="button" class="chip ${state.theme === t.id ? "on" : ""}" data-theme="${t.id}">${t.label}</button>`
        ).join("")}
      </div>
      <div>
        <label class="mini-label">مؤقت الدور</label>
        <div class="theme-row">
          ${TIMER_OPTS.map(
            (t) =>
              `<button type="button" class="chip ${state.timerSec === t.id ? "on" : ""}" data-timer="${t.id}">${t.label}</button>`
          ).join("")}
        </div>
      </div>
    </div>
  `;
}

function bindSettings() {
  const mute = document.getElementById("muteBtn");
  if (mute) {
    mute.onclick = () => {
      state.muted = !state.muted;
      localStorage.setItem("nd_muted", state.muted ? "1" : "0");
      if (!state.muted) beep(600, 0.06);
      render();
    };
  }
  document.querySelectorAll("[data-theme]").forEach((btn) => {
    btn.onclick = () => {
      state.theme = btn.dataset.theme;
      applyTheme();
      render();
    };
  });
  document.querySelectorAll("[data-timer]").forEach((btn) => {
    btn.onclick = () => {
      state.timerSec = Number(btn.dataset.timer);
      localStorage.setItem("nd_timer", String(state.timerSec));
      if (state.room?.status === "playing" && state.room.turn === state.playerId) startTurnTimer();
      render();
    };
  });
}

function tutorialOverlay() {
  if (state.tutorialStep === null || state.tutorialStep === undefined) return "";
  const steps = [
    {
      title: "١) اختر رقمك السري",
      body: "كل لاعب يثبّت رقم من ٣ أو ٤ أو ٥ خانات. التكرار الجزئي مسموح، لكن ممنوع مثل 1111.",
    },
    {
      title: "٢) خمّن بالدور",
      body: "بعد كل تخمين يطلع لك كم خانة صح في مكانها فقط. أول واحد يجيب الرقم كامل يفوز.",
    },
    {
      title: "٣) أدوات تساعدك",
      body: "فيه تلميح مرة واحدة، قائمة تعليم، مؤقت اختياري، وثيمات. تقدر تلعب أونلاين أو ضد الكمبيوتر.",
    },
  ];
  const step = steps[state.tutorialStep] || steps[0];
  const last = state.tutorialStep >= steps.length - 1;
  return `
    <div class="tutorial-overlay" id="tutorialOverlay">
      <div class="tutorial-sheet">
        <div class="tutorial-progress">${state.tutorialStep + 1} / ${steps.length}</div>
        <h2>${step.title}</h2>
        <p>${step.body}</p>
        <div class="row">
          ${state.tutorialStep > 0 ? `<button class="btn btn-ghost" id="tutBack" type="button">رجوع</button>` : `<span></span>`}
          <button class="btn btn-primary" id="tutNext" type="button">${last ? "يلا نبدأ" : "التالي"}</button>
        </div>
      </div>
    </div>
  `;
}

function bindTutorial() {
  const next = document.getElementById("tutNext");
  const back = document.getElementById("tutBack");
  if (next) {
    next.onclick = () => {
      if (state.tutorialStep >= 2) {
        state.tutorialStep = null;
        localStorage.setItem("nd_tutorial_done", "1");
      } else {
        state.tutorialStep += 1;
      }
      render();
    };
  }
  if (back) {
    back.onclick = () => {
      state.tutorialStep = Math.max(0, state.tutorialStep - 1);
      render();
    };
  }
}

function infoOverlay() {
  if (!state.infoOpen) return "";
  return `
    <div class="info-overlay" id="infoOverlay" role="dialog" aria-modal="true">
      <div class="info-sheet">
        <button class="tracker-close" id="infoClose" type="button" aria-label="إغلاق">×</button>
        <h2 class="tracker-title">كيف تلعب؟</h2>
        <div class="info-body">
          <p><strong>فكرة اللعبة</strong><br />كل لاعب يختار رقم سري، وتتناوبون على تخمين رقم الخصم.</p>
          <p><strong>الصعوبة</strong><br />سهل ٣ أرقام، متوسط ٤، صعب ٥. ممنوع تكرار نفس الرقم في كل الخانات.</p>
          <p><strong>النتيجة</strong><br />بعد كل تخمين يطلع لك فقط عدد الخانات الصحيحة في مكانها.</p>
          <p><strong>التلميح</strong><br />مرة واحدة بالجولة: يكشف أي خانة من آخر تخمينك كانت صحيحة بدون ما يقول الرقم.</p>
          <p><strong>ضد الكمبيوتر</strong><br />تقدر تلعب لوحدك إذا ما لقيت خصم.</p>
          <p><strong>بعد النهاية</strong><br />ينكشف رقم الخصم عشان تتأكدون.</p>
        </div>
      </div>
    </div>
  `;
}

function bindInfo() {
  const openBtn = document.getElementById("infoBtn");
  if (openBtn) openBtn.onclick = () => { state.infoOpen = true; render(); };
  const closeBtn = document.getElementById("infoClose");
  if (closeBtn) closeBtn.onclick = () => { state.infoOpen = false; render(); };
  const overlay = document.getElementById("infoOverlay");
  if (overlay) {
    overlay.onclick = (e) => {
      if (e.target === overlay) { state.infoOpen = false; render(); }
    };
  }
}

function renderHome() {
  app.innerHTML = `
    <section class="screen">
      <div class="home-top">
        <button class="info-btn" id="infoBtn" type="button">معلومات</button>
      </div>
      <div>
        <h1 class="brand">مبارزة<br /><span>الأرقام</span></h1>
        <p class="lede">تحدّى صاحبك أونلاين، أو العب ضد الكمبيوتر.</p>
      </div>
      <div class="streak-card">
        <div>
          <span class="muted">اسمك الثابت</span>
          <strong>${escapeHtml(state.name || "—")}</strong>
        </div>
        <div>
          <span class="muted">سلسلة الانتصارات</span>
          <strong>${getStreak()}</strong>
        </div>
        <div>
          <span class="muted">أفضل سلسلة</span>
          <strong>${getBestStreak()}</strong>
        </div>
      </div>
      ${settingsBar()}
      <div class="panel stack">
        <div>
          <label for="name">اسمك المستعار</label>
          <input id="name" maxlength="20" placeholder="مثلاً: قاسم" value="${escapeHtml(state.name)}" />
        </div>
        <div>
          <label>الصعوبة</label>
          <div class="diff-row">
            ${DIFFS.map(
              (d) => `
              <button type="button" class="diff-btn ${state.digitCount === d.id ? "on" : ""}" data-diff="${d.id}">
                <strong>${d.label}</strong>
                <span>${d.meta}</span>
              </button>`
            ).join("")}
          </div>
        </div>
        ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
        ${state.reconnecting ? `<p class="hint">جارٍ استرجاع جلستك...</p>` : ""}
        <button class="btn btn-primary" id="createBtn" ${state.busy ? "disabled" : ""}>إنشاء غرفة</button>
        <button class="btn btn-ai" id="aiBtn" ${state.busy ? "disabled" : ""}>العب ضد الكمبيوتر</button>
        <div class="row">
          <input id="joinCode" class="digits" maxlength="5" placeholder="الكود" value="${escapeHtml(state.joinCode)}" style="letter-spacing:0.2em;font-size:1.3rem" />
          <button class="btn btn-sky" id="joinBtn" ${state.busy ? "disabled" : ""}>انضم</button>
        </div>
      </div>
    </section>
    ${infoOverlay()}
    ${tutorialOverlay()}
  `;

  document.getElementById("name").oninput = (e) => {
    state.name = e.target.value;
    localStorage.setItem("nd_name", state.name);
  };
  document.getElementById("joinCode").oninput = (e) => {
    state.joinCode = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    e.target.value = state.joinCode;
  };
  document.querySelectorAll("[data-diff]").forEach((btn) => {
    btn.onclick = () => {
      state.digitCount = Number(btn.dataset.diff);
      localStorage.setItem("nd_digits", String(state.digitCount));
      render();
    };
  });
  document.getElementById("createBtn").onclick = createRoom;
  document.getElementById("joinBtn").onclick = joinRoom;
  document.getElementById("aiBtn").onclick = startAiGame;
  bindInfo();
  bindSettings();
  bindTutorial();
}

function roomHeader() {
  const d = digitCount();
  const diff = DIFFS.find((x) => x.id === d);
  return `
    <div class="topbar">
      <div class="pill">الغرفة <strong>${escapeHtml(state.room.code)}</strong></div>
      <div class="topbar-actions">
        <button class="btn btn-ghost copy-btn info-gap" id="infoBtn" type="button">معلومات</button>
        <button class="btn btn-ghost copy-btn" id="trackerBtn" type="button">القائمة</button>
        ${state.mode === "online" ? `<button class="btn btn-ghost copy-btn" id="copyCode" type="button">نسخ الرابط</button>` : ""}
      </div>
    </div>
    <div class="meta-strip">
      <span>الصعوبة: ${diff?.label || ""} (${d})</span>
      ${state.room.status === "playing" || state.room.status === "finished" ? `<span>الدور رقم ${state.room.turnNumber || 1}</span>` : ""}
    </div>
  `;
}

function inviteBlock() {
  if (state.mode !== "online" || !state.room?.code) return "";
  const text = encodeURIComponent(inviteText());
  const wa = `https://wa.me/?text=${text}`;
  return `
    <div class="panel stack invite-box">
      <p class="hint">ادعُ صاحبك:</p>
      <div class="row">
        <a class="btn btn-wa" id="waBtn" href="${wa}" target="_blank" rel="noopener">واتساب</a>
        <button class="btn btn-snap" id="snapBtn" type="button">سناب</button>
      </div>
      <p class="hint tiny">السناب يجهز لك النص عشان تلصقه بالشات.</p>
    </div>
  `;
}

function bindInvites() {
  const snap = document.getElementById("snapBtn");
  if (snap) {
    snap.onclick = async () => {
      const text = inviteText();
      try {
        if (navigator.share) {
          await navigator.share({ text, url: inviteUrl(), title: "مبارزة الأرقام" });
        } else {
          await navigator.clipboard.writeText(text);
          snap.textContent = "تم النسخ";
          setTimeout(() => { snap.textContent = "سناب"; }, 1400);
        }
      } catch {
        try {
          await navigator.clipboard.writeText(text);
          snap.textContent = "تم النسخ";
          setTimeout(() => { snap.textContent = "سناب"; }, 1400);
        } catch {
          prompt("انسخ الدعوة:", text);
        }
      }
    };
  }
}

function trackerOverlay() {
  if (!state.trackerOpen) return "";
  const digits = 10;
  const slots = digitCount();
  const rows = Array.from({ length: digits }, (_, digit) => {
    const cells = Array.from({ length: slots }, (_, slot) => {
      const key = `${digit}-${slot}`;
      const crossed = state.crossed.has(key);
      return `
        <button type="button" class="tracker-cell ${crossed ? "crossed" : ""}" data-key="${key}">
          <span>${digit}</span>
          ${crossed ? '<i class="tracker-x" aria-hidden="true">✕</i>' : ""}
        </button>`;
    }).join("");
    return `<div class="tracker-row" style="grid-template-columns:repeat(${slots},1fr)">${cells}</div>`;
  }).join("");
  return `
    <div class="tracker-overlay" id="trackerOverlay" role="dialog" aria-modal="true">
      <div class="tracker-sheet">
        <button class="tracker-close" id="trackerClose" type="button">×</button>
        <h2 class="tracker-title">علّم الأرقام</h2>
        <p class="tracker-hint">اضغط خانة لحط X أحمر</p>
        <div class="tracker-grid">${rows}</div>
      </div>
    </div>
  `;
}

function bindTracker() {
  const openBtn = document.getElementById("trackerBtn");
  if (openBtn) openBtn.onclick = () => { ensureTrackerForRoom(); state.trackerOpen = true; render(); };
  const closeBtn = document.getElementById("trackerClose");
  if (closeBtn) closeBtn.onclick = () => { state.trackerOpen = false; render(); };
  const overlay = document.getElementById("trackerOverlay");
  if (overlay) overlay.onclick = (e) => { if (e.target === overlay) { state.trackerOpen = false; render(); } };
  document.querySelectorAll(".tracker-cell").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.key;
      if (state.crossed.has(key)) state.crossed.delete(key);
      else state.crossed.add(key);
      render();
    };
  });
}

function bindCopy() {
  const btn = document.getElementById("copyCode");
  if (!btn) return;
  btn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl());
      btn.textContent = "تم النسخ";
      setTimeout(() => { btn.textContent = "نسخ الرابط"; }, 1400);
    } catch {
      prompt("انسخ الرابط:", inviteUrl());
    }
  };
}

function bindRoomChrome() {
  bindCopy();
  bindTracker();
  bindInfo();
  bindInvites();
  bindSettings();
}

function playersBlock() {
  return `
    <div class="players">
      ${state.room.players
        .map(
          (p) => `
        <div class="player-card ${p.isYou ? "you" : ""}">
          <div class="name">${escapeHtml(p.name)}${p.isYou ? " (أنت)" : ""}</div>
          <div class="meta">${p.ready || p.hasSecret ? "جاهز ✓" : "يختار رقمه..."}</div>
        </div>`
        )
        .join("")}
      ${
        state.room.players.length < 2
          ? `<div class="player-card"><div class="name">بانتظار خصم</div><div class="meta waiting-dots">ادعُه من تحت</div></div>`
          : ""
      }
    </div>
  `;
}

function mySecretBar() {
  const secret = state.room?.mySecret;
  if (!secret) return "";
  return `
    <div class="my-secret">
      <span>رقمك</span>
      <strong>${escapeHtml(secret)}</strong>
    </div>
  `;
}

function digitPad(draftKey, submitLabel) {
  const draft = state[draftKey];
  const need = digitCount();
  return `
    <div class="panel stack">
      <div>
        <label>الأرقام (${need})</label>
        <input class="digits" id="draftView" readonly value="${escapeHtml(draft)}" placeholder="${"•".repeat(need)}" />
      </div>
      <div class="digit-pad" id="pad">
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button type="button" data-d="${d}">${d}</button>`).join("")}
        <button type="button" class="action" data-act="del">⌫</button>
        <button type="button" class="action" data-act="clr">مسح</button>
      </div>
      ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
      <button class="btn btn-primary" id="submitDraft" ${state.busy || draft.length !== need ? "disabled" : ""}>${submitLabel}</button>
    </div>
  `;
}

function bindDigitPad(draftKey, onSubmit) {
  const need = digitCount();
  document.getElementById("pad").onclick = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.act === "del") {
      state[draftKey] = state[draftKey].slice(0, -1);
      state.error = "";
      render();
      return;
    }
    if (btn.dataset.act === "clr") {
      state[draftKey] = "";
      state.error = "";
      render();
      return;
    }
    if (btn.dataset.d == null) return;
    if (state[draftKey].length >= need) return;
    state[draftKey] += btn.dataset.d;
    state.error = "";
    render();
  };
  document.getElementById("submitDraft").onclick = onSubmit;
}

function historyBlock() {
  const guesses = [...(state.room.guesses || [])].reverse();
  if (!guesses.length) {
    return `<div class="panel"><p class="hint">ما فيه تخمينات لك بعد.</p></div>`;
  }
  return `
    <div class="history">
      ${guesses
        .map(
          (g, idx) => `
        <div class="guess-row">
          <div class="who">#${guesses.length - idx}</div>
          <div class="num">${escapeHtml(g.guess)}</div>
          <div class="score"><span class="badge pos">${g.correctPositions} صح</span></div>
        </div>`
        )
        .join("")}
    </div>
  `;
}

function turnBanner() {
  if (state.room.status !== "playing") return "";
  const myTurn = state.room.turn === state.playerId;
  const n = state.room.turnNumber || 1;
  const mine = (state.room.myGuessCount || 0) + (myTurn ? 1 : 0);
  return `
    <div class="turn-banner ${myTurn ? "you" : "them"}">
      <div class="turn-main">${myTurn ? "دورك الآن" : `دور ${escapeHtml(opponent()?.name || "الخصم")}`}</div>
      <div class="turn-sub">الدور رقم ${n} · تخمينك رقم ${Math.max(1, mine)}</div>
    </div>
  `;
}

function renderLobby() {
  ensureTrackerForRoom();
  app.innerHTML = `
    <section class="screen">
      ${roomHeader()}
      <div class="presence-slot">${presenceBanner()}</div>
      <p class="status-line">بانتظار انضمام الخصم<span class="waiting-dots"></span></p>
      ${playersBlock()}
      ${inviteBlock()}
      ${settingsBar()}
    </section>
    ${trackerOverlay()}${infoOverlay()}
  `;
  bindRoomChrome();
}

function renderSetup() {
  ensureTrackerForRoom();
  const self = me();
  app.innerHTML = `
    <section class="screen">
      ${roomHeader()}
      ${mySecretBar()}
      <p class="status-line">${self?.ready ? "تم تثبيت رقمك. بانتظار الخصم..." : `اختر ${digitCount()} أرقام وثبّتها`}</p>
      ${playersBlock()}
      ${
        self?.ready
          ? `<div class="panel"><p class="hint">رقمك محفوظ فوق. ما أحد يشوفه غيرك.</p></div>`
          : `${digitPad("secretDraft", "تثبيت الرقم")}
             <p class="hint">ممنوع تكرار نفس الرقم في كل الخانات (مثل ${"1".repeat(digitCount())}).</p>`
      }
      ${state.mode === "online" ? inviteBlock() : ""}
    </section>
    ${trackerOverlay()}${infoOverlay()}
  `;
  bindRoomChrome();
  if (!self?.ready) bindDigitPad("secretDraft", setSecret);
}

function renderPlay() {
  ensureTrackerForRoom();
  const myTurn = state.room.turn === state.playerId;
  app.innerHTML = `
    <section class="screen">
      ${roomHeader()}
      ${mySecretBar()}
      <div class="presence-slot">${presenceBanner()}</div>
      ${turnBanner()}
      ${timerBadge()}
      ${playersBlock()}
      ${
        myTurn
          ? `${digitPad("guessDraft", "أرسل التخمين")}
             <button class="btn btn-ghost" id="hintBtn" ${state.busy || state.room.hintUsed ? "disabled" : ""}>
               ${state.room.hintUsed ? "تم استخدام التلميح" : "تلميح (مرة واحدة)"}
             </button>
             ${state.lastHint ? `<p class="hint hint-ok">${escapeHtml(state.lastHint)}</p>` : ""}
             ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}`
          : `<div class="panel"><p class="hint waiting-dots">انتظر تخمين الخصم</p>
             ${state.lastHint ? `<p class="hint hint-ok">${escapeHtml(state.lastHint)}</p>` : ""}</div>`
      }
      ${historyBlock()}
      ${settingsBar()}
    </section>
    ${trackerOverlay()}${infoOverlay()}
  `;
  bindRoomChrome();
  if (myTurn) bindDigitPad("guessDraft", sendGuess);
  const hintBtn = document.getElementById("hintBtn");
  if (hintBtn) hintBtn.onclick = useHint;
}

function renderFinished() {
  ensureTrackerForRoom();
  const won = state.room.winner === state.playerId;
  const winnerName = playerName(state.room.winner);
  app.innerHTML = `
    <section class="screen">
      ${roomHeader()}
      ${mySecretBar()}
      <div class="win-box">
        <h2>${won ? "فزت 🔥" : "انتهت الجولة"}</h2>
        <p>${won ? "خمّنت رقم الخصم صح!" : `${escapeHtml(winnerName)} خمّن رقمك.`}</p>
        <p class="hint">سلسلتك الآن: <strong style="color:var(--lime)">${getStreak()}</strong> · أفضل سلسلة: ${getBestStreak()}</p>
        ${
          state.room.opponentSecret
            ? `<p class="reveal">رقم الخصم كان: <strong>${escapeHtml(state.room.opponentSecret)}</strong></p>`
            : ""
        }
        <button class="btn btn-primary" id="rematchBtn" ${state.busy ? "disabled" : ""}>إعادة المبارزة</button>
      </div>
      ${historyBlock()}
      <button class="btn btn-ghost" id="homeBtn">القائمة الرئيسية</button>
      ${settingsBar()}
    </section>
    ${trackerOverlay()}${infoOverlay()}
  `;
  bindRoomChrome();
  document.getElementById("rematchBtn").onclick = rematch;
  document.getElementById("homeBtn").onclick = goHome;
}

function goHome() {
  leaveRoomQuiet();
  if (roomChannel) {
    sb.removeChannel(roomChannel);
    roomChannel = null;
  }
  stopHeartbeat();
  stopTurnTimer();
  clearTracker();
  localStorage.removeItem("nd_active");
  state.infoOpen = false;
  state.presenceNote = "";
  state.room = null;
  state.playerId = null;
  state.mode = "online";
  state.aiSecret = null;
  state.aiCandidates = [];
  state.screen = "home";
  state.secretDraft = "";
  state.guessDraft = "";
  state.error = "";
  location.href = location.pathname;
}

async function createRoom() {
  const name = state.name.trim() || "لاعب 1";
  setBusy(true);
  setError("");
  const { data, error } = await sb.rpc("nd_create_room", {
    p_name: name,
    p_digit_count: state.digitCount,
  });
  setBusy(false);
  if (error) return setError(error.message || "فشل إنشاء الغرفة");
  if (!data?.ok) return setError(data?.error || "فشل إنشاء الغرفة");
  clearTracker();
  state.mode = "online";
  state.playerId = data.playerId;
  state.trackerGameKey = data.room.code;
  applyRoom(data.room, { silent: true });
  subscribeRoom(data.room.code);
  render();
}

async function joinRoom() {
  const name = state.name.trim() || "لاعب 2";
  const code = state.joinCode.trim().toUpperCase();
  if (!code) return setError("اكتب كود الغرفة");
  setBusy(true);
  setError("");
  const { data, error } = await sb.rpc("nd_join_room", { p_code: code, p_name: name });
  setBusy(false);
  if (error) return setError(error.message || "فشل الانضمام");
  if (!data?.ok) return setError(data?.error || "فشل الانضمام");
  clearTracker();
  state.mode = "online";
  state.playerId = data.playerId;
  state.digitCount = data.room.digitCount || 4;
  state.trackerGameKey = data.room.code;
  applyRoom(data.room, { silent: true });
  subscribeRoom(data.room.code);
  render();
}

function startAiGame() {
  const digits = state.digitCount;
  const myId = "human";
  const aiId = state.aiPlayerId;
  const name = state.name.trim() || "أنت";
  state.mode = "ai";
  state.playerId = myId;
  state.aiSecret = randomSecret(digits);
  state.aiCandidates = buildCandidates(digits);
  clearTracker();
  state.trackerGameKey = "ai";
  state.presenceNote = "";
  state.room = {
    code: "AI",
    status: "setup",
    turn: null,
    winner: null,
    digitCount: digits,
    hintUsed: false,
    vsAi: true,
    turnNumber: 1,
    myGuessCount: 0,
    mySecret: null,
    opponentSecret: null,
    guesses: [],
    players: [
      { id: myId, name, ready: false, isYou: true, hasSecret: false },
      { id: aiId, name: "الكمبيوتر", ready: true, isYou: false, hasSecret: true },
    ],
  };
  state.screen = "setup";
  state.secretDraft = "";
  state.guessDraft = "";
  localStorage.removeItem("nd_active");
  render();
}

function aiPublicRoomPatch(extra = {}) {
  Object.assign(state.room, extra);
  const myGuesses = (state.room._allGuesses || []).filter((g) => g.by === state.playerId);
  state.room.guesses = myGuesses.map(({ guess, correctPositions }) => ({ guess, correctPositions }));
  state.room.myGuessCount = myGuesses.length;
  state.room.turnNumber = Math.max(1, Math.floor((state.room._allGuesses || []).length / 2) + 1);
}

async function setSecret() {
  const check = isValidNumber(state.secretDraft);
  if (!check.ok) return setError(check.error);

  if (state.mode === "ai") {
    state.room.mySecret = state.secretDraft;
    state.room.players = state.room.players.map((p) =>
      p.isYou ? { ...p, ready: true, hasSecret: true } : p
    );
    state.room.status = "playing";
    state.room.turn = Math.random() < 0.5 ? state.playerId : state.aiPlayerId;
    state.room._allGuesses = [];
    state.secretDraft = "";
    applyRoom(state.room);
    render();
    if (state.room.turn === state.aiPlayerId) setTimeout(aiTakeTurn, 650);
    return;
  }

  setBusy(true);
  setError("");
  const { data, error } = await sb.rpc("nd_set_secret", {
    p_code: state.room.code,
    p_player_id: state.playerId,
    p_secret: state.secretDraft,
  });
  setBusy(false);
  if (error) return setError(error.message || "ما قدرنا نثبت الرقم");
  if (!data?.ok) return setError(data?.error || "ما قدرنا نثبت الرقم");
  state.secretDraft = "";
  applyRoom(data.room);
  render();
}

function aiTakeTurn() {
  if (state.mode !== "ai" || state.room?.status !== "playing") return;
  if (state.room.turn !== state.aiPlayerId) return;
  if (!state.aiCandidates.length) state.aiCandidates = buildCandidates(digitCount());
  let guess = aiPickGuess();
  // لا تكرر نفس التخمين
  const used = new Set((state.room._allGuesses || []).filter((g) => g.by === state.aiPlayerId).map((g) => g.guess));
  if (used.has(guess)) {
    const alt = state.aiCandidates.find((c) => !used.has(c));
    if (alt) guess = alt;
  }
  const correct = scoreGuess(state.room.mySecret, guess);
  aiLearn(guess, correct);
  state.room._allGuesses.push({ by: state.aiPlayerId, guess, correctPositions: correct });
  soundGuess(correct, digitCount());
  if (correct === digitCount()) {
    state.room.status = "finished";
    state.room.winner = state.aiPlayerId;
    state.room.turn = null;
    state.room.opponentSecret = state.aiSecret;
  } else {
    state.room.turn = state.playerId;
  }
  aiPublicRoomPatch();
  applyRoom(state.room);
  render();
}

async function sendGuess() {
  const check = isValidNumber(state.guessDraft);
  if (!check.ok) return setError(check.error);

  if (state.mode === "ai") {
    const guess = state.guessDraft;
    const correct = scoreGuess(state.aiSecret, guess);
    state.room._allGuesses = state.room._allGuesses || [];
    state.room._allGuesses.push({ by: state.playerId, guess, correctPositions: correct });
    soundGuess(correct, digitCount());
    state.guessDraft = "";
    if (correct === digitCount()) {
      state.room.status = "finished";
      state.room.winner = state.playerId;
      state.room.turn = null;
      state.room.opponentSecret = state.aiSecret;
      aiPublicRoomPatch();
      applyRoom(state.room);
      render();
      return;
    }
    state.room.turn = state.aiPlayerId;
    aiPublicRoomPatch();
    applyRoom(state.room);
    render();
    setTimeout(aiTakeTurn, 700);
    return;
  }

  setBusy(true);
  setError("");
  const { data, error } = await sb.rpc("nd_guess", {
    p_code: state.room.code,
    p_player_id: state.playerId,
    p_guess: state.guessDraft,
  });
  setBusy(false);
  if (error) return setError(error.message || "فشل التخمين");
  if (!data?.ok) return setError(data?.error || "فشل التخمين");
  soundGuess(data.correctPositions || 0, digitCount());
  state.guessDraft = "";
  applyRoom(data.room, { silent: true });
  render();
}

async function useHint() {
  if (state.mode === "ai") {
    if (state.room.hintUsed) return setError("استخدمت التلميح مسبقاً");
    const mine = (state.room._allGuesses || []).filter((g) => g.by === state.playerId);
    const last = mine[mine.length - 1];
    if (!last) return setError("خمّن مرة أولاً بعدين استخدم التلميح");
    if (!last.correctPositions) return setError("آخر تخمين ما فيه أي خانة صحيحة");
    const positions = [];
    for (let i = 0; i < last.guess.length; i++) {
      if (last.guess[i] === state.aiSecret[i]) positions.push(i + 1);
    }
    const pick = positions[Math.floor(Math.random() * positions.length)];
    state.room.hintUsed = true;
    state.lastHint = `الخانة رقم ${pick} من آخر تخمينك صحيحة (بدون كشف الرقم)`;
    beep(700, 0.1, "triangle");
    render();
    return;
  }

  setBusy(true);
  setError("");
  const { data, error } = await sb.rpc("nd_use_hint", {
    p_code: state.room.code,
    p_player_id: state.playerId,
  });
  setBusy(false);
  if (error) return setError(error.message || "فشل التلميح");
  if (!data?.ok) return setError(data?.error || "فشل التلميح");
  state.lastHint = data.message || "";
  beep(700, 0.1, "triangle");
  applyRoom(data.room, { silent: true });
  render();
}

async function rematch() {
  if (state.mode === "ai") {
    startAiGame();
    return;
  }
  setBusy(true);
  const { data, error } = await sb.rpc("nd_rematch", {
    p_code: state.room.code,
    p_player_id: state.playerId,
  });
  setBusy(false);
  if (error) return setError(error.message || "فشل إعادة اللعب");
  if (!data?.ok) return setError(data?.error || "فشل إعادة اللعب");
  state.crossed = new Set();
  state.trackerOpen = false;
  state.lastHint = "";
  state.secretDraft = "";
  state.guessDraft = "";
  applyRoom(data.room, { silent: true });
  render();
}

window.addEventListener("online", () => {
  if (state.presenceNote && state.presenceNote.includes("نتّك")) state.presenceNote = "رجع النت... استنى شوي";
  if (state.mode === "online" && state.room?.code) {
    subscribeRoom(state.room.code);
    refreshRoom();
  } else {
    tryReconnect();
  }
});

window.addEventListener("offline", () => {
  state.presenceNote = "نتّك انقطع... استنى شوي";
  render();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.mode === "online" && state.room?.code) {
    refreshRoom();
  }
});

(async function boot() {
  applyTheme();
  const params = new URLSearchParams(location.search);
  const code = (params.get("code") || "").toUpperCase().slice(0, 5);
  if (code) state.joinCode = code;
  const restored = await tryReconnect();
  if (!restored) render();
})();
