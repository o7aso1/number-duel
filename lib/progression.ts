import type { ThemeName } from '@/lib/game'

export type AvatarId = 'falcon' | 'robot' | 'rocket' | 'crown' | 'fox' | 'ninja'

export type PlayerProfile = {
  avatar: AvatarId
  xp: number
  games: number
  wins: number
  totalAttempts: number
  fastestSolve: number | null
  dailyStreak: number
  bestDailyStreak: number
  lastDailyWin: string | null
  memoryBest: number
  achievements: string[]
}

export const AVATARS: { id: AvatarId; emoji: string; label: string }[] = [
  { id: 'falcon', emoji: '🦅', label: 'الصقر' },
  { id: 'robot', emoji: '🤖', label: 'الروبوت' },
  { id: 'rocket', emoji: '🚀', label: 'الصاروخ' },
  { id: 'crown', emoji: '👑', label: 'التاج' },
  { id: 'fox', emoji: '🦊', label: 'الثعلب' },
  { id: 'ninja', emoji: '🥷', label: 'النينجا' },
]

export const DEFAULT_PROFILE: PlayerProfile = {
  avatar: 'falcon', xp: 0, games: 0, wins: 0, totalAttempts: 0,
  fastestSolve: null, dailyStreak: 0, bestDailyStreak: 0,
  lastDailyWin: null, memoryBest: 0, achievements: [],
}

export const ACHIEVEMENTS = [
  { id: 'first_win', icon: '🏆', title: 'أول انتصار', description: 'افز بأول مباراة' },
  { id: 'speedster', icon: '⚡', title: 'خاطف', description: 'حل الرقم خلال 30 ثانية' },
  { id: 'sharp_memory', icon: '🧠', title: 'ذاكرة حادة', description: 'تجاوز 8 خانات في الذاكرة' },
  { id: 'streak_3', icon: '🔥', title: 'مستمر', description: 'حافظ على سلسلة يومية 3 أيام' },
  { id: 'veteran', icon: '🎖️', title: 'مخضرم', description: 'العب 25 مباراة' },
]

export function levelFromXp(xp: number) { return Math.floor(Math.max(0, xp) / 500) + 1 }
export function xpInLevel(xp: number) { return Math.max(0, xp) % 500 }

export function unlockedThemes(profile: PlayerProfile): ThemeName[] {
  const level = levelFromXp(profile.xp)
  return ['classic', ...(level >= 2 ? ['neon'] : []), ...(level >= 4 ? ['space'] : []), ...(level >= 6 ? ['paper'] : [])] as ThemeName[]
}

export function todayKey(date = new Date()) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function yesterdayKey(date = new Date()) {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() - 1)
  return todayKey(copy)
}

function withAchievements(profile: PlayerProfile): PlayerProfile {
  const earned = new Set(profile.achievements)
  if (profile.wins >= 1) earned.add('first_win')
  if (profile.fastestSolve !== null && profile.fastestSolve <= 30) earned.add('speedster')
  if (profile.memoryBest >= 8) earned.add('sharp_memory')
  if (profile.dailyStreak >= 3) earned.add('streak_3')
  if (profile.games >= 25) earned.add('veteran')
  return { ...profile, achievements: [...earned] }
}

export function recordDuel(profile: PlayerProfile, result: { won: boolean; attempts: number; seconds: number; score: number }) {
  return withAchievements({
    ...profile,
    xp: profile.xp + Math.max(30, Math.round(result.score / 10)),
    games: profile.games + 1,
    wins: profile.wins + (result.won ? 1 : 0),
    totalAttempts: profile.totalAttempts + result.attempts,
    fastestSolve: result.won ? Math.min(profile.fastestSolve ?? Infinity, result.seconds) : profile.fastestSolve,
  })
}

export function recordMemory(profile: PlayerProfile, bestLength: number, xp: number, daily = false) {
  let dailyStreak = profile.dailyStreak
  let lastDailyWin = profile.lastDailyWin
  if (daily) {
    const today = todayKey()
    if (lastDailyWin !== today) {
      dailyStreak = lastDailyWin === yesterdayKey() ? dailyStreak + 1 : 1
      lastDailyWin = today
    }
  }
  return withAchievements({
    ...profile,
    xp: profile.xp + xp,
    memoryBest: Math.max(profile.memoryBest, bestLength),
    dailyStreak,
    bestDailyStreak: Math.max(profile.bestDailyStreak, dailyStreak),
    lastDailyWin,
  })
}

export function normalizeProfile(raw: Partial<PlayerProfile> | null | undefined): PlayerProfile {
  return { ...DEFAULT_PROFILE, ...(raw || {}), achievements: Array.isArray(raw?.achievements) ? raw.achievements : [] }
}

export function seededDigits(seed: string, length: number): string {
  let hash = 2166136261
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  let value = ''
  for (let i = 0; i < length; i++) {
    hash ^= hash << 13; hash ^= hash >>> 17; hash ^= hash << 5
    value += String(Math.abs(hash) % 10)
  }
  return value
}
