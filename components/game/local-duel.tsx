'use client'

import { useState } from 'react'
import { Smartphone, Users } from 'lucide-react'
import { SetupScreen } from '@/components/game/screens/setup-screen'
import { PlayScreen } from '@/components/game/screens/play-screen'
import { FinishedScreen } from '@/components/game/screens/finished-screen'
import { ReplaySheet } from '@/components/game/overlays/replay-sheet'
import { calculateScore, countCorrect, MODE_PRESETS, type Difficulty, type GameMode, type Guess } from '@/lib/game'
import { shareResultImage } from '@/lib/share-result'
import { playSfx } from '@/lib/sfx'

type Phase = 'secret1' | 'pass2' | 'secret2' | 'passTurn' | 'play' | 'finished'

export function LocalDuel({ length, gameMode, allowRepeats, muted, onExit, onComplete }: {
  length: Difficulty; gameMode: GameMode; allowRepeats: boolean; muted: boolean; onExit: () => void
  onComplete: (result: { won: boolean; attempts: number; seconds: number; score: number }) => void
}) {
  const preset = MODE_PRESETS[gameMode]
  const [phase, setPhase] = useState<Phase>('secret1')
  const [secrets, setSecrets] = useState<[string,string]>(['',''])
  const [active, setActive] = useState<0|1>(0)
  const [guesses, setGuesses] = useState<[Guess[],Guess[]]>([[],[]])
  const [winner, setWinner] = useState<0|1|null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const [replayOpen, setReplayOpen] = useState(false)
  const [finalSeconds, setFinalSeconds] = useState(0)
  const [finalScore, setFinalScore] = useState(0)

  const setSecret = (value: string) => {
    if (phase === 'secret1') { setSecrets([value, '']); setPhase('pass2') }
    else { setSecrets([secrets[0], value]); setActive(0); setStartedAt(Date.now()); setPhase('passTurn') }
    playSfx(muted, 'success')
  }
  const submit = (value: string) => {
    const item = { value, correct: countCorrect(value, secrets[active === 0 ? 1 : 0]) }
    const next: [Guess[],Guess[]] = active === 0 ? [[...guesses[0], item], guesses[1]] : [guesses[0], [...guesses[1], item]]
    setGuesses(next); playSfx(muted, 'guess'); navigator.vibrate?.(20)
    if (item.correct === length) {
      const seconds = Math.floor((Date.now() - startedAt) / 1000)
      const score = calculateScore({ length, mode: gameMode, maxAttempts: preset.maxAttempts, guessesUsed: next[active].length, elapsedSeconds: seconds, hintsUsed: 0 })
      setFinalSeconds(seconds); setFinalScore(score)
      setWinner(active); setPhase('finished'); playSfx(muted, 'win'); onComplete({ won: active === 0, attempts: next[0].length, seconds, score }); return
    }
    const other = active === 0 ? 1 : 0
    if (next[0].length >= preset.maxAttempts && next[1].length >= preset.maxAttempts) { const seconds = Math.floor((Date.now() - startedAt) / 1000); setFinalSeconds(seconds); setFinalScore(0); setWinner(null); setPhase('finished'); onComplete({ won: false, attempts: next[0].length, seconds, score: 0 }); return }
    setActive(other); setPhase('passTurn')
  }
  const restart = () => { setPhase('secret1'); setSecrets(['','']); setGuesses([[],[]]); setWinner(null); setActive(0); setFinalSeconds(0); setFinalScore(0) }
  if (phase === 'secret1' || phase === 'secret2') return <SetupScreen key={phase} length={length} allowRepeats={allowRepeats} onBack={onExit} onConfirm={setSecret} />
  if (phase === 'pass2' || phase === 'passTurn') {
    const player = phase === 'pass2' ? 2 : active + 1
    return <div className="flex flex-1 flex-col items-center justify-center px-5 text-center"><div className="glass-panel flex w-full max-w-sm flex-col items-center gap-5 rounded-[30px] p-7"><span className="animate-float-soft grid size-24 place-items-center rounded-[28px] border border-secondary/25 bg-secondary/12 text-secondary shadow-[0_24px_60px_-30px_var(--secondary)]"><Smartphone className="size-11" /></span><p className="eyebrow">PASS THE DEVICE</p><div><h1 className="text-2xl font-black">سلّم الجهاز للاعب {player}</h1><p className="mt-2 text-sm text-muted-foreground">تأكد أن اللاعب الآخر لا يرى الشاشة.</p></div><button onClick={() => setPhase(phase === 'pass2' ? 'secret2' : 'play')} className="premium-button flex w-full items-center justify-center gap-2 rounded-[17px] px-8 py-4 font-black"><Users className="size-5" />أنا اللاعب {player}</button></div></div>
  }
  if (phase === 'finished') {
    const mine = winner === null ? guesses[0] : guesses[winner]
    return <><FinishedScreen outcome={winner === null ? 'draw' : winner === 0 ? 'win' : 'lose'} opponentSecret={winner === null ? `${secrets[0]} / ${secrets[1]}` : secrets[winner === 0 ? 1 : 0]} attempts={mine.length} streak={0} score={finalScore} elapsedSeconds={finalSeconds} onRematch={restart} onHome={onExit} onReplay={() => setReplayOpen(true)} onShare={() => void shareResultImage({ title: winner === null ? 'تعادل محلي' : `فاز اللاعب ${winner + 1}`, score: finalScore, attempts: mine.length, outcome: 'local' })} /><ReplaySheet open={replayOpen} onClose={() => setReplayOpen(false)} guesses={mine} length={length} /></>
  }
  return <PlayScreen length={length} allowRepeats={allowRepeats} gameMode={gameMode} maxAttempts={preset.maxAttempts} score={0} isMyTurn turnNumber={guesses[0].length + guesses[1].length + 1} guesses={guesses[active]} timer={0} secondsLeft={null} hintsRemaining={0} hint={`اللاعب ${active + 1}: اكشف رقم اللاعب ${active === 0 ? 2 : 1}`} presence="online" keyboardEnabled onGuess={submit} onHint={() => {}} onOpenTracker={() => {}} onOpenProbabilities={() => {}} onExit={onExit} />
}
