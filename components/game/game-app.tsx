'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildCandidates,
  calculateScore,
  countCorrect,
  countPossibleSecrets,
  filterCandidates,
  generateSecret,
  isValidGuess,
  isValidSecret,
  MODE_PRESETS,
  normalizeTheme,
  pickSmartGuess,
  storageGet,
  storageRemove,
  storageSet,
  totalSecretCount,
  type ChatMessage,
  type CpuDifficulty,
  type Difficulty,
  type Guess,
  type GameMode,
  type HintType,
  type MatchOutcome,
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
import { HintSheet } from '@/components/game/overlays/hint-sheet'
import { ProbabilitySheet, type ProbabilityStep } from '@/components/game/overlays/probability-sheet'
import { ProfileSheet } from '@/components/game/overlays/profile-sheet'
import { ReplaySheet } from '@/components/game/overlays/replay-sheet'
import { MemoryGame } from '@/components/game/memory-game'
import { LocalDuel } from '@/components/game/local-duel'
import { getSupabase } from '@/lib/supabase'
import { playSfx } from '@/lib/sfx'
import { DEFAULT_PROFILE, normalizeProfile, recordDuel, recordMemory, type PlayerProfile } from '@/lib/progression'
import { shareResultImage } from '@/lib/share-result'

type Mode = 'cpu' | 'room'

type CpuSession = {
  v: 2
  matchGen: number
  screen: Screen
  length: Difficulty
  playerSecret: string
  opponentSecret: string
  guesses: Guess[]
  cpuCandidates: string[]
  isMyTurn: boolean
  turnNumber: number
  hintUses: number
  marked: string[]
  won: boolean
  cpuPickingSecret: boolean
  gameMode: GameMode
  allowRepeats: boolean
  cpuGuessCount: number
  outcome: MatchOutcome
  score: number
  startedAt: number
  elapsedSeconds: number
}

type RoomPayload = {
  code: string
  status: string
  turn: string | null
  winner: string | null
  digitCount: number
  hintsUsed?: number
  turnNumber: number
  myGuessCount: number
  mySecret: string | null
  opponentSecret: string | null
  opponentPresence?: string
  timerSeconds?: number
  gameMode?: GameMode
  allowRepeats?: boolean
  maxAttempts?: number
  hintLimit?: number
  score?: number
  startedAt?: string | null
  secondsLeft?: number | null
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
  const [experience, setExperience] = useState<'duel' | 'memory' | 'daily' | 'local'>('duel')
  const [screen, setScreen] = useState<Screen>('login')
  const [nickname, setNickname] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>(4)
  const [theme, setTheme] = useState<ThemeName>('classic')
  const [muted, setMuted] = useState(false)
  const [timer, setTimer] = useState<TimerOption>(0)
  const [gameMode, setGameMode] = useState<GameMode>('normal')
  const [allowRepeats, setAllowRepeats] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [booted, setBooted] = useState(false)
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PROFILE)
  const [profileOpen, setProfileOpen] = useState(false)
  const [replayOpen, setReplayOpen] = useState(false)
  const [cpuDifficulty, setCpuDifficulty] = useState<CpuDifficulty>('medium')

  const [infoOpen, setInfoOpen] = useState(false)
  const [trackerOpen, setTrackerOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialSeen, setTutorialSeen] = useState(false)
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [hintOpen, setHintOpen] = useState(false)
  const [probabilityOpen, setProbabilityOpen] = useState(false)
  const [probabilityHistory, setProbabilityHistory] = useState<ProbabilityStep[]>([])

  const [mode, setMode] = useState<Mode>('cpu')
  const [roomCode, setRoomCode] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerToken, setPlayerToken] = useState<string | null>(null)
  const [length, setLength] = useState<Difficulty>(4)
  const [playerSecret, setPlayerSecret] = useState('')
  const [opponentSecret, setOpponentSecret] = useState('')
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [cpuCandidates, setCpuCandidates] = useState<string[]>([])
  const [isMyTurn, setIsMyTurn] = useState(true)
  const [turnNumber, setTurnNumber] = useState(1)
  const [hintUses, setHintUses] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [presence, setPresence] = useState<PresenceKind>('online')
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [won, setWon] = useState(false)
  const [outcome, setOutcome] = useState<MatchOutcome>('lose')
  const [score, setScore] = useState(0)
  const [startedAt, setStartedAt] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [cpuGuessCount, setCpuGuessCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cpuPickingSecret, setCpuPickingSecret] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [unreadChat, setUnreadChat] = useState(0)
  const [matchSetupOpen, setMatchSetupOpen] = useState(false)
  const [matchMode, setMatchMode] = useState<MatchMode>('create')
  const [exitOpen, setExitOpen] = useState(false)

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streakKeyRef = useRef<string | null>(null)
  const cpuPrepRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chatOpenRef = useRef(false)
  const sessionBootstrappedRef = useRef(false)
  const matchGenRef = useRef(0)
  const trackerScopeRef = useRef('')
  const recordedResultRef = useRef<string | null>(null)
  const maxAttempts = MODE_PRESETS[gameMode].maxAttempts
  const hintLimit = MODE_PRESETS[gameMode].hintLimit

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
    setGameMode(storageGet<GameMode>('nd_game_mode', 'normal'))
    setAllowRepeats(storageGet('nd_allow_repeats', true))
    setStreak(storageGet('nd_streak', 0))
    setBestStreak(storageGet('nd_best_streak', 0))
    setProfile(normalizeProfile(storageGet<Partial<PlayerProfile>>('nd_profile', DEFAULT_PROFILE)))
    setCpuDifficulty(storageGet<CpuDifficulty>('nd_cpu_difficulty', 'medium'))
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
  useEffect(() => storageSet('nd_game_mode', gameMode), [gameMode])
  useEffect(() => storageSet('nd_allow_repeats', allowRepeats), [allowRepeats])
  useEffect(() => storageSet('nd_streak', streak), [streak])
  useEffect(() => storageSet('nd_best_streak', bestStreak), [bestStreak])
  useEffect(() => storageSet('nd_profile', profile), [profile])
  useEffect(() => storageSet('nd_cpu_difficulty', cpuDifficulty), [cpuDifficulty])

  const stopRealtime = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const applyOnlineRoom = useCallback(
    (room: RoomPayload, pid: string, opts?: { silent?: boolean }) => {
      setRoomCode(room.code)
      setLength((room.digitCount as Difficulty) || 4)
      const roomMode = room.gameMode || 'normal'
      setGameMode(roomMode)
      setAllowRepeats(room.allowRepeats ?? true)
      setPlayerSecret(room.mySecret || '')
      setOpponentSecret(room.opponentSecret || '')
      const nextGuesses = (room.guesses || []).map((g) => ({
          value: g.guess,
          correct: g.correctPositions,
        }))
      setGuesses((current) => {
        const unchanged = current.length === nextGuesses.length && current.every(
          (guess, index) => guess.value === nextGuesses[index]?.value && guess.correct === nextGuesses[index]?.correct,
        )
        return unchanged ? current : nextGuesses
      })
      setHintUses(room.hintsUsed || 0)
      setTurnNumber(room.turnNumber || 1)
      setIsMyTurn(room.turn === pid)
      setPresence(mapPresence(room.opponentPresence))
      setTimer((room.timerSeconds as TimerOption) || 0)
      setSecondsLeft(room.secondsLeft ?? null)
      if (room.startedAt) {
        const start = new Date(room.startedAt).getTime()
        setStartedAt(start)
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)))
      }
      if (typeof room.score === 'number') setScore(room.score)

      const guessCount = (room.guesses || []).length
      const freshMatch =
        room.status === 'setup' ||
        (room.status === 'playing' && guessCount === 0 && (room.turnNumber || 1) <= 1)
      const trackerScope = `${room.code}:${room.status}:${room.turnNumber ?? 0}:${guessCount}`
      if (freshMatch) {
        if (trackerScopeRef.current !== trackerScope) {
          trackerScopeRef.current = trackerScope
          setMarked(new Set())
        }
      } else {
        trackerScopeRef.current = trackerScope
      }

      if (room.status === 'waiting') setScreen('lobby')
      else if (room.status === 'setup') setScreen('setup')
      else if (room.status === 'playing') {
        setScreen('play')
      } else if (room.status === 'finished') {
        const playerWon = room.winner === pid
        const matchOutcome: MatchOutcome = room.winner ? (playerWon ? 'win' : 'lose') : 'draw'
        setWon(playerWon)
        setOutcome(matchOutcome)
        const key = `${room.code}:${room.winner}`
        if (streakKeyRef.current !== key) {
          streakKeyRef.current = key
          const onlineSeconds = room.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(room.startedAt).getTime()) / 1000)) : 0
          const onlineScore = typeof room.score === 'number' ? room.score : playerWon ? 100 * room.digitCount : 0
          setProfile(current => recordDuel(current, { won: playerWon, attempts: room.myGuessCount || 0, seconds: onlineSeconds, score: onlineScore }))
          setStreak((s) => {
            const next = matchOutcome === 'win' ? s + 1 : matchOutcome === 'draw' ? s : 0
            setBestStreak((b) => Math.max(b, next))
            return next
          })
          if (!opts?.silent) {
            playSfx(muted, matchOutcome === 'win' ? 'win' : 'lose')
            vibrate(matchOutcome === 'win' ? [40, 40, 80] : 40)
          }
        }
        setScreen('finished')
      }
    },
    [muted],
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

  const loadChat = useCallback(async (code: string, pid: string, token: string) => {
    const cached = storageGet<ChatMessage[]>(`nd_chat_${code}`, [])
    if (cached.length) setChatMessages(cached)
    try {
      const { data } = await getSupabase().rpc('nd_list_chat', {
        p_code: code,
        p_player_id: pid,
        p_player_token: token,
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
      /* keep the cached messages while temporarily offline */
    }
  }, [])

  const startHeartbeat = useCallback(
    (code: string, pid: string, token: string) => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      const tick = async () => {
        const { data } = await getSupabase().rpc('nd_heartbeat', {
          p_code: code,
          p_player_id: pid,
          p_player_token: token,
        })
        if (data?.ok && data.room) {
          applyOnlineRoom(data.room as RoomPayload, pid, { silent: true })
          await loadChat(code, pid, token)
        }
      }
      void tick()
      heartbeatRef.current = setInterval(tick, 2500)
    },
    [applyOnlineRoom, loadChat],
  )

  const subscribeRoom = useCallback(
    (code: string, pid: string, token: string) => {
      startHeartbeat(code, pid, token)
      void loadChat(code, pid, token)
    },
    [startHeartbeat, loadChat],
  )

  const resetSession = useCallback(() => {
    if (cpuPrepRef.current) {
      clearTimeout(cpuPrepRef.current)
      cpuPrepRef.current = null
    }
    matchGenRef.current += 1
    trackerScopeRef.current = ''
    setCpuPickingSecret(false)
    setGuesses([])
    setCpuCandidates([])
    setIsMyTurn(true)
    setTurnNumber(1)
    setHintUses(0)
    setHint(null)
    setPresence('online')
    setWon(false)
    setOutcome('lose')
    setScore(0)
    setStartedAt(0)
    setElapsedSeconds(0)
    setCpuGuessCount(0)
    setProbabilityHistory([])
    setHintOpen(false)
    setProbabilityOpen(false)
    setMarked(new Set())
    setPlayerSecret('')
    setOpponentSecret('')
    setSecondsLeft(null)
    setError('')
    setChatMessages([])
    setUnreadChat(0)
    setChatOpen(false)
    streakKeyRef.current = null
    recordedResultRef.current = null
    storageRemove('nd_cpu_session')
  }, [])

  const leaveOnline = useCallback(async () => {
    if (mode === 'room' && roomCode && playerId && playerToken) {
      try {
        await getSupabase().rpc('nd_leave_room', {
          p_code: roomCode,
          p_player_id: playerId,
          p_player_token: playerToken,
        })
      } catch {
        /* ignore */
      }
    }
    stopRealtime()
    localStorage.removeItem('nd_active')
  }, [mode, roomCode, playerId, playerToken, stopRealtime])

  const goHome = async () => {
    await leaveOnline()
    resetSession()
    setPlayerId(null)
    setPlayerToken(null)
    setRoomCode('')
    setMode('cpu')
    setExperience('duel')
    setScreen('home')
  }

  const startCpu = () => {
    if (cpuPrepRef.current) clearTimeout(cpuPrepRef.current)
    setMode('cpu')
    setLength(difficulty)
    resetSession()
    setCpuPickingSecret(false)
    setTimer(MODE_PRESETS[gameMode].timer)
    setCpuCandidates(buildCandidates(difficulty, allowRepeats))
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
      p_timer_seconds: MODE_PRESETS[gameMode].timer,
      p_game_mode: gameMode,
      p_allow_repeats: allowRepeats,
      p_max_attempts: maxAttempts,
      p_hint_limit: hintLimit,
    })
    setBusy(false)
    if (err || !data?.ok) {
      setError(err?.message || data?.error || 'فشل إنشاء الغرفة')
      playSfx(muted, 'fail')
      return
    }
    setMode('room')
    setPlayerId(data.playerId)
    setPlayerToken(data.playerToken)
    localStorage.setItem(
      'nd_active',
      JSON.stringify({ code: data.room.code, playerId: data.playerId, playerToken: data.playerToken }),
    )
    resetSession()
    setMatchSetupOpen(false)
    applyOnlineRoom(data.room as RoomPayload, data.playerId, { silent: true })
    subscribeRoom(data.room.code, data.playerId, data.playerToken)
    playSfx(muted, 'success')
  }

  const openMatchSetup = (mode: MatchMode) => {
    setMatchMode(mode)
    setMatchSetupOpen(true)
    playSfx(muted, 'tap')
  }

  const selectGameMode = (nextMode: GameMode) => {
    setGameMode(nextMode)
    setTimer(MODE_PRESETS[nextMode].timer)
  }

  const startRandomMatch = async () => {
    setDifficulty(4)
    setTimer(30)
    setGameMode('quick')
    setAllowRepeats(true)
    playSfx(muted, 'tap')
    setBusy(true)
    setError('')
    const sb = getSupabase()
    const name = nickname.trim() || 'لاعب'
    const digits = 4

    const { data, error: err } = await sb.rpc('nd_random_match', {
      p_name: name,
      p_digit_count: digits,
      p_timer_seconds: 30,
      p_game_mode: 'quick',
      p_allow_repeats: true,
      p_max_attempts: MODE_PRESETS.quick.maxAttempts,
      p_hint_limit: MODE_PRESETS.quick.hintLimit,
    })
    setBusy(false)
    if (err || !data?.ok) {
      setError(err?.message || data?.error || 'فشل البحث عن خصم')
      playSfx(muted, 'fail')
      return
    }
    setMode('room')
    setPlayerId(data.playerId)
    setPlayerToken(data.playerToken)
    setLength(4)
    setTimer(30)
    localStorage.setItem(
      'nd_active',
      JSON.stringify({ code: data.room.code, playerId: data.playerId, playerToken: data.playerToken }),
    )
    resetSession()
    applyOnlineRoom(data.room as RoomPayload, data.playerId, { silent: true })
    subscribeRoom(data.room.code, data.playerId, data.playerToken)
    playSfx(muted, 'success')
  }

  const confirmMatchSetup = async () => {
    if (matchMode === 'cpu') startCpu()
    else if (matchMode === 'local') { resetSession(); setLength(difficulty); setMatchSetupOpen(false); setExperience('local') }
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
    setPlayerToken(data.playerToken)
    localStorage.setItem(
      'nd_active',
      JSON.stringify({ code: data.room.code, playerId: data.playerId, playerToken: data.playerToken }),
    )
    resetSession()
    applyOnlineRoom(data.room as RoomPayload, data.playerId, { silent: true })
    subscribeRoom(data.room.code, data.playerId, data.playerToken)
    playSfx(muted, 'success')
    if (!tutorialSeen) setTutorialOpen(true)
  }

  const confirmSecret = async (secret: string) => {
    const digits = length >= 3 && length <= 6 ? length : 4
    if (!isValidSecret(secret, digits, allowRepeats)) {
      setError(allowRepeats ? `لازم تدخل ${digits} أرقام` : `لازم تدخل ${digits} أرقام مختلفة`)
      playSfx(muted, 'fail')
      return
    }
    if (mode === 'cpu') {
      setError('')
      setLength(digits)
      setPlayerSecret(secret)
      setCpuPickingSecret(true)
      playSfx(muted, 'success')
      if (cpuPrepRef.current) clearTimeout(cpuPrepRef.current)
      const thinkMs = 4000 + Math.floor(Math.random() * 2000)
      cpuPrepRef.current = setTimeout(() => {
        const cpuSecret = generateSecret(digits, allowRepeats)
        setOpponentSecret(cpuSecret)
        setGuesses([])
        setMarked(new Set())
        trackerScopeRef.current = `cpu:${matchGenRef.current}`
        const playerStarts = Math.random() < 0.5
        setIsMyTurn(playerStarts)
        setPresence(playerStarts ? 'online' : 'wait')
        setTurnNumber(1)
        setHintUses(0)
        setHint(null)
        setWon(false)
        setSecondsLeft(timer > 0 && playerStarts ? timer : null)
        setStartedAt(Date.now())
        setCpuPickingSecret(false)
        setScreen('play')
        playSfx(muted, 'turn')
        cpuPrepRef.current = null
      }, thinkMs)
      return
    }
    if (!roomCode || !playerId || !playerToken) {
      setError('الغرفة غير جاهزة — ارجع وحاول مرة ثانية')
      playSfx(muted, 'fail')
      return
    }
    setBusy(true)
    setError('')
    const { data, error: err } = await getSupabase().rpc('nd_set_secret', {
      p_code: roomCode,
      p_player_id: playerId,
      p_player_token: playerToken,
      p_secret: secret,
    })
    setBusy(false)
    if (err || !data?.ok) {
      setError(err?.message || data?.error || 'ما قدرنا نثبت الرقم')
      playSfx(muted, 'fail')
      return
    }
    applyOnlineRoom(data.room as RoomPayload, playerId)
    playSfx(muted, 'success')
  }

  // Resume CPU "picking secret" after refresh only
  useEffect(() => {
    if (mode !== 'cpu' || !cpuPickingSecret || !playerSecret || screen !== 'setup') return
    if (cpuPrepRef.current) return
    const digits = length >= 3 && length <= 6 ? length : 4
    const thinkMs = 2500 + Math.floor(Math.random() * 1500)
    cpuPrepRef.current = setTimeout(() => {
      setOpponentSecret(generateSecret(digits as Difficulty, allowRepeats))
      setGuesses([])
      setMarked(new Set())
      trackerScopeRef.current = `cpu:${matchGenRef.current}`
      const playerStarts = Math.random() < 0.5
      setIsMyTurn(playerStarts)
      setPresence(playerStarts ? 'online' : 'wait')
      setTurnNumber(1)
      setHintUses(0)
      setHint(null)
      setWon(false)
      setSecondsLeft(timer > 0 && playerStarts ? timer : null)
      setStartedAt(Date.now())
      setCpuPickingSecret(false)
      setScreen('play')
      playSfx(muted, 'turn')
      cpuPrepRef.current = null
    }, thinkMs)
    return () => {
      /* keep timeout across muted/timer re-renders; cleared on leave via resetSession */
    }
  }, [mode, cpuPickingSecret, playerSecret, screen, length, timer, muted, allowRepeats])

  const finishCpu = useCallback(
    (matchOutcome: MatchOutcome, oppSecret: string) => {
      const playerWon = matchOutcome === 'win'
      const finalElapsed = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0
      const finalAttempts = Math.max(1, guesses.length + (matchOutcome === 'win' ? 1 : 0))
      const finalScore = playerWon ? calculateScore({
        length,
        mode: gameMode,
        maxAttempts,
        guessesUsed: finalAttempts,
        elapsedSeconds: finalElapsed,
        hintsUsed: hintUses,
      }) : matchOutcome === 'draw' ? 250 * length : 0
      setElapsedSeconds(finalElapsed)
      setWon(playerWon)
      setOutcome(matchOutcome)
      setOpponentSecret(oppSecret)
      setScore(finalScore)
      const resultKey = `cpu:${matchGenRef.current}:${startedAt}`
      if (recordedResultRef.current !== resultKey) {
        recordedResultRef.current = resultKey
        setProfile(current => recordDuel(current, { won: playerWon, attempts: finalAttempts, seconds: finalElapsed, score: finalScore }))
      }
      setStreak((s) => {
        const next = playerWon ? s + 1 : matchOutcome === 'draw' ? s : 0
        setBestStreak((b) => Math.max(b, next))
        return next
      })
      playSfx(muted, playerWon ? 'win' : 'lose')
      vibrate(playerWon ? [40, 40, 80] : 40)
      setScreen('finished')
    },
    [gameMode, guesses.length, hintUses, length, maxAttempts, muted, startedAt],
  )

  const handleGuess = async (value: string) => {
    if (!isValidGuess(value, length, allowRepeats) || guesses.length >= maxAttempts) return
    setHint(null)
    setError('')

    if (mode === 'cpu') {
      const correct = countCorrect(value, opponentSecret)
      const nextGuesses = [...guesses, { value, correct }]
      setGuesses(nextGuesses)
      playSfx(muted, 'guess')
      vibrate(20)
      if (correct === length) {
        finishCpu('win', opponentSecret)
        return
      }
      if (nextGuesses.length >= maxAttempts && cpuGuessCount >= maxAttempts) {
        finishCpu('draw', opponentSecret)
      } else if (cpuGuessCount >= maxAttempts) {
        setIsMyTurn(true)
        setPresence('online')
        setTurnNumber((number) => number + 1)
      } else {
        setIsMyTurn(false)
        setPresence('wait')
      }
      return
    }

    if (!roomCode || !playerId || !playerToken) return
    setBusy(true)
    const { data, error: err } = await getSupabase().rpc('nd_guess', {
      p_code: roomCode,
      p_player_id: playerId,
      p_player_token: playerToken,
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
    if (cpuGuessCount >= maxAttempts) {
      if (guesses.length >= maxAttempts) finishCpu('draw', opponentSecret)
      else { setIsMyTurn(true); setPresence('online') }
      return
    }
    setPresence('wait')
    const thinkMs = 4500 + Math.floor(Math.random() * 2000)
    const t = setTimeout(() => {
      let pool = cpuCandidates.length ? cpuCandidates : buildCandidates(length, allowRepeats)
      if (!pool.includes(playerSecret)) pool = [...pool, playerSecret]
      let guess: string
      if (cpuDifficulty === 'easy') {
        do { guess = generateSecret(length, allowRepeats) } while (!isValidGuess(guess, length, allowRepeats))
      } else if (cpuDifficulty === 'medium') {
        guess = pool[Math.floor(Math.random() * pool.length)] || pickSmartGuess(pool, length, allowRepeats)
      } else {
        guess = pickSmartGuess(pool, length, allowRepeats)
      }
      const correct = countCorrect(guess, playerSecret)
      pool = filterCandidates(pool, guess, correct)
      setCpuCandidates(pool)
      const nextCpuCount = cpuGuessCount + 1
      setCpuGuessCount(nextCpuCount)
      playSfx(muted, 'guess')
      if (correct === length) {
        finishCpu('lose', opponentSecret)
        return
      }
      if (nextCpuCount >= maxAttempts && guesses.length >= maxAttempts) {
        finishCpu('draw', opponentSecret)
        return
      }
      const playerCanGuess = guesses.length < maxAttempts
      setIsMyTurn(playerCanGuess)
      setPresence(playerCanGuess ? 'online' : 'wait')
      if (playerCanGuess) setError('')
      setTurnNumber((n) => n + 1)
      setSecondsLeft(timer > 0 && playerCanGuess ? timer : null)
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
    cpuGuessCount,
    maxAttempts,
    guesses.length,
    allowRepeats,
    length,
    playerSecret,
    opponentSecret,
    timer,
    muted,
    finishCpu,
    cpuDifficulty,
  ])

  // Timer
  useEffect(() => {
    if (screen !== 'play' || !isMyTurn || timer === 0 || won) return
    if (secondsLeft === null) return
    if (secondsLeft <= 0) {
      setSecondsLeft(null)
      playSfx(muted, 'turn')
      if (mode === 'cpu') {
        setIsMyTurn(false)
        setPresence('wait')
        setError('انتهى الوقت — انتقل الدور')
        return
      }
      // The database owns the deadline and advances an expired turn on the next poll.
      return
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? s : s - 1)), 1000)
    return () => clearTimeout(t)
  }, [screen, isMyTurn, timer, secondsLeft, won, mode, roomCode, playerId, applyOnlineRoom, muted])

  useEffect(() => {
    if (screen !== 'play' || !startedAt) return
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [screen, startedAt])

  useEffect(() => {
    const timerId = setTimeout(() => {
      const initial = totalSecretCount(length, allowRepeats)
      if (!guesses.length) {
        setProbabilityHistory([])
        return
      }
      const history: ProbabilityStep[] = []
      let before = initial
      for (let index = 0; index < guesses.length; index++) {
        const after = countPossibleSecrets(length, allowRepeats, guesses.slice(0, index + 1))
        history.push({ before, after })
        before = after
      }
      setProbabilityHistory(history)
    }, 0)
    return () => clearTimeout(timerId)
  }, [allowRepeats, guesses, length])

  const useHint = async (type: HintType) => {
    setHintOpen(false)
    if (hintUses >= hintLimit) return
    if (mode === 'cpu') {
      const last = guesses[guesses.length - 1]
      if (type === 'position' && (!last || last.correct < 1)) {
        setHint('خمّن مرة فيها خانة صحيحة ثم استخدم التلميح')
        return
      }
      if (type === 'position' && last) {
        const positions: number[] = []
        for (let i = 0; i < last.value.length; i++) {
          if (last.value[i] === opponentSecret[i]) positions.push(i + 1)
        }
        const pick = positions[Math.floor(Math.random() * positions.length)]
        setHint(`الخانة رقم ${pick} من آخر تخمينك صحيحة (بدون كشف الرقم)`)
      } else if (type === 'parity') {
        const index = Math.floor(Math.random() * length)
        const digit = Number(opponentSecret[index])
        setHint(`رقم الخانة ${index + 1} ${digit % 2 === 0 ? 'زوجي' : 'فردي'}`)
      } else {
        const index = Math.floor(Math.random() * length)
        const secretDigit = opponentSecret[index]
        const excluded = String((Number(secretDigit) + 1 + Math.floor(Math.random() * 9)) % 10)
        setHint(`استبعد الرقم ${excluded} من الخانة ${index + 1}`)
        setMarked((previous) => new Set(previous).add(`${excluded}-${index}`))
      }
      setHintUses((used) => used + 1)
      playSfx(muted, 'hint')
      return
    }
    if (!roomCode || !playerId || !playerToken) return
    const { data, error: err } = await getSupabase().rpc('nd_use_hint', {
      p_code: roomCode,
      p_player_id: playerId,
      p_player_token: playerToken,
      p_hint_type: type,
    })
    if (err || !data?.ok) {
      setHint(err?.message || data?.error || 'فشل التلميح')
      return
    }
    setHint(data.message || '')
    setHintUses((used) => used + 1)
    if (data.room) applyOnlineRoom(data.room as RoomPayload, playerId, { silent: true })
    playSfx(muted, 'hint')
  }

  const toggleMark = useCallback((key: string) => {
    setMarked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const rematch = async () => {
    if (mode === 'cpu') {
      resetSession()
      setCpuCandidates(buildCandidates(length, allowRepeats))
      setOpponentSecret('')
      setScreen('setup')
      return
    }
    if (!roomCode || !playerId || !playerToken) return
    const { data, error: err } = await getSupabase().rpc('nd_rematch', {
      p_code: roomCode,
      p_player_id: playerId,
      p_player_token: playerToken,
    })
    if (err || !data?.ok) {
      setError(err?.message || data?.error || 'فشل إعادة اللعب')
      return
    }
    resetSession()
    applyOnlineRoom(data.room as RoomPayload, playerId, { silent: true })
  }

  const sendChat = async (body: string) => {
    if (!roomCode || !playerId || !playerToken) return false
    const trimmed = body.trim()
    if (!trimmed) return false

    try {
      const { data } = await getSupabase().rpc('nd_send_chat', {
        p_code: roomCode,
        p_player_id: playerId,
        p_player_token: playerToken,
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
        return true
      }
    } catch {
      return false
    }
    return false
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
      v: 2,
      matchGen: matchGenRef.current,
      screen,
      length,
      playerSecret,
      opponentSecret,
      guesses,
      cpuCandidates,
      isMyTurn,
      turnNumber,
      hintUses,
      marked: [...marked],
      won,
      cpuPickingSecret,
      gameMode,
      allowRepeats,
      cpuGuessCount,
      outcome,
      score,
      startedAt,
      elapsedSeconds,
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
    hintUses,
    marked,
    won,
    cpuPickingSecret,
    gameMode,
    allowRepeats,
    cpuGuessCount,
    outcome,
    score,
    startedAt,
    elapsedSeconds,
  ])

  // Restore online or CPU session — once on boot only (avoid overwriting tracker mid-match)
  useEffect(() => {
    if (!booted || sessionBootstrappedRef.current) return
    sessionBootstrappedRef.current = true

    const raw = localStorage.getItem('nd_active')
    if (raw) {
      ;(async () => {
        try {
          const { code, playerId: pid, playerToken: token } = JSON.parse(raw)
          if (!code || !pid || !token) {
            localStorage.removeItem('nd_active')
            return
          }
          const { data } = await getSupabase().rpc('nd_get_room', {
            p_code: code,
            p_player_id: pid,
            p_player_token: token,
          })
          if (!data?.ok) {
            localStorage.removeItem('nd_active')
            return
          }
          setMode('room')
          setPlayerId(pid)
          setPlayerToken(token)
          storageSet('nd_logged', true)
          applyOnlineRoom(data.room as RoomPayload, pid, { silent: true })
          subscribeRoom(code, pid, token)
        } catch {
          localStorage.removeItem('nd_active')
        }
      })()
      return
    }

    const cpu = storageGet<CpuSession | null>('nd_cpu_session', null)
    if (!cpu || cpu.v !== 2) return
    if (!['setup', 'play', 'finished'].includes(cpu.screen)) return
    setMode('cpu')
    matchGenRef.current = cpu.matchGen ?? 0
    trackerScopeRef.current = `cpu:${cpu.matchGen ?? 0}`
    setLength(cpu.length)
    setPlayerSecret(cpu.playerSecret || '')
    setOpponentSecret(cpu.opponentSecret || '')
    setGuesses(cpu.guesses || [])
    setCpuCandidates(cpu.cpuCandidates?.length ? cpu.cpuCandidates : buildCandidates(cpu.length, cpu.allowRepeats))
    setIsMyTurn(cpu.isMyTurn)
    setTurnNumber(cpu.turnNumber || 1)
    setHintUses(cpu.hintUses || 0)
    setMarked(new Set(cpu.marked || []))
    setWon(Boolean(cpu.won))
    setCpuPickingSecret(Boolean(cpu.cpuPickingSecret))
    setGameMode(cpu.gameMode || 'normal')
    setTimer(MODE_PRESETS[cpu.gameMode || 'normal'].timer)
    setAllowRepeats(cpu.allowRepeats ?? true)
    setCpuGuessCount(cpu.cpuGuessCount || 0)
    setOutcome(cpu.outcome || 'lose')
    setScore(cpu.score || 0)
    setStartedAt(cpu.startedAt || Date.now())
    setElapsedSeconds(cpu.elapsedSeconds || 0)
    setPresence(cpu.isMyTurn ? 'online' : 'wait')
    setScreen(cpu.screen)
    storageSet('nd_logged', true)
  }, [booted, applyOnlineRoom, subscribeRoom])

  // Offline presence
  useEffect(() => {
    const onOff = () => setPresence('offline')
    const onOn = () => {
      if (mode === 'room' && roomCode && playerId && playerToken) {
        subscribeRoom(roomCode, playerId, playerToken)
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
  }, [mode, roomCode, playerId, playerToken, subscribeRoom, screen, isMyTurn])

  if (!booted) {
    return <main className="game-shell mx-auto flex min-h-dvh w-full max-w-md items-center justify-center" />
  }

  const displayScore = score || calculateScore({
    length,
    mode: gameMode,
    maxAttempts,
    guessesUsed: Math.max(1, guesses.length),
    elapsedSeconds,
    hintsUsed: hintUses,
  })

  const finishMemory = (result: { bestLength: number; score: number; xp: number; daily: boolean; wonDaily: boolean }) => {
    setProfile(current => recordMemory(current, result.bestLength, result.xp, result.daily && result.wonDaily))
  }

  const finishLocal = (result: { won: boolean; attempts: number; seconds: number; score: number }) => {
    setProfile(current => recordDuel(current, result))
  }

  if (experience === 'memory' || experience === 'daily') {
    return <main className="game-shell mx-auto flex h-dvh min-h-dvh w-full max-w-md flex-col overflow-hidden"><MemoryGame daily={experience === 'daily'} muted={muted} onExit={() => setExperience('duel')} onComplete={finishMemory} /></main>
  }

  if (experience === 'local') {
    return <main className="game-shell mx-auto flex h-dvh min-h-dvh w-full max-w-md flex-col overflow-hidden"><LocalDuel key={`${length}-${gameMode}-${allowRepeats}`} length={length} gameMode={gameMode} allowRepeats={allowRepeats} muted={muted} onExit={() => setExperience('duel')} onComplete={finishLocal} /></main>
  }

  return (
    <main className="game-shell mx-auto flex h-dvh min-h-dvh w-full max-w-md flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">
        {screen === 'login' && (
          <LoginScreen onGoogle={enterGoogle} onGuest={enterAsGuest} />
        )}

        {screen === 'home' && (
          <HomeScreen
            nickname={nickname}
            profile={profile}
            muted={muted}
            onMuted={setMuted}
            onProfile={() => setProfileOpen(true)}
            onCreateRoom={() => openMatchSetup('create')}
            onRandomMatch={startRandomMatch}
            onPlayComputer={() => openMatchSetup('cpu')}
            onPlayLocal={() => openMatchSetup('local')}
            onMemory={() => setExperience('memory')}
            onDaily={() => setExperience('daily')}
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
            allowRepeats={allowRepeats}
            onConfirm={confirmSecret}
            onBack={exitMatch}
            waitingOpponent={cpuPickingSecret}
            error={error}
            busy={busy}
          />
        )}

        {screen === 'play' && (
          <PlayScreen
            length={length}
            allowRepeats={allowRepeats}
            gameMode={gameMode}
            maxAttempts={maxAttempts}
            score={displayScore}
            isMyTurn={isMyTurn}
            turnNumber={turnNumber}
            guesses={guesses}
            timer={timer}
            secondsLeft={secondsLeft}
            hintsRemaining={Math.max(0, hintLimit - hintUses)}
            hint={hint || error || null}
            presence={presence}
            mySecret={playerSecret}
            showChat={mode === 'room'}
            unreadChat={unreadChat}
            keyboardEnabled={!trackerOpen && !chatOpen && !exitOpen && !matchSetupOpen && !hintOpen && !probabilityOpen}
            onGuess={handleGuess}
            onHint={() => setHintOpen(true)}
            onOpenTracker={() => setTrackerOpen(true)}
            onOpenProbabilities={() => setProbabilityOpen(true)}
            onOpenChat={() => setChatOpen(true)}
            onExit={exitMatch}
          />
        )}

        {screen === 'finished' && (
          <FinishedScreen
            outcome={outcome}
            opponentSecret={opponentSecret}
            attempts={guesses.length}
            streak={streak}
            score={score}
            elapsedSeconds={elapsedSeconds}
            onRematch={rematch}
            onHome={goHome}
            onReplay={() => setReplayOpen(true)}
            onShare={() => void shareResultImage({ title: outcome === 'win' ? 'فوز!' : outcome === 'draw' ? 'تعادل' : 'محاولة قوية', score, attempts: guesses.length, outcome })}
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
        onClear={() => setMarked(new Set())}
      />
      <HintSheet
        open={hintOpen}
        onClose={() => setHintOpen(false)}
        remaining={Math.max(0, hintLimit - hintUses)}
        onChoose={useHint}
      />
      <ProbabilitySheet
        open={probabilityOpen}
        onClose={() => setProbabilityOpen(false)}
        guesses={guesses}
        history={probabilityHistory.length ? probabilityHistory : [{ before: totalSecretCount(length, allowRepeats), after: totalSecretCount(length, allowRepeats) }]}
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
        matchMode={matchMode}
        difficulty={difficulty}
        onDifficulty={setDifficulty}
        gameMode={gameMode}
        onGameMode={selectGameMode}
        allowRepeats={allowRepeats}
        onAllowRepeats={setAllowRepeats}
        cpuDifficulty={cpuDifficulty}
        onCpuDifficulty={setCpuDifficulty}
        busy={busy}
        onConfirm={confirmMatchSetup}
      />
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} name={nickname} onName={setNickname} profile={profile} onAvatar={avatar => setProfile(current => ({ ...current, avatar }))} theme={theme} onTheme={setTheme} />
      <ReplaySheet open={replayOpen} onClose={() => setReplayOpen(false)} guesses={guesses} length={length} />
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
