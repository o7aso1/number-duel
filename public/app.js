const app = document.getElementById("app");
const socket = io({ transports: ["websocket", "polling"] });

const state = {
  screen: "home",
  name: localStorage.getItem("nd_name") || "",
  room: null,
  error: "",
  secretDraft: "",
  guessDraft: "",
  busy: false,
  joinCode: "",
  trackerOpen: false,
  crossed: new Set(),
  trackerGameKey: null,
};

function clearTracker() {
  state.crossed = new Set();
  state.trackerOpen = false;
  state.trackerGameKey = null;
}

function ensureTrackerForRoom() {
  const key = state.room?.code || null;
  if (!key) return;
  if (state.trackerGameKey !== key) {
    state.crossed = new Set();
    state.trackerGameKey = key;
    state.trackerOpen = false;
  }
}

function escapeHtml(str) {
  return String(str)
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

function render() {
  if (state.screen === "home") return renderHome();
  if (!state.room) return renderHome();
  if (state.room.status === "waiting") return renderLobby();
  if (state.room.status === "setup") return renderSetup();
  if (state.room.status === "playing") return renderPlay();
  if (state.room.status === "finished") return renderFinished();
  return renderHome();
}

function renderHome() {
  app.innerHTML = `
    <section class="screen">
      <div>
        <h1 class="brand">مبارزة<br /><span>الأرقام</span></h1>
        <p class="lede">كل واحد يختار ٤ أرقام سرية، وتتحدون تخمين أرقام بعض على جوالات مختلفة.</p>
      </div>
      <div class="panel stack">
        <div>
          <label for="name">اسمك</label>
          <input id="name" maxlength="20" placeholder="مثلاً: قاسم" value="${escapeHtml(state.name)}" />
        </div>
        ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
        <button class="btn btn-primary" id="createBtn" ${state.busy ? "disabled" : ""}>إنشاء غرفة</button>
        <div class="row">
          <input id="joinCode" class="digits" maxlength="5" placeholder="الكود" value="${escapeHtml(state.joinCode)}" style="letter-spacing:0.2em;font-size:1.3rem" />
          <button class="btn btn-sky" id="joinBtn" ${state.busy ? "disabled" : ""}>انضم</button>
        </div>
        <p class="hint">شارك كود الغرفة مع صاحبك ويلعبون من أي جهازين على الإنترنت.</p>
      </div>
    </section>
  `;

  const nameInput = document.getElementById("name");
  nameInput.addEventListener("input", (e) => {
    state.name = e.target.value;
    localStorage.setItem("nd_name", state.name);
  });

  document.getElementById("joinCode").addEventListener("input", (e) => {
    state.joinCode = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    e.target.value = state.joinCode;
  });

  document.getElementById("createBtn").onclick = createRoom;
  document.getElementById("joinBtn").onclick = joinRoom;
}

function roomHeader() {
  return `
    <div class="topbar">
      <div class="pill">الغرفة <strong>${escapeHtml(state.room.code)}</strong></div>
      <div class="topbar-actions">
        <button class="btn btn-ghost copy-btn" id="trackerBtn" type="button">القائمة</button>
        <button class="btn btn-ghost copy-btn" id="copyCode" type="button">نسخ الرابط</button>
      </div>
    </div>
  `;
}

function trackerCellKey(digit, slot) {
  return `${digit}-${slot}`;
}

function trackerOverlay() {
  if (!state.trackerOpen) return "";
  const rows = Array.from({ length: 10 }, (_, digit) => {
    const cells = [0, 1, 2, 3]
      .map((slot) => {
        const key = trackerCellKey(digit, slot);
        const crossed = state.crossed.has(key);
        return `
          <button type="button" class="tracker-cell ${crossed ? "crossed" : ""}" data-key="${key}" aria-label="${digit}">
            <span>${digit}</span>
            ${crossed ? '<i class="tracker-x" aria-hidden="true">✕</i>' : ""}
          </button>`;
      })
      .join("");
    return `<div class="tracker-row">${cells}</div>`;
  }).join("");

  return `
    <div class="tracker-overlay" id="trackerOverlay" role="dialog" aria-modal="true" aria-label="قائمة الأرقام">
      <div class="tracker-sheet">
        <button class="tracker-close" id="trackerClose" type="button" aria-label="إغلاق">×</button>
        <h2 class="tracker-title">علّم الأرقام</h2>
        <p class="tracker-hint">اضغط الرقم لحاله عشان تحط عليه X</p>
        <div class="tracker-grid">${rows}</div>
      </div>
    </div>
  `;
}

function bindTracker() {
  const openBtn = document.getElementById("trackerBtn");
  if (openBtn) {
    openBtn.onclick = () => {
      ensureTrackerForRoom();
      state.trackerOpen = true;
      render();
    };
  }

  const closeBtn = document.getElementById("trackerClose");
  if (closeBtn) {
    closeBtn.onclick = () => {
      state.trackerOpen = false;
      render();
    };
  }

  const overlay = document.getElementById("trackerOverlay");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        state.trackerOpen = false;
        render();
      }
    });
  }

  document.querySelectorAll(".tracker-cell").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.key;
      if (state.crossed.has(key)) state.crossed.delete(key);
      else state.crossed.add(key);
      render();
    };
  });
}

function bindRoomChrome() {
  bindCopy();
  bindTracker();
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
          ? `<div class="player-card"><div class="name">بانتظار خصم</div><div class="meta waiting-dots">يكتب الكود</div></div>`
          : ""
      }
    </div>
  `;
}

function bindCopy() {
  const btn = document.getElementById("copyCode");
  if (!btn) return;
  btn.onclick = async () => {
    const url = `${location.origin}?code=${state.room.code}`;
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = "تم النسخ";
      setTimeout(() => {
        btn.textContent = "نسخ الرابط";
      }, 1500);
    } catch {
      prompt("انسخ الرابط:", url);
    }
  };
}

function renderLobby() {
  ensureTrackerForRoom();
  app.innerHTML = `
    <section class="screen">
      ${roomHeader()}
      <p class="status-line">بانتظار انضمام الخصم<span class="waiting-dots"></span></p>
      ${playersBlock()}
      <div class="panel stack">
        <p class="hint">أعطِ صاحبك هذا الكود: <strong style="color:var(--lime);font-family:var(--num);letter-spacing:.15em">${escapeHtml(state.room.code)}</strong></p>
        <p class="hint">أو انسخ رابط الدعوة وابعثه له مباشرة.</p>
      </div>
    </section>
    ${trackerOverlay()}
  `;
  bindRoomChrome();
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

function digitPad(draftKey, submitLabel, onSubmit) {
  const draft = state[draftKey];
  return `
    <div class="panel stack">
      <div>
        <label>الأرقام</label>
        <input class="digits" id="draftView" readonly value="${escapeHtml(draft)}" placeholder="••••" />
      </div>
      <div class="digit-pad" id="pad">
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
          .map((d) => `<button type="button" data-d="${d}">${d}</button>`)
          .join("")}
        <button type="button" class="action" data-act="del">⌫</button>
        <button type="button" class="action" data-act="clr">مسح</button>
      </div>
      ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
      <button class="btn btn-primary" id="submitDraft" ${state.busy || draft.length !== 4 ? "disabled" : ""}>${submitLabel}</button>
    </div>
  `;
}

function bindDigitPad(draftKey, onSubmit) {
  const pad = document.getElementById("pad");
  pad.addEventListener("click", (e) => {
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
    const d = btn.dataset.d;
    if (d == null) return;
    if (state[draftKey].length >= 4) return;
    state[draftKey] += d;
    state.error = "";
    render();
  });
  document.getElementById("submitDraft").onclick = onSubmit;
}

function renderSetup() {
  ensureTrackerForRoom();
  const self = me();
  app.innerHTML = `
    <section class="screen">
      ${roomHeader()}
      ${mySecretBar()}
      <p class="status-line">${self?.ready ? "تم تثبيت رقمك. بانتظار الخصم..." : "اختر ٤ أرقام وثبّتها"}</p>
      ${playersBlock()}
      ${
        self?.ready
          ? `<div class="panel"><p class="hint">رقمك السري محفوظ فوق. ما أحد يشوفه غيرك. لما الخصم يثبت رقمه تبدأ المبارزة.</p></div>`
          : `${digitPad("secretDraft", "تثبيت الرقم", setSecret)}
             <p class="hint">٤ أرقام من ٠ إلى ٩، والتكرار مسموح. الخصم يحاول يخمنها وأنت تحاول تخمن رقمه.</p>`
      }
    </section>
    ${trackerOverlay()}
  `;
  bindRoomChrome();
  if (!self?.ready) bindDigitPad("secretDraft", setSecret);
}

function historyBlock() {
  const guesses = [...(state.room.guesses || [])].reverse();
  if (!guesses.length) {
    return `<div class="panel"><p class="hint">ما فيه تخمينات لك بعد. ابدأ أول ضربة!</p></div>`;
  }
  return `
    <div class="history">
      ${guesses
        .map(
          (g) => `
            <div class="guess-row">
              <div class="num">${escapeHtml(g.guess)}</div>
              <div class="score">
                <span class="badge pos" title="في الخانة الصحيحة">${g.correctPositions} صح</span>
              </div>
            </div>`
        )
        .join("")}
    </div>
    <div class="legend">
      <span>الرقم = كم خانة صحيحة في مكانها فقط</span>
    </div>
  `;
}

function renderPlay() {
  ensureTrackerForRoom();
  const myTurn = state.room.turn === socket.id;
  const opp = opponent();
  app.innerHTML = `
    <section class="screen">
      ${roomHeader()}
      ${mySecretBar()}
      <p class="status-line ${myTurn ? "turn-you" : "turn-them"}">
        ${myTurn ? "دورك — خمّن رقم الخصم" : `دور ${escapeHtml(opp?.name || "الخصم")}...`}
      </p>
      ${playersBlock()}
      ${
        myTurn
          ? digitPad("guessDraft", "أرسل التخمين", sendGuess)
          : `<div class="panel"><p class="hint waiting-dots">انتظر تخمين الخصم</p></div>`
      }
      ${historyBlock()}
    </section>
    ${trackerOverlay()}
  `;
  bindRoomChrome();
  if (myTurn) bindDigitPad("guessDraft", sendGuess);
}

function renderFinished() {
  ensureTrackerForRoom();
  const won = state.room.winner === socket.id;
  const winnerName = playerName(state.room.winner);
  app.innerHTML = `
    <section class="screen">
      ${roomHeader()}
      ${mySecretBar()}
      <div class="win-box">
        <h2>${won ? "فزت 🔥" : "انتهت الجولة"}</h2>
        <p>${won ? "خمّنت رقم الخصم صح!" : `${escapeHtml(winnerName)} خمّن رقمك.`}</p>
        <button class="btn btn-primary" id="rematchBtn" ${state.busy ? "disabled" : ""}>إعادة المبارزة</button>
      </div>
      ${historyBlock()}
      <button class="btn btn-ghost" id="homeBtn">القائمة الرئيسية</button>
    </section>
    ${trackerOverlay()}
  `;
  bindRoomChrome();
  document.getElementById("rematchBtn").onclick = rematch;
  document.getElementById("homeBtn").onclick = () => {
    clearTracker();
    state.room = null;
    state.screen = "home";
    state.secretDraft = "";
    state.guessDraft = "";
    state.error = "";
    location.href = location.pathname;
  };
}

function createRoom() {
  const name = state.name.trim() || "لاعب 1";
  setBusy(true);
  setError("");
  socket.emit("room:create", { name }, (res) => {
    setBusy(false);
    if (!res?.ok) return setError(res?.error || "فشل إنشاء الغرفة");
    clearTracker();
    state.room = res.room;
    state.trackerGameKey = res.room.code;
    state.screen = "lobby";
    state.secretDraft = "";
    render();
  });
}

function joinRoom() {
  const name = state.name.trim() || "لاعب 2";
  const code = state.joinCode.trim().toUpperCase();
  if (!code) return setError("اكتب كود الغرفة");
  setBusy(true);
  setError("");
  socket.emit("room:join", { name, code }, (res) => {
    setBusy(false);
    if (!res?.ok) return setError(res?.error || "فشل الانضمام");
    clearTracker();
    state.room = res.room;
    state.trackerGameKey = res.room.code;
    state.screen = "setup";
    state.secretDraft = "";
    render();
  });
}

function setSecret() {
  setBusy(true);
  setError("");
  socket.emit("game:set-secret", { secret: state.secretDraft }, (res) => {
    setBusy(false);
    if (!res?.ok) return setError(res?.error || "ما قدرنا نثبت الرقم");
    state.secretDraft = "";
  });
}

function sendGuess() {
  setBusy(true);
  setError("");
  socket.emit("game:guess", { guess: state.guessDraft }, (res) => {
    setBusy(false);
    if (!res?.ok) return setError(res?.error || "فشل التخمين");
    state.guessDraft = "";
  });
}

function rematch() {
  setBusy(true);
  socket.emit("game:rematch", (res) => {
    setBusy(false);
    if (!res?.ok) return setError(res?.error || "فشل إعادة اللعب");
    state.crossed = new Set();
    state.trackerOpen = false;
    state.secretDraft = "";
    state.guessDraft = "";
  });
}

socket.on("room:update", (room) => {
  const prevStatus = state.room?.status;
  state.room = room;
  state.error = "";
  if (room.status === "waiting") state.screen = "lobby";
  else if (room.status === "setup") state.screen = "setup";
  else if (room.status === "playing") state.screen = "play";
  else if (room.status === "finished") state.screen = "finished";
  // إعادة المبارزة من الخصم تعتبر لعبة جديدة
  if (prevStatus === "finished" && room.status === "setup") {
    state.crossed = new Set();
    state.trackerOpen = false;
  }
  render();
});

socket.on("room:opponent-left", () => {
  state.error = "الخصم طلع من الغرفة";
  state.secretDraft = "";
  state.guessDraft = "";
  state.crossed = new Set();
  state.trackerOpen = false;
  render();
});

socket.on("connect_error", () => {
  if (state.screen === "home") setError("ما قدرنا نتصل بالسيرفر. حدّث الصفحة.");
});

(function bootFromQuery() {
  const params = new URLSearchParams(location.search);
  const code = (params.get("code") || "").toUpperCase();
  if (code) state.joinCode = code.slice(0, 5);
  render();
})();
