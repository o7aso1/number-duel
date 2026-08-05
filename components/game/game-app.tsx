'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildCandidates,
  countCorrect,
  filterCandidates,
  generateSecret,
  isValidGuess,
  isValidSecret,
  normalizeTheme,
  pickSmartGuess,
  storageGet,
  storageRemove,
  storageSet,
  type ChatMessage,
  type Difficulty,
  type Guess,
  type Screen,
  type ThemeName,
  type TimerOption,
} from '@/lib/game'
import type { PresenceKind } from '@/components/game/ui/presence-banner'
import { LoginScreen } from '@/components/game/screens/login-screen'
import { HomeScreen } from '@/components/game/screens/home-screen'
import { LobbyScreen } from '@/components/game/screens/lobby-screen'
import { SetupScreen } from '@/components/game/screens/setup-screen'
import { PlayScreen } from '@/components/game/screens/play-screen'
import { FinishedScreen } from '@/components/game/screens/finished-screen'
import { InfoSheet } from '@/components/game/overlays/info-sheet'
import { TrackerSheet } from '@/components/game/overlays/tracker-sheet'
import { ChatSheet } from '@/components/game/overlays/chat-sheet'
import { ConfirmExitSheet } from '@/components/game/overlays/confirm-exit-sheet'
import { MatchSetupSheet, type MatchMode } from '@/components/game/overlays/match-setup-sheet'
import { Tutorial } from '@/components/game/overlays/tutorial'
import { getSupabase } from '@/lib/supabase'
import { playSfx } from '@/lib/sfx'

type Mode = 'cpu' | 'room'

type CpuSession = {
  v: 1
  screen: Screen
  length: Difficulty
  playerSecret: string
  opponentSecret: string
  guesses: Guess[]
  cpuCandidates: string[]
  isMyTurn: boolean
  turnNumber: number
  hintUsed: boolean
  marked: string[]
  won: boolean
  cpuPickingSecret: boolean
}

type RoomPayload = {
  code: string
  status: string
  turn: string | null
  winner: string | null
  digitCount: number
  hintUsed: boolean
  turnNumber: number
  myGuessCount: number
  mySecret: string | null
  opponentSecret: string | null
  opponentPresence?: string
  guesses: { guess: string; correctPositions: number }[]
  players: { id: string; name: string; ready: boolean; isYou: boolean; hasSecret: boolean }[]
}

function mapPresence(p?: string): PresenceKind {
  if (p === 'left') return 'left'
  if (p === 'offline') return 'offline'
  if (p === 'slow') return 'wait'
  return 'online'
}

function vibrate(pattern: number | number[] = 25) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* ignore */
  }
}

export function GameApp() {
  const [screen, setScreen] = useState<Screen>('login')
  const [nickname, setNickname] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>(4)
  const [theme, setTheme] = useState<ThemeName>('classic')
  const [muted, setMuted] = useState(false)
  const [timer, setTimer] = useState<TimerOption>(0)
  const [joinCode, setJoinCode] = useState('')
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [booted, setBooted] = useState(false)

  const [infoOpen, setInfoOpen] = useState(false)
  const [trackerOpen, setTrackerOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialSeen, setTutorialSeen] = useState(false)
  const [marked, setMarked] = useState<Set<string>>(new Set())

  const [mode, setMode] = useState<Mode>('cpu')
  const [roomCode, setRoomCode] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [length, setLength] = useState<Difficulty>(4)
  const [playerSecret, setPlayerSecret] = useState('')
  const [opponentSecret, setOpponentSecret] = useState('')
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [cpuCandidates, setCpuCandidates] = useState<string[]>([])
  const [isMyTurn, setIsMyTurn] = useState(true)
  const [turnNumber, setTurnNumber] = useState(1)
  const [hintUsed, setHintUsed] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [presence, setPresence] = useState<PresenceKind>('online')
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [won, setWon] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cpuPickingSecret, setCpuPickingSecret] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [unreadChat, setUnreadChat] = useState(0)
  const [matchSetupOpen, setMatchSetupOpen] = useState(false)
  const [matchMode, setMatchMode] = useState<MatchMode>('create')
  const [exitOpen, setExitOpen] = useState(false)

  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>['channel']> | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streakKeyRef = useRef<string | null>(null)
  const cpuPrepRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chatOpenRef = useRef(false)

  useEffect(() => {
    chatOpenRef.current = chatOpen
    if (chatOpen) setUnreadChat(0)
  }, [chatOpen])

  // Load prefs + resume match
  useEffect(() => {
    setNickname(storageGet('nd_name', ''))
    setDifficulty(storageGet<Difficulty>('nd_digits', 4))
    setTheme(normalizeTheme(storageGet('nd_theme', 'classic')))
    setMuted(storageGet('nd_muted', false))
    setTimer(storageGet<TimerOption>('nd_timer', 0))
    setStreak(storageGet('nd_streak', 0))
    setBestStreak(storageGet('nd_best_streak', 0))
    const seen = storageGet('nd_tutorial_done', false)
    setTutorialSeen(seen)
    const params = new URLSearchParams(window.location.search)
    const code = (params.get('code') || '').toUpperCase()
    if (code) setJoinCode(code.slice(0, 5))
    const logged = storageGet('nd_logged', false)
    if (logged) setScreen('home')
    setBooted(true)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    storageSet('nd_theme', theme)
  }, [theme])

  useEffect(() => storageSet('nd_name', nickname), [nickname])
  useEffect(() => storageSet('nd_digits', difficulty), [difficulty])
  useEffect(() => storageSet('nd_muted', muted), [muted])
  useEffect(() => storageSet('nd_timer', timer), [timer])
  useEffect(() => storageSet('nd_streak', streak), [streak])
  useEffect(() => storageSet('nd_best_streak', bestStreak), [bestStreak])

  const stopRealtime = useCallback(() => {
    const sb = getSupabase()
    if (channelRef.current) {
      sb.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const applyOnlineRoom = useCallback(
    (room: RoomPayload, pid: string, opts?: { silent?: boolean }) => {
      setRoomCode(room.code)
      setLength((room.digitCount as Difficulty) || 4)
      setPlayerSecret(room.mySecret || '')
      setOpponentSecret(room.opponentSecret || '')
      setGuesses(
        (room.guesses || []).map((g) => ({
          value: g.guess,
          correct: g.correctPositions,
        })),
      )
      setHintUsed(Boolean(room.hintUsed))
      setTurnNumber(room.turnNumber || 1)
      setIsMyTurn(room.turn === pid)
      setPresence(mapPresence(room.opponentPresence))

      if (room.status === 'waiting') setScreen('lobby')
      else if (room.status === 'setup') setScreen('setup')
      else if (room.status === 'playing') {
        setScreen('play')
        if (room.turn === pid && timer > 0 && !opts?.silent) {
          setSecondsLeft(timer)
        }
      } else if (room.status === 'finished') {
        const playerWon = room.winner === pid
        setWon(playerWon)
        const key = `${room.code}:${room.winner}`
        if (streakKeyRef.current !== key) {
          streakKeyRef.current = key
          setStreak((s) => {
            const next = playerWon ? s + 1 : 0
            setBestStreak((b) => Math.max(b, next))
            return next
          })
          if (!opts?.silent) {
            playSfx(muted, playerWon ? 'win' : 'lose')
            vibrate(playerWon ? [40, 40, 80] : 40)
          }
        }
        setScreen('finished')
      }
    },
    [muted, timer],
  )

  const startHeartbeat = useCallback(
    (code: string, pid: string) => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      const tick = async () => {
        const sb = getSupabase()
        const { data } = await sb.rpc('nd_heartbeat', {
          p_code: code,
          p_player_id: pid,
        })
        if (data?.ok && data.room) applyOnlineRoom(data.room as RoomPayload, pid, { silent: true })
      }
      tick()
      heartbeatRef.current = setInterval(tick, 5000)
    },
    [applyOnlineRoom],
  )

  const appendChat = useCallback((msg: ChatMessage, code: string) => {
    setChatMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev
      const next = [...prev, msg].slice(-100)
      storageSet(`nd_chat_${code}`, next)
      return next
    })
    if (!chatOpenRef.current) {
      setUnreadChat((n) => n + 1)
      playSfx(muted, 'chat')
    }
  }, [muted])

  const loadChat = useCallback(async (code: string, pid: string) => {
    const cached = storageGet<ChatMessage[]>(`nd_chat_${code}`, [])
    if (cached.length) setChatMessages(cached)
    try {
      const { data } = await getSupabase().rpc('nd_list_chat', {
        p_code: code,
        p_player_id: pid,
        p_limit: 80,
      })
      if (data?.ok && Array.isArray(data.messages)) {
        const msgs: ChatMessage[] = data.messages.map(
          (m: {
            id: number | string
            playerId: string
            playerName: string
            body: string
            createdAt: string
          }) => ({
            id: String(m.id),
            playerId: m.playerId,
            playerName: m.playerName,
            body: m.body,
            createdAt: m.createdAt,
          }),
        )
        setChatMessages(msgs)
        storageSet(`nd_chat_${code}`, msgs)
      }
    } catch {
      /* broadcast-only fallback */
    }
  }, [])

  const subscribeRoom = useCallback(
    (code: string, pid: string) => {
      const sb = getSupabase()
      if (channelRef.current) sb.removeChannel(channelRef.current)
      channelRef.current = sb
        .channel(`nd-${code}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'nd_rooms', filter: `code=eq.${code}` },
          async () => {
            const { data } = await sb.rpc('nd_get_room', {
              p_code: code,
              p_player_id: pid,
            })
            if (data?.ok && data.room) applyOnlineRoom(data.room as RoomPayload, pid)
          },
        )
        .on('broadcast', { event: 'chat' }, ({ payload }) => {
          const msg = payload as ChatMessage
          if (!msg?.id || !msg.body) return
          if (msg.playerId === pid) return
          appendChat(msg, code)
        })
        .subscribe()
      startHeartbeat(code, pid)
      void loadChat(code, pid)
    },
    [applyOnlineRoom, startHeartbeat, appendChat, loadChat],
  )

  const resetSession = useCallback(() => {
    if (cpuPrepRef.current) {
      clearTimeout(cpuPrepRef.current)
      cpuPrepRef.current = null
    }
    setCpuPickingSecret(false)
    setGuesses([])
    setCpuCandidates([])
    setIsMyTurn(true)
    setTurnNumber(1)
    setHintUsed(false)
    setHint(null)
    setPresence('online')
    setWon(false)
    setMarked(new Set())
    setPlayerSecret('')
    setOpponentSecret('')
    setSecondsLeft(null)
    setError('')
    setChatMessages([])
    setUnreadChat(0)
    setChatOpen(false)
    streakKeyRef.current = null
    storageRemove('nd_cpu_session')
  }, [])

  const leaveOnline = useCallback(async () => {
    if (mode === 'room' && roomCode && playerId) {
      try {
        await getSupabase().rpc('nd_leave_room', {
          p_code: roomCode,
          p_player_id: playerId,
        })
      } catch {
        /* ignore */
      }
    }
    stopRealtime()
    localStorage.removeItem('nd_active')
  }, [mode, roomCode, playerId, stopRealtime])

  const goHome = async () => {
    await leaveOnline()
    resetSession()
    setPlayerId(null)
    setRoomCode('')
    setMode('cpu')
    setScreen('home')
  }

  const startCpu = () => {
    if (cpuPrepRef.current) clearTimeout(cpuPrepRef.current)
    setMode('cpu')
    setLength(difficulty)
    resetSession()
    setCpuPickingSecret(false)
    setCpuCandidates(buildCandidates(difficulty))
    setOpponentSecret('')
    setMatchSetupOpen(false)
    setScreen('setup')
    playSfx(muted, 'click')
    if (!tutorialSeen) setTutorialOpen(true)
  }

  const createRoom = async () => {
    setBusy(true)
    setError('')
    const name = nickname.trim() || 'لاعب 1'
    const { data, error: err } = await getSupabase().rpc('nd_create_room', {
      p_name: name,
      p_digit_count: difficulty,
    })
    setBusy(false)
    if (err || !data?.ok) {
      setError(err?.message || data?.error || 'فشل إنشاء الغرفة')
      playSfx(muted, 'fail')
      return
    }
    setMode('room')
    setPlayerId(data.playerId)
    localStorage.setItem(
      'nd_active',
      JSON.stringify({ code: data.room.code, playerId: data.playerId }),
    )
    resetSession()
    setMatchSetupOpen(false)
    applyOnlineRoom(data.room as RoomPayload, data.playerId, { silent: true })
    subscribeRoom(data.room.code, data.playerId)
    playSfx(muted, 'success')
  }

  const randomMatch = async () => {
    setBusy(true)
    setError('')
    const sb = getSupabase()
    const name = nickname.trim() || 'لاعب'

    try {
      const { data: rooms } = await sb
        .from('nd_rooms')
        .select('code')
        .eq('status', 'waiting')
        .eq('digit_count', difficulty)
        .is('p2_id', null)
        .order('created_at', { ascending: true })
        .limit(8)

      const candidates = (rooms || []).map((r: { code: string }) => r.code).filter(Boolean)
      for (const code of candidates) {
        const { data, error: err } = await sb.rpc('nd_join_room', {
          p_code: code,
          p_name: name,
        })
        if (!err && data?.ok) {
          setMode('room')
          setPlayerId(data.playerId)
          localStorage.setItem(
            'nd_active',
            JSON.stringify({ code: data.room.code, playerId: data.playerId }),
          )
          resetSession()
          setMatchSetupOpen(false)
          applyOnlineRoom(data.room as RoomPayload, data.playerId, { silent: true })
          subscribeRoom(data.room.code, data.playerId)
          playSfx(muted, 'success')
          setBusy(false)
          if (!tutorialSeen) setTutorialOpen(true)
          return
        }
      }
    } catch {
      /* fall through to create */
    }

    // No open room — create one and wait for a stranger
    await createRoom()
    setBusy(false)
  }

  const openMatchSetup = (mode: MatchMode) => {
    setMatchMode(mode)
    setMatchSetupOpen(true)
    playSfx(muted, 'tap')
  }

  const confirmMatchSetup = async () => {
    if (matchMode === 'cpu') startCpu()
    else if (matchMode === 'random') await randomMatch()
    else await createRoom()
  }

  const joinRoom = async (code: string) => {
    const clean = code.trim().toUpperCase()
    if (clean.length < 5) return
    setBusy(true)
    setError('')
    const name = nickname.trim() || 'لاعب 2'
    const { data, error: err } = await getSupabase().rpc('nd_join_room', {
      p_code: clean,
      p_name: name,
    })
    setBusy(false)
    if (err || !data?.ok) {
      setError(err?.message || data?.error || 'فشل الانضمام')
      playSfx(muted, 'fail')
      return
    }
    setMode('room')
    setPlayerId(data.playerId)
    localStorage.setItem(
      'nd_active',
      JSON.stringify({ code: data.room.code, playerId: data.playerId }),
    )
    resetSession()
    applyOnlineRoom(data.room as RoomPayload, data.playerId, { silent: true })
    subscribeRoom(data.room.code, data.playerId)
    playSfx(muted, 'success')
    if (!tutorialSeen) setTutorialOpen(true)
  }

  const confirmSecret = async (secret: string) => {
    if (!isValidSecret(secret, length)) return
    if (mode === 'cpu') {
      setPlayerSecret(secret)
      setCpuPickingSecret(true)
      setError('')
      playSfx(muted, 'success')
      return
    }
    if (!roomCode || !playerId) return
    setBusy(true)
    const { data, error: err } = await getSupabase().rpc('nd_set_secret', {
      p_code: roomCode,
      p_player_id: playerId,
      p_secret: secret,
    })
    setBusy(false)
    if (err || !data?.ok) {
      setError(err?.message || data?.error || 'ما قدرنا نثبت الرقم')
      return
    }
    applyOnlineRoom(data.room as RoomPayload, playerId)
    playSfx(muted, 'success')
  }

  // CPU picking secret (also resumes after refresh)
  useEffect(() => {
    if (mode !== 'cpu' || !cpuPickingSecret || !playerSecret || screen !== 'setup') return
    const thinkMs = 4000 + Math.floor(Math.random() * 2000)
    const t = setTimeout(() => {
      setOpponentSecret(generateSecret(length))
      setGuesses([])
      const playerStarts = Math.random() < 0.5
      setIsMyTurn(playerStarts)
      setPresence(playerStarts ? 'online' : 'wait')
      setTurnNumber(1)
      setHintUsed(false)
      setHint(null)
      setWon(false)
      setSecondsLeft(timer > 0 && playerStarts ? timer : null)
      setCpuPickingSecret(false)
      setScreen('play')
      playSfx(muted, 'turn')
    }, thinkMs)
    cpuPrepRef.current = t
    return () => {
      clearTimeout(t)
      if (cpuPrepRef.current === t) cpuPrepRef.current = null
    }
  }, [mode, cpuPickingSecret, playerSecret, screen, length, timer, muted])

  const finishCpu = useCallback(
    (playerWon: boolean, oppSecret: string) => {
      setWon(playerWon)
      setOpponentSecret(oppSecret)
      setStreak((s) => {
        const next = playerWon ? s + 1 : 0
        setBestStreak((b) => Math.max(b, next))
        return next
      })
      playSfx(muted, playerWon ? 'win' : 'lose')
      vibrate(playerWon ? [40, 40, 80] : 40)
      setScreen('finished')
    },
    [muted],
  )

  const handleGuess = async (value: string) => {
    if (!isValidGuess(value, length)) return
    setHint(null)

    if (mode === 'cpu') {
      const correct = countCorrect(value, opponentSecret)
      setGuesses((g) => [...g, { value, correct }])
      playSfx(muted, 'guess')
      vibrate(20)
      if (correct === length) {
        finishCpu(true, opponentSecret)
        return
      }
      setIsMyTurn(false)
      setPresence('wait')
      return
    }

    if (!roomCode || !playerId) return
    setBusy(true)
    const { data, error: err } = await getSupabase().rpc('nd_guess', {
      p_code: roomCode,
      p_player_id: playerId,
      p_guess: value,
    })
    setBusy(false)
    if (err || !data?.ok) {
      setError(err?.message || data?.error || 'فشل التخمين')
      return
    }
    playSfx(muted, 'guess')
    vibrate(20)
    applyOnlineRoom(data.room as RoomPayload, playerId, { silent: true })
  }

  // CPU turn — think for ~4.5–6.5s so it feels human
  useEffect(() => {
    if (screen !== 'play' || mode !== 'cpu' || isMyTurn || won) return
    if (!playerSecret || !opponentSecret) return
    setPresence('wait')
    const thinkMs = 4500 + Math.floor(Math.random() * 2000)
    const t = setTimeout(() => {
      let pool = cpuCandidates.length ? cpuCandidates : buildCandidates(length)
      const guess = pickSmartGuess(pool)
      const correct = countCorrect(guess, playerSecret)
      pool = filterCandidates(pool, guess, correct)
      setCpuCandidates(pool)
      playSfx(muted, 'guess')
      if (correct === length) {
        finishCpu(false, opponentSecret)
        return
      }
      setIsMyTurn(true)
      setPresence('online')
      setTurnNumber((n) => n + 1)
      setSecondsLeft(timer > 0 ? timer : null)
      vibrate(25)
      playSfx(muted, 'turn')
    }, thinkMs)
    return () => clearTimeout(t)
  }, [
    screen,
    mode,
    isMyTurn,
    won,
    cpuCandidates,
    length,
    playerSecret,
    opponentSecret,
    timer,
    muted,
    finishCpu,
  ])

  // Timer
  useEffect(() => {
    if (screen !== 'play' || !isMyTurn || timer === 0 || won) return
    if (secondsLeft === null) return
    if (secondsLeft <= 0) {
      setSecondsLeft(null)
      if (mode === 'cpu') {
        setIsMyTurn(false)
        setPresence('wait')
        setError('انتهى الوقت — انتقل الدور')
        return
      }
      if (roomCode && playerId) {
        getSupabase()
          .rpc('nd_skip_turn', { p_code: roomCode, p_player_id: playerId })
          .then(({ data }) => {
            if (data?.ok) applyOnlineRoom(data.room as RoomPayload, playerId, { silent: true })
          })
      }
      return
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? s : s - 1)), 1000)
    return () => clearTimeout(t)
  }, [screen, isMyTurn, timer, secondsLeft, won, mode, roomCode, playerId, applyOnlineRoom])

  // Reset timer when my turn starts in online
  useEffect(() => {
    if (screen === 'play' && isMyTurn && timer > 0 && mode === 'room') {
      setSecondsLeft(timer)
    }
  }, [isMyTurn, screen, timer, mode, turnNumber])

  const useHint = async () => {
    if (hintUsed) return
    if (mode === 'cpu') {
      const last = guesses[guesses.length - 1]
      if (!last || last.correct < 1) {
        setHint('خمّن مرة فيها خانة صحيحة ثم استخدم التلميح')
        return
      }
      const positions: number[] = []
      for (let i = 0; i < last.value.length; i++) {
        if (last.value[i] === opponentSecret[i]) positions.push(i + 1)
      }
      const pick = positions[Math.floor(Math.random() * positions.length)]
      setHint(`الخانة رقم ${pick} من آخر تخمينك صحيحة (بدون كشف الرقم)`)
      setHintUsed(true)
      playSfx(muted, 'hint')
      return
    }
    if (!roomCode || !playerId) return
    const { data, error: err } = await getSupabase().rpc('nd_use_hint', {
      p_code: roomCode,
      p_player_id: playerId,
    })
    if (err || !data?.ok) {
      setHint(err?.message || data?.error || 'فشل التلميح')
      return
    }
    setHint(data.message || '')
    setHintUsed(true)
    if (data.room) applyOnlineRoom(data.room as RoomPayload, playerId, { silent: true })
    playSfx(muted, 'hint')
  }

  const toggleMark = (key: string) => {
    setMarked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const rematch = async () => {
    if (mode === 'cpu') {
      resetSession()
      setCpuCandidates(buildCandidates(length))
      setOpponentSecret('')
      setScreen('setup')
      return
    }
    if (!roomCode || !playerId) return
    const { data, error: err } = await getSupabase().rpc('nd_rematch', {
      p_code: roomCode,
      p_player_id: playerId,
    })
    if (err || !data?.ok) {
      setError(err?.message || data?.error || 'فشل إعادة اللعب')
      return
    }
    resetSession()
    applyOnlineRoom(data.room as RoomPayload, playerId, { silent: true })
  }

  const sendChat = async (body: string) => {
    if (!roomCode || !playerId) return false
    const trimmed = body.trim()
    if (!trimmed) return false

    const localMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      playerId,
      playerName: nickname.trim() || 'لاعب',
      body: trimmed,
      createdAt: new Date().toISOString(),
    }

    try {
      const { data } = await getSupabase().rpc('nd_send_chat', {
        p_code: roomCode,
        p_player_id: playerId,
        p_body: trimmed,
      })
      if (data?.ok && data.message) {
        const msg: ChatMessage = {
          id: String(data.message.id),
          playerId: data.message.playerId,
          playerName: data.message.playerName,
          body: data.message.body,
          createdAt: data.message.createdAt,
        }
        appendChat(msg, roomCode)
        await channelRef.current?.send({
          type: 'broadcast',
          event: 'chat',
          payload: msg,
        })
        return true
      }
    } catch {
      /* fall through to broadcast */
    }

    appendChat(localMsg, roomCode)
    await channelRef.current?.send({
      type: 'broadcast',
      event: 'chat',
      payload: localMsg,
    })
    return true
  }

  const exitMatch = () => {
    setExitOpen(true)
    playSfx(muted, 'tap')
  }

  const confirmExit = async () => {
    setExitOpen(false)
    playSfx(muted, 'fail')
    await goHome()
  }

  const cancelLobby = async () => {
    await goHome()
  }

  const enterAsGuest = () => {
    storageSet('nd_logged', true)
    setScreen('home')
  }

  const enterGoogle = async () => {
    try {
      const sb = getSupabase()
      const { error: err } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
        },
      })
      if (err) {
        if (!nickname) setNickname('لاعب')
        enterAsGuest()
      }
    } catch {
      if (!nickname) setNickname('لاعب')
      enterAsGuest()
    }
  }

  // Persist CPU match across refresh / reconnect
  useEffect(() => {
    if (!booted || mode !== 'cpu') return
    if (!['setup', 'play', 'finished'].includes(screen)) return
    if (!playerSecret && screen !== 'setup') return
    const session: CpuSession = {
      v: 1,
      screen,
      length,
      playerSecret,
      opponentSecret,
      guesses,
      cpuCandidates,
      isMyTurn,
      turnNumber,
      hintUsed,
      marked: [...marked],
      won,
      cpuPickingSecret,
    }
    storageSet('nd_cpu_session', session)
  }, [
    booted,
    mode,
    screen,
    length,
    playerSecret,
    opponentSecret,
    guesses,
    cpuCandidates,
    isMyTurn,
    turnNumber,
    hintUsed,
    marked,
    won,
    cpuPickingSecret,
  ])

  // Restore online or CPU session
  useEffect(() => {
    if (!booted) return
    const raw = localStorage.getItem('nd_active')
    if (raw) {
      ;(async () => {
        try {
          const { code, playerId: pid } = JSON.parse(raw)
          if (!code || !pid) return
          const { data } = await getSupabase().rpc('nd_get_room', {
            p_code: code,
            p_player_id: pid,
          })
          if (!data?.ok) {
            localStorage.removeItem('nd_active')
            return
          }
          setMode('room')
          setPlayerId(pid)
          storageSet('nd_logged', true)
          applyOnlineRoom(data.room as RoomPayload, pid, { silent: true })
          subscribeRoom(code, pid)
        } catch {
          localStorage.removeItem('nd_active')
        }
      })()
      return
    }

    const cpu = storageGet<CpuSession | null>('nd_cpu_session', null)
    if (!cpu || cpu.v !== 1) return
    if (!['setup', 'play', 'finished'].includes(cpu.screen)) return
    setMode('cpu')
    setLength(cpu.length)
    setPlayerSecret(cpu.playerSecret || '')
    setOpponentSecret(cpu.opponentSecret || '')
    setGuesses(cpu.guesses || [])
    setCpuCandidates(cpu.cpuCandidates?.length ? cpu.cpuCandidates : buildCandidates(cpu.length))
    setIsMyTurn(cpu.isMyTurn)
    setTurnNumber(cpu.turnNumber || 1)
    setHintUsed(Boolean(cpu.hintUsed))
    setMarked(new Set(cpu.marked || []))
    setWon(Boolean(cpu.won))
    setCpuPickingSecret(Boolean(cpu.cpuPickingSecret))
    setPresence(cpu.isMyTurn ? 'online' : 'wait')
    setScreen(cpu.screen)
    storageSet('nd_logged', true)
  }, [booted, applyOnlineRoom, subscribeRoom])

  // Offline presence
  useEffect(() => {
    const onOff = () => setPresence('offline')
    const onOn = () => {
      if (mode === 'room' && roomCode && playerId) {
        subscribeRoom(roomCode, playerId)
        setPresence('online')
      } else if (mode === 'cpu' && screen === 'play') {
        setPresence(isMyTurn ? 'online' : 'wait')
      }
    }
    window.addEventListener('offline', onOff)
    window.addEventListener('online', onOn)
    return () => {
      window.removeEventListener('offline', onOff)
      window.removeEventListener('online', onOn)
    }
  }, [mode, roomCode, playerId, subscribeRoom, screen, isMyTurn])

  if (!booted) {
    return <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center bg-background" />
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <div className="flex flex-1 flex-col">
        {screen === 'login' && (
          <LoginScreen onGoogle={enterGoogle} onGuest={enterAsGuest} />
        )}

        {screen === 'home' && (
          <HomeScreen
            nickname={nickname}
            onNickname={setNickname}
            theme={theme}
            onTheme={setTheme}
            muted={muted}
            onMuted={setMuted}
            streak={streak}
            bestStreak={bestStreak}
            onCreateRoom={() => openMatchSetup('create')}
            onRandomMatch={() => openMatchSetup('random')}
            onPlayComputer={() => openMatchSetup('cpu')}
            onJoin={joinRoom}
            joinCode={joinCode}
            onJoinCode={setJoinCode}
            onInfo={() => setInfoOpen(true)}
          />
        )}

        {screen === 'lobby' && (
          <LobbyScreen
            roomCode={roomCode}
            nickname={nickname}
            onCancel={cancelLobby}
          />
        )}

        {screen === 'setup' && (
          <SetupScreen
            length={length}
            onConfirm={confirmSecret}
            onBack={exitMatch}
            waitingOpponent={cpuPickingSecret}
          />
        )}

        {screen === 'play' && (
          <PlayScreen
            length={length}
            isMyTurn={isMyTurn}
            turnNumber={turnNumber}
            guesses={guesses}
            timer={timer}
            secondsLeft={secondsLeft}
            hintUsed={hintUsed}
            hint={hint || error || null}
            presence={presence}
            mySecret={playerSecret}
            showChat={mode === 'room'}
            unreadChat={unreadChat}
            onGuess={handleGuess}
            onHint={useHint}
            onOpenTracker={() => setTrackerOpen(true)}
            onOpenChat={() => setChatOpen(true)}
            onExit={exitMatch}
          />
        )}

        {screen === 'finished' && (
          <FinishedScreen
            won={won}
            opponentSecret={opponentSecret}
            turns={turnNumber}
            streak={streak}
            onRematch={rematch}
            onHome={goHome}
          />
        )}
      </div>

      {(busy || error) && screen === 'home' && error && (
        <div className="px-5 pb-4 text-center text-sm text-destructive">{error}</div>
      )}

      <InfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} />
      <TrackerSheet
        open={trackerOpen}
        onClose={() => setTrackerOpen(false)}
        length={length}
        crossed={marked}
        onToggle={toggleMark}
      />
      <ChatSheet
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        myPlayerId={playerId}
        onSend={sendChat}
      />
      <MatchSetupSheet
        open={matchSetupOpen}
        onClose={() => setMatchSetupOpen(false)}
        mode={matchMode}
        difficulty={difficulty}
        onDifficulty={setDifficulty}
        timer={timer}
        onTimer={setTimer}
        busy={busy}
        onConfirm={confirmMatchSetup}
      />
      <ConfirmExitSheet
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        onConfirm={confirmExit}
      />
      <Tutorial
        open={tutorialOpen}
        onDone={() => {
          setTutorialOpen(false)
          setTutorialSeen(true)
          storageSet('nd_tutorial_done', true)
        }}
      />
    </main>
  )
}
