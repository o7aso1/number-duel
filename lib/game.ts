export type Difficulty = 3 | 4 | 5

export type ThemeName = 'classic' | 'day' | 'ramadan'

export type TimerOption = 0 | 30 | 45 | 60

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

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  3: 'سهل',
  4: 'متوسط',
  5: 'صعب',
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

export function isValidSecret(value: string, length: number): boolean {
  return (
    value.length === length &&
    /^\d+$/.test(value) &&
    !isAllSameDigit(value)
  )
}

export function generateSecret(length: Difficulty): string {
  let value = ''
  do {
    value = ''
    for (let i = 0; i < length; i++) {
      value += Math.floor(Math.random() * 10).toString()
    }
  } while (isAllSameDigit(value))
  return value
}

export function buildCandidates(length: number): string[] {
  const out: string[] = []
  const max = 10 ** length
  for (let i = 0; i < max; i++) {
    const s = String(i).padStart(length, '0')
    if (!isAllSameDigit(s)) out.push(s)
  }
  return out
}

export function filterCandidates(
  candidates: string[],
  guess: string,
  correct: number,
): string[] {
  return candidates.filter((c) => countCorrect(guess, c) === correct)
}

/** Pick a candidate that keeps the search space narrow. */
export function pickSmartGuess(candidates: string[]): string {
  if (!candidates.length) return generateSecret(4)
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
