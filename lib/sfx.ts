'use client'

/** Lightweight Web Audio SFX — no asset files needed. */

let sharedCtx: AudioContext | null = null

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!sharedCtx) {
      sharedCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    if (sharedCtx.state === 'suspended') void sharedCtx.resume()
    return sharedCtx
  } catch {
    return null
  }
}

function tone(
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  gainPeak: number,
) {
  const c = ctx()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(frequency, start)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gainPeak, start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  o.connect(g)
  g.connect(c.destination)
  o.start(start)
  o.stop(start + duration + 0.02)
}

export type SfxKind =
  | 'tap'
  | 'click'
  | 'success'
  | 'fail'
  | 'turn'
  | 'hint'
  | 'chat'
  | 'win'
  | 'lose'
  | 'guess'

export function playSfx(muted: boolean, kind: SfxKind) {
  if (muted) return
  const c = ctx()
  if (!c) return
  const t = c.currentTime

  switch (kind) {
    case 'tap':
      tone(660, t, 0.05, 'triangle', 0.035)
      break
    case 'click':
      tone(520, t, 0.04, 'square', 0.02)
      break
    case 'guess':
      tone(420, t, 0.07, 'sine', 0.04)
      tone(560, t + 0.05, 0.08, 'sine', 0.03)
      break
    case 'success':
      tone(523, t, 0.09, 'sine', 0.05)
      tone(659, t + 0.08, 0.1, 'sine', 0.045)
      tone(784, t + 0.16, 0.14, 'triangle', 0.04)
      break
    case 'fail':
      tone(280, t, 0.14, 'sawtooth', 0.035)
      tone(220, t + 0.1, 0.16, 'triangle', 0.03)
      break
    case 'turn':
      tone(540, t, 0.08, 'triangle', 0.045)
      tone(720, t + 0.07, 0.1, 'sine', 0.035)
      break
    case 'hint':
      tone(700, t, 0.06, 'sine', 0.04)
      tone(880, t + 0.07, 0.1, 'triangle', 0.035)
      break
    case 'chat':
      tone(880, t, 0.05, 'sine', 0.03)
      tone(1100, t + 0.04, 0.06, 'sine', 0.025)
      break
    case 'win':
      tone(523, t, 0.1, 'sine', 0.05)
      tone(659, t + 0.1, 0.1, 'sine', 0.05)
      tone(784, t + 0.2, 0.12, 'sine', 0.05)
      tone(1046, t + 0.32, 0.22, 'triangle', 0.045)
      break
    case 'lose':
      tone(392, t, 0.12, 'triangle', 0.04)
      tone(330, t + 0.12, 0.14, 'triangle', 0.035)
      tone(262, t + 0.26, 0.22, 'sine', 0.03)
      break
  }
}
