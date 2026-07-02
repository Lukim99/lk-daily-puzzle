import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Puzzle } from '../data/puzzles'
import type { GameState, SubmitResult } from '../lib/game'

interface ShadowRoomProps {
  state: GameState
  puzzle: Puzzle
  busy: boolean
  onBack: () => void
  onSubmit: (answer: string) => Promise<SubmitResult | null>
}

const PHASE_COPY = [
  '빛은 물체보다 반응을 먼저 기억한다.',
  '전부 보이는 동안에는 아무것도 맞지 않는다.',
  '움직이지 않는 것도 입력이다.',
  '실수는 사라지지 않는다. 필요한 것만 남겨라.',
  '보는 장치가 맞으면, 중심은 보이지 않는다.',
]
const STORAGE_KEY = 'daily-puzzle-shadow-room-v1'

function tone(frequency: number, duration = 0.12) {
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return
  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.045, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + duration)
  oscillator.addEventListener('ended', () => void context.close())
}

export function ShadowRoom({ state, puzzle, busy, onBack, onSubmit }: ShadowRoomProps) {
  const roomRef = useRef<HTMLDivElement>(null)
  const idleTimer = useRef<number | null>(null)
  const finalTimer = useRef<number | null>(null)
  const submitted = useRef(false)
  const [phase, setPhase] = useState(() => Math.max(1, Math.min(5, Number(localStorage.getItem(STORAGE_KEY)) || 1)))
  const [pointer, setPointer] = useState({ x: 52, y: 74 })
  const [shadowHits, setShadowHits] = useState<string[]>([])
  const [aperture, setAperture] = useState(100)
  const [settled, setSettled] = useState(false)
  const [scars, setScars] = useState<string[]>([])
  const [hold, setHold] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const solved = Boolean(state.round?.solved_at)

  const advance = useCallback((next: number) => {
    tone(220 + next * 65, 0.25)
    setPhase(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }, [])

  const resetIdle = useCallback(() => {
    setSettled(false)
    if (idleTimer.current) window.clearTimeout(idleTimer.current)
    if (phase === 3) {
      idleTimer.current = window.setTimeout(() => {
        setSettled(true)
        tone(180, 0.35)
      }, 4200)
    }
  }, [phase])

  useEffect(() => {
    if (phase === 3) resetIdle()
    return () => { if (idleTimer.current) window.clearTimeout(idleTimer.current) }
  }, [phase, resetIdle])

  useEffect(() => {
    if (phase !== 5 || submitted.current || solved) return
    const safe = pointer.x > 78 && pointer.y > 72
    if (!safe) {
      setHold(0)
      if (finalTimer.current) window.clearInterval(finalTimer.current)
      return
    }
    finalTimer.current = window.setInterval(() => {
      setHold((value) => {
        const next = value + 1
        if (next >= 6) {
          window.clearInterval(finalTimer.current!)
          submitted.current = true
          tone(660, 0.7)
          void onSubmit('KAIST').then((result) => {
            if (!result?.correct) setMessage('구조는 닫혔지만 서버의 봉인이 응답하지 않았습니다.')
          })
        }
        return next
      })
    }, 1000)
    return () => { if (finalTimer.current) window.clearInterval(finalTimer.current) }
  }, [phase, pointer.x, pointer.y, onSubmit, solved])

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = roomRef.current?.getBoundingClientRect()
    if (!bounds) return
    const next = {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    }
    const distance = Math.hypot(next.x - pointer.x, next.y - pointer.y)
    setPointer(next)

    if (phase === 1) {
      const shadow = { x: next.x + 9, y: next.y + 7 }
      const targets = [['crack', 29, 31], ['moth', 73, 29], ['ring', 62, 62], ['glass', 34, 68]] as const
      for (const [name, x, y] of targets) {
        if (Math.hypot(shadow.x - x, shadow.y - y) < 9 && !shadowHits.includes(name)) {
          setShadowHits((hits) => hits.includes(name) ? hits : [...hits, name])
          tone(150 + shadowHits.length * 55)
        }
      }
    }
    if (phase === 3 && settled && distance > 0.2 && distance < 2.4) advance(4)
    else if (phase === 3 && distance >= 2.4) resetIdle()
  }

  useEffect(() => {
    if (phase === 1 && shadowHits.length === 4) {
      const timer = window.setTimeout(() => advance(2), 700)
      return () => window.clearTimeout(timer)
    }
  }, [phase, shadowHits.length, advance])

  useEffect(() => {
    if (phase === 2 && aperture >= 51 && aperture <= 57) {
      const timer = window.setTimeout(() => advance(3), 1100)
      return () => window.clearTimeout(timer)
    }
  }, [phase, aperture, advance])

  useEffect(() => {
    if (phase === 4 && scars.length === 3) {
      const timer = window.setTimeout(() => advance(5), 900)
      return () => window.clearTimeout(timer)
    }
  }, [phase, scars.length, advance])

  const addScar = (name: string) => {
    if (phase !== 4 || scars.includes(name)) return
    setScars((current) => [...current, name])
    tone(105, 0.2)
  }

  return (
    <main className='shadow-case'>
      <header className='shadow-topbar'>
        <button onClick={onBack}>← 사건 목록</button>
        <div><small>{puzzle.code} / RESTRICTED</small><strong>{puzzle.title}</strong></div>
        <span>{state.profile?.balance.toLocaleString()} P</span>
      </header>
      <section className='shadow-stage'>
        <aside className='shadow-dossier'>
          <p>OBSERVATION LOG</p>
          <h1>{puzzle.title}</h1>
          <div className='phase-index'>{String(phase).padStart(2, '0')}<span>/ 05</span></div>
          <p className='phase-copy'>{PHASE_COPY[phase - 1]}</p>
          <div className='signal-bars' aria-label={`진행 ${phase}/5`}>
            {[1, 2, 3, 4, 5].map((step) => <i key={step} className={step <= phase ? 'active' : ''} />)}
          </div>
          <small>직접 조작은 흔적을 남긴다.<br />화면의 반응 위치를 관찰하라.</small>
        </aside>
        <div ref={roomRef} className={`shadow-room phase-${phase} ${settled ? 'is-settled' : ''}`} onPointerMove={move}>
          <div className='room-grain' /><div className='ceiling-light' />
          <div className='crack target' onPointerDown={() => addScar('crack')} />
          <div className='moth target'><i /><i /></div>
          <div className='hanging-ring target' onPointerDown={() => addScar('ring')}><i /></div>
          <div className='glass target' onPointerDown={() => addScar('glass')} />
          <div className='lens' />
          <div className='dust'>{Array.from({ length: 18 }, (_, i) => <i key={i} />)}</div>
          <div className='pointer-shadow' style={{ left: `${pointer.x + 9}%`, top: `${pointer.y + 7}%` }} />
          <div className='false-cursor' style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }} />
          {phase === 2 && <label className='aperture-control'><span>VIEWPORT APERTURE</span><input type='range' min='38' max='100' value={aperture} onChange={(event) => setAperture(Number(event.target.value))} /></label>}
          <div className='left-shutter' style={{ width: `${(100 - aperture) / 2}%` }} />
          <div className='right-shutter' style={{ width: `${(100 - aperture) / 2}%` }} />
          {phase === 1 && <div className='room-status'>반응점 {shadowHits.length} / 4</div>}
          {phase === 3 && <div className='room-status'>{settled ? '정렬됨 · 아주 조금만 움직여라' : '입력이 사라지기를 기다리는 중'}</div>}
          {phase === 4 && <div className='room-status'>필요한 흔적 {scars.length} / 3</div>}
          {phase === 5 && <div className='room-status final-status'>오른쪽 아래의 어둠에 커서를 두고 기다려라 · {Math.min(hold, 6)} / 6</div>}
          {scars.includes('crack') && <i className='scar scar-a' />}{scars.includes('ring') && <i className='scar scar-b' />}{scars.includes('glass') && <i className='scar scar-c' />}
          {phase === 5 && <div className='final-occluder' />}
        </div>
      </section>
      {(busy || solved || message) && <div className='shadow-result' role='status'>{busy ? '방이 마지막 반응을 기록하는 중…' : solved ? '관찰 종료 · 방은 더 이상 중심을 보여주지 않는다.' : message}</div>}
    </main>
  )
}
