const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;
const DIGIT_COUNT = 4;

/** @type {Map<string, Room>} */
const rooms = new Map();

/**
 * @typedef {{ id: string, name: string, secret: string | null, ready: boolean }} Player
 * @typedef {{
 *   code: string,
 *   players: Player[],
 *   turn: string | null,
 *   status: 'waiting' | 'setup' | 'playing' | 'finished',
 *   guesses: Array<{ by: string, guess: string, correctPositions: number, correctDigits: number }>,
 *   winner: string | null,
 *   createdAt: number
 * }} Room
 */

app.use(express.static(path.join(__dirname, "public")));

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  if (rooms.has(code)) return generateCode();
  return code;
}

function isValidSecret(secret) {
  if (typeof secret !== "string" || secret.length !== DIGIT_COUNT) return false;
  if (!/^\d+$/.test(secret)) return false;
  return new Set(secret).size === DIGIT_COUNT;
}

function scoreGuess(secret, guess) {
  let correctPositions = 0;
  for (let i = 0; i < DIGIT_COUNT; i++) {
    if (guess[i] === secret[i]) correctPositions++;
  }
  const secretCounts = {};
  const guessCounts = {};
  for (let i = 0; i < DIGIT_COUNT; i++) {
    secretCounts[secret[i]] = (secretCounts[secret[i]] || 0) + 1;
    guessCounts[guess[i]] = (guessCounts[guess[i]] || 0) + 1;
  }
  let correctDigits = 0;
  for (const d of Object.keys(guessCounts)) {
    correctDigits += Math.min(guessCounts[d], secretCounts[d] || 0);
  }
  return { correctPositions, correctDigits };
}

function publicRoom(room, viewerId) {
  return {
    code: room.code,
    status: room.status,
    turn: room.turn,
    winner: room.winner,
    guesses: room.guesses,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      isYou: p.id === viewerId,
      hasSecret: Boolean(p.secret),
    })),
  };
}

function emitRoom(room) {
  for (const p of room.players) {
    io.to(p.id).emit("room:update", publicRoom(room, p.id));
  }
}

function cleanupStaleRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > 1000 * 60 * 60 * 6) {
      rooms.delete(code);
    }
  }
}
setInterval(cleanupStaleRooms, 60_000);

io.on("connection", (socket) => {
  let joinedCode = null;

  socket.on("room:create", ({ name }, cb) => {
    const playerName = String(name || "لاعب 1").trim().slice(0, 20) || "لاعب 1";
    const code = generateCode();
    const room = {
      code,
      players: [{ id: socket.id, name: playerName, secret: null, ready: false }],
      turn: null,
      status: "waiting",
      guesses: [],
      winner: null,
      createdAt: Date.now(),
    };
    rooms.set(code, room);
    joinedCode = code;
    socket.join(code);
    cb?.({ ok: true, room: publicRoom(room, socket.id) });
  });

  socket.on("room:join", ({ code, name }, cb) => {
    const roomCode = String(code || "")
      .trim()
      .toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) return cb?.({ ok: false, error: "الغرفة غير موجودة" });
    if (room.players.length >= 2) return cb?.({ ok: false, error: "الغرفة ممتلئة" });
    if (room.status !== "waiting") return cb?.({ ok: false, error: "اللعبة بدأت بالفعل" });

    const playerName = String(name || "لاعب 2").trim().slice(0, 20) || "لاعب 2";
    room.players.push({ id: socket.id, name: playerName, secret: null, ready: false });
    room.status = "setup";
    joinedCode = roomCode;
    socket.join(roomCode);
    emitRoom(room);
    cb?.({ ok: true, room: publicRoom(room, socket.id) });
  });

  socket.on("game:set-secret", ({ secret }, cb) => {
    const room = joinedCode && rooms.get(joinedCode);
    if (!room) return cb?.({ ok: false, error: "لست في غرفة" });
    if (room.status !== "setup") return cb?.({ ok: false, error: "لا يمكن تعيين الرقم الآن" });

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return cb?.({ ok: false, error: "لاعب غير موجود" });
    if (!isValidSecret(secret)) {
      return cb?.({
        ok: false,
        error: "لازم ٤ أرقام مختلفة (مثال: 7291)",
      });
    }

    player.secret = secret;
    player.ready = true;

    if (room.players.length === 2 && room.players.every((p) => p.ready)) {
      room.status = "playing";
      room.turn = room.players[Math.floor(Math.random() * 2)].id;
    }

    emitRoom(room);
    cb?.({ ok: true });
  });

  socket.on("game:guess", ({ guess }, cb) => {
    const room = joinedCode && rooms.get(joinedCode);
    if (!room) return cb?.({ ok: false, error: "لست في غرفة" });
    if (room.status !== "playing") return cb?.({ ok: false, error: "اللعبة غير جارية" });
    if (room.turn !== socket.id) return cb?.({ ok: false, error: "مو دورك" });

    const guessStr = String(guess || "").trim();
    if (!isValidSecret(guessStr)) {
      return cb?.({
        ok: false,
        error: "التخمين لازم يكون ٤ أرقام مختلفة",
      });
    }

    const me = room.players.find((p) => p.id === socket.id);
    const opponent = room.players.find((p) => p.id !== socket.id);
    if (!me || !opponent || !opponent.secret) {
      return cb?.({ ok: false, error: "خطأ في حالة اللعبة" });
    }

    const { correctPositions, correctDigits } = scoreGuess(opponent.secret, guessStr);
    room.guesses.push({
      by: socket.id,
      guess: guessStr,
      correctPositions,
      correctDigits,
    });

    if (correctPositions === DIGIT_COUNT) {
      room.status = "finished";
      room.winner = socket.id;
      room.turn = null;
    } else {
      room.turn = opponent.id;
    }

    emitRoom(room);
    cb?.({
      ok: true,
      correctPositions,
      correctDigits,
      won: correctPositions === DIGIT_COUNT,
    });
  });

  socket.on("game:rematch", (cb) => {
    const room = joinedCode && rooms.get(joinedCode);
    if (!room) return cb?.({ ok: false, error: "لست في غرفة" });
    if (room.players.length < 2) return cb?.({ ok: false, error: "تحتاج خصم" });

    for (const p of room.players) {
      p.secret = null;
      p.ready = false;
    }
    room.status = "setup";
    room.turn = null;
    room.guesses = [];
    room.winner = null;
    room.createdAt = Date.now();
    emitRoom(room);
    cb?.({ ok: true });
  });

  socket.on("disconnect", () => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== socket.id);
    if (room.players.length === 0) {
      rooms.delete(joinedCode);
      return;
    }

    if (room.status === "playing" || room.status === "setup" || room.status === "finished") {
      room.status = "waiting";
      room.turn = null;
      room.guesses = [];
      room.winner = null;
      for (const p of room.players) {
        p.secret = null;
        p.ready = false;
      }
    }
    emitRoom(room);
    io.to(joinedCode).emit("room:opponent-left");
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Number Duel running on http://0.0.0.0:${PORT}`);
});
