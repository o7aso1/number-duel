export type Difficulty = 3 | 4 | 5 | 6

export type GameMode = 'normal' | 'quick' | 'expert' | 'one-shot'

export type GameRules = {
  mode: GameMode
  length: Difficulty
  allowRepeats: boolean
  maxAttempts: number
  timer: TimerOption
  hintLimit: number
}

/** classic = رمضاني (الافتراضي)، oasis = الأخضر الغابي، day = نهاري */
export type ThemeName = 'classic' | 'neon' | 'space' | 'paper'

export type CpuDifficulty = 'easy' | 'medium' | 'hard'

export type TimerOption = 0 | 20 | 30 | 45 | 60

export type Screen =
  | 'login'
  | 'home'
  | 'lobby'
  | 'setup'
  | 'play'
  | 'finished'

export type Guess = {
  value: string
  correct: number
}

export type HintType = 'position' | 'parity' | 'exclude'

export type MatchOutcome = 'win' | 'lose' | 'draw'

export type ChatMessage = {
  id: string
  playerId: string
  playerName: string
  body: string
  createdAt: string
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  3: 'سهل',
  4: 'متوسط',
  5: 'صعب',
  6: 'أسطوري',
}

export const MODE_PRESETS: Record<
  GameMode,
  { label: string; description: string; timer: TimerOption; maxAttempts: number; hintLimit: number }
> = {
  normal: {
    label: 'عادي',
    description: 'وقت مفتوح ومرونة أكبر',
    timer: 0,
    maxAttempts: 12,
    hintLimit: 3,
  },
  quick: {
    label: 'سريع',
    description: '20 ثانية لكل دور',
    timer: 20,
    maxAttempts: 8,
    hintLimit: 2,
  },
  expert: {
    label: 'خبير',
    description: 'محاولات قليلة وتلميح واحد',
    timer: 30,
    maxAttempts: 6,
    hintLimit: 1,
  },
  'one-shot': {
    label: 'محاولة واحدة',
    description: 'فرصة واحدة لكل لاعب',
    timer: 60,
    maxAttempts: 1,
    hintLimit: 0,
  },
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 5; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export function countCorrect(guess: string, secret: string): number {
  let n = 0
  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) n++
  }
  return n
}

export function isAllSameDigit(value: string): boolean {
  return value.length > 1 && value.split('').every((d) => d === value[0])
}

/** Secret number: any digits of the right length (all-same allowed). */
export function hasUniqueDigits(value: string): boolean {
  return new Set(value).size === value.length
}

export function isValidSecret(value: string, length: number, allowRepeats = true): boolean {
  return value.length === length && /^\d+$/.test(value) && (allowRepeats || hasUniqueDigits(value))
}

/** Guess: all-same like 1111 is banned. */
export function isValidGuess(value: string, length: number, allowRepeats = true): boolean {
  return isValidSecret(value, length, allowRepeats) && !isAllSameDigit(value)
}

export function generateSecret(length: Difficulty, allowRepeats = true): string {
  if (allowRepeats) {
    let value = ''
    for (let i = 0; i < length; i++) value += Math.floor(Math.random() * 10).toString()
    return value
  }
  const digits = Array.from({ length: 10 }, (_, i) => String(i))
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[digits[i], digits[j]] = [digits[j], digits[i]]
  }
  return digits.slice(0, length).join('')
}

export function totalSecretCount(length: number, allowRepeats: boolean): number {
  if (allowRepeats) return 10 ** length
  let count = 1
  for (let i = 0; i < length; i++) count *= 10 - i
  return count
}

/** A bounded pool keeps six-digit computer matches responsive on phones. */
export function buildCandidates(length: number, allowRepeats = true, cap = 60000): string[] {
  const out: string[] = []
  const max = 10 ** length
  const stride = max > cap ? Math.max(1, Math.floor(max / cap)) : 1
  for (let i = 0; i < max && out.length < cap; i += stride) {
    const s = String(i).padStart(length, '0')
    if (isValidGuess(s, length, allowRepeats)) out.push(s)
  }
  return out
}

/** Exact remaining secret count. At six digits this checks at most one million values. */
export function countPossibleSecrets(
  length: number,
  allowRepeats: boolean,
  guesses: Guess[],
): number {
  if (!guesses.length) return totalSecretCount(length, allowRepeats)
  let count = 0
  const max = 10 ** length
  for (let i = 0; i < max; i++) {
    const candidate = String(i).padStart(length, '0')
    if (!allowRepeats && !hasUniqueDigits(candidate)) continue
    if (guesses.every((guess) => countCorrect(guess.value, candidate) === guess.correct)) count++
  }
  return count
}

export function calculateScore({
  length,
  mode,
  maxAttempts,
  guessesUsed,
  elapsedSeconds,
  hintsUsed,
}: {
  length: number
  mode: GameMode
  maxAttempts: number
  guessesUsed: number
  elapsedSeconds: number
  hintsUsed: number
}): number {
  const modeMultiplier = { normal: 1, quick: 1.25, expert: 1.6, 'one-shot': 2.4 }[mode]
  const base = length * 1000
  const unusedAttempts = Math.max(0, maxAttempts - guessesUsed)
  const speedBonus = Math.max(0, 900 - elapsedSeconds * 6)
  const hintPenalty = hintsUsed * 180
  return Math.max(100, Math.round((base + unusedAttempts * 140 + speedBonus - hintPenalty) * modeMultiplier))
}

export function filterCandidates(
  candidates: string[],
  guess: string,
  correct: number,
): string[] {
  return candidates.filter((c) => countCorrect(guess, c) === correct)
}

/** Pick a candidate that keeps the search space narrow. */
export function pickSmartGuess(candidates: string[], length = 4, allowRepeats = true): string {
  if (!candidates.length) {
    let s = generateSecret(length as Difficulty, allowRepeats)
    while (!isValidGuess(s, length, allowRepeats)) s = generateSecret(length as Difficulty, allowRepeats)
    return s
  }
  if (candidates.length === 1) return candidates[0]
  const sample =
    candidates.length <= 40
      ? candidates
      : Array.from({ length: 40 }, () => candidates[Math.floor(Math.random() * candidates.length)])
  let best = sample[0]
  let bestScore = Infinity
  for (const g of sample) {
    const buckets = new Map<number, number>()
    const probe =
      candidates.length <= 200
        ? candidates
        : Array.from({ length: 200 }, () => candidates[Math.floor(Math.random() * candidates.length)])
    for (const c of probe) {
      const sc = countCorrect(g, c)
      buckets.set(sc, (buckets.get(sc) || 0) + 1)
    }
    const worst = Math.max(...buckets.values())
    if (worst < bestScore) {
      bestScore = worst
      best = g
    }
  }
  return best
}

export function normalizeTheme(raw: unknown): ThemeName {
  if (raw === 'neon' || raw === 'space' || raw === 'paper') return raw
  if (raw === 'day') return 'paper'
  if (raw === 'oasis') return 'neon'
  if (raw === 'ramadan') return 'classic'
  if (raw === 'classic') return 'classic'
  return 'classic'
}

export function storageGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return raw as unknown as T
    }
  } catch {
    return fallback
  }
}

export function storageSet(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

export function storageRemove(key: string) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(key)
}
