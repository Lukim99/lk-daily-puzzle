import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from 'react'
import type { Puzzle } from '../data/puzzles'
import type { GameState, InteractiveProof, SubmitResult } from '../lib/game'

type Corner = 'nw' | 'ne' | 'se' | 'sw'
type Edge = 'top' | 'right' | 'bottom' | 'left'
type Point = { x: number; y: number }

interface GlasslessFrameProps {
  state: GameState
  puzzle: Puzzle
  busy: boolean
  onBack: () => void
  onBuyHint: () => Promise<string | null>
  onComplete: (proof: InteractiveProof) => Promise<SubmitResult | null>
}

interface SavedPuzzleState {
  seed: number
  phase: number
  pollution: number
  centerTouched: boolean
  centerProof: boolean
  edgeProof: boolean
  stamps: Corner[]
  inputProof: boolean
  frameProof: boolean
  foldProgress: number
}

const CORNERS: Corner[] = ['nw', 'ne', 'se', 'sw']
const EDGES: Edge[] = ['top', 'right', 'bottom', 'left']
const INITIAL_MOTHS: Point[] = [
  { x: 50, y: 20 }, { x: 65, y: 26 }, { x: 72, y: 43 }, { x: 63, y: 62 },
  { x: 45, y: 69 }, { x: 31, y: 57 }, { x: 29, y: 35 },
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const rotate = <T,>(items: T[], amount: number) => [...items.slice(amount), ...items.slice(0, amount)]

function getCorner(point: Point): Corner | null {
  if (point.x < 7 && point.y < 12) return 'nw'
  if (point.x > 93 && point.y < 12) return 'ne'
  if (point.x > 93 && point.y > 88) return 'se'
  if (point.x < 7 && point.y > 88) return 'sw'
  return null
}

function getSeededState(key: string): SavedPuzzleState {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? '') as Partial<SavedPuzzleState>
    if (typeof saved.seed === 'number') {
      return {
        seed: saved.seed,
        phase: clamp(saved.phase ?? 1, 1, 5),
        pollution: clamp(saved.pollution ?? 0, 0, 5),
        centerTouched: Boolean(saved.centerTouched),
        centerProof: Boolean(saved.centerProof),
        edgeProof: Boolean(saved.edgeProof),
        stamps: CORNERS.filter((corner) => saved.stamps?.includes(corner)),
        inputProof: Boolean(saved.inputProof),
        frameProof: Boolean(saved.frameProof),
        foldProgress: clamp(saved.foldProgress ?? 24, 18, 94),
      }
    }
  } catch {
    // A broken local snapshot is not proof; start a clean session.
  }
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]
  return { seed, phase: 1, pollution: 0, centerTouched: false, centerProof: false,
    edgeProof: false, stamps: [], inputProof: false, frameProof: false, foldProgress: 24 }
}

function sound(kind: 'crack' | 'cool' | 'stamp' | 'type' | 'warning' | 'proof' | 'success') {
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return
  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const frequencies = { crack: 118, cool: 164, stamp: 284, type: 82, warning: 54, proof: 392, success: 232 }
  const durations = { crack: .18, cool: .5, stamp: .14, type: .08, warning: .45, proof: .5, success: 1.8 }
  oscillator.type = kind === 'warning' || kind === 'type' ? 'sawtooth' : 'sine'
  oscillator.frequency.setValueAtTime(frequencies[kind], context.currentTime)
  if (kind === 'success') oscillator.frequency.exponentialRampToValueAtTime(464, context.currentTime + 1.3)
  gain.gain.setValueAtTime(kind === 'warning' ? .025 : .045, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + durations[kind])
  oscillator.connect(gain).connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + durations[kind])
  oscillator.addEventListener('ended', () => void context.close())
}

export function GlasslessFrame({ state, puzzle, busy, onBack, onBuyHint, onComplete }: GlasslessFrameProps) {
  const storageKey = `glassless-frame-${state.round?.play_date ?? 'preview'}`
  const initial = useMemo(() => getSeededState(storageKey), [storageKey])
  const stageRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const successRef = useRef<number | null>(null)
  const focusStartedAt = useRef(0)
  const typedDuringFocus = useRef(false)
  const completed = useRef(false)
  const frameDrag = useRef<{ y: number; progress: number } | null>(null)
  const activePointers = useRef(new Map<number, Point>())
  const lastPinchDistance = useRef<number | null>(null)
  const clippedSince = useRef(new Map<number, number>())

  const [seed, setSeed] = useState(initial.seed)
  const [phase, setPhase] = useState(initial.phase)
  const [pollution, setPollution] = useState(initial.pollution)
  const [centerTouched, setCenterTouched] = useState(initial.centerTouched)
  const [centerSuppressedEdge, setCenterSuppressedEdge] = useState(false)
  const [centerProof, setCenterProof] = useState(initial.centerProof)
  const [memoryCycle, setMemoryCycle] = useState(false)
  const [edgeProof, setEdgeProof] = useState(initial.edgeProof)
  const [positions, setPositions] = useState<Point[]>(INITIAL_MOTHS)
  const [dragging, setDragging] = useState<{ id: number; corner: Corner | null; enteredAt: number } | null>(null)
  const [stamps, setStamps] = useState<Corner[]>(initial.stamps)
  const [rottenCorners, setRottenCorners] = useState<Corner[]>([])
  const [cursorFocused, setCursorFocused] = useState(false)
  const [cursorDark, setCursorDark] = useState(false)
  const [typedPulse, setTypedPulse] = useState(0)
  const [inputProof, setInputProof] = useState(initial.inputProof)
  const [foldProgress, setFoldProgress] = useState(initial.foldProgress)
  const [nearClosedSeen, setNearClosedSeen] = useState(false)
  const [frameProof, setFrameProof] = useState(initial.frameProof)
  const [frameFailure, setFrameFailure] = useState(false)
  const [pointerBlank, setPointerBlank] = useState(false)
  const [lastInputBlank, setLastInputBlank] = useState(false)
  const [lastAction, setLastAction] = useState(Date.now())
  const [success, setSuccess] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [hintMessage, setHintMessage] = useState<string | null>(null)

  const memoryEdge = EDGES[seed % EDGES.length]
  const cornerOrder = useMemo(() => {
    const ordered = rotate(CORNERS, (seed >>> 3) % CORNERS.length)
    return ((seed >>> 7) & 1) === 1 ? [ordered[0], ordered[3], ordered[2], ordered[1]] : ordered
  }, [seed])
  const cursorPeriod = 820 + ((seed >>> 9) % 5) * 110
  const warningEdge = EDGES[(seed >>> 13) % EDGES.length]
  const holeDirection = EDGES[(seed >>> 16) % EDGES.length]
  const gapEdge = EDGES[(EDGES.indexOf(warningEdge) + 2) % EDGES.length]
  const clipMinimum = 420 + ((seed >>> 19) % 4) * 90
  const clipMaximum = clipMinimum + 1250
  const expectedCorner = cornerOrder[stamps.length]
  const clippedCorners = positions.map(getCorner).filter((corner): corner is Corner => corner !== null)
  const hintsUsed = state.entry?.hints_used ?? 0
  const solved = Boolean(state.round?.solved_at)

  const markAction = useCallback((blank: boolean) => {
    setLastAction(Date.now())
    setLastInputBlank(blank)
    setPointerBlank(blank)
  }, [])

  useEffect(() => {
    const snapshot: SavedPuzzleState = {
      seed, phase, pollution, centerTouched, centerProof, edgeProof,
      stamps, inputProof, frameProof, foldProgress,
    }
    localStorage.setItem(storageKey, JSON.stringify(snapshot))
  }, [storageKey, seed, phase, pollution, centerTouched, centerProof, edgeProof, stamps, inputProof, frameProof, foldProgress])

  useEffect(() => {
    if (!pointerBlank) return
    let interval: number | null = null
    const delay = window.setTimeout(() => {
      interval = window.setInterval(() => {
        setPollution((value) => Math.max(0, Number((value - .16).toFixed(2))))
      }, 100)
    }, 1200)
    return () => {
      window.clearTimeout(delay)
      if (interval) window.clearInterval(interval)
    }
  }, [pointerBlank, lastAction])

  useEffect(() => {
    if (pollution !== 0 || !centerSuppressedEdge) return
    if (phase === 1 && centerTouched && !centerProof) {
      setCenterProof(true)
      setCenterSuppressedEdge(false)
      setPhase(2)
      sound('proof')
    }
  }, [pollution, centerSuppressedEdge, phase, centerTouched, centerProof])

  useEffect(() => {
    if (phase !== 2 || !memoryCycle || pollution !== 0 || !centerSuppressedEdge || !pointerBlank || edgeProof) return
    const stable = window.setTimeout(() => {
      setEdgeProof(true)
      setCenterSuppressedEdge(false)
      setPhase(3)
      sound('cool')
    }, 900)
    return () => window.clearTimeout(stable)
  }, [phase, memoryCycle, pollution, centerSuppressedEdge, pointerBlank, edgeProof])

  useEffect(() => {
    if (phase !== 3) return
    const timer = window.setInterval(() => {
      positions.forEach((position, id) => {
        const corner = getCorner(position)
        const enteredAt = clippedSince.current.get(id)
        if (!corner || !enteredAt || Date.now() - enteredAt <= clipMaximum) return
        clippedSince.current.delete(id)
        setRottenCorners((current) => current.includes(corner) ? current : [...current, corner])
        setStamps((current) => current.filter((item) => item !== corner))
        sound('warning')
      })
    }, 120)
    return () => window.clearInterval(timer)
  }, [phase, positions, clipMaximum])

  useEffect(() => {
    if (!cursorFocused) { setCursorDark(false); return }
    const update = () => setCursorDark((Date.now() - focusStartedAt.current) % cursorPeriod > cursorPeriod * .52)
    update()
    const timer = window.setInterval(update, 40)
    return () => window.clearInterval(timer)
  }, [cursorFocused, cursorPeriod])

  useEffect(() => {
    if (phase === 3 && stamps.length === 4) {
      const timer = window.setTimeout(() => { setPhase(4); sound('proof') }, 700)
      return () => window.clearTimeout(timer)
    }
  }, [phase, stamps.length])

  useEffect(() => {
    if (!typedPulse) return
    const timer = window.setTimeout(() => setTypedPulse(0), 520)
    return () => window.clearTimeout(timer)
  }, [typedPulse])

  const allMothsInside = positions.every((position) => getCorner(position) === null)
  const proof = useMemo<InteractiveProof>(() => ({
    pollution_zero: pollution === 0,
    center_false_scar: centerProof,
    edge_memory_trace: edgeProof,
    four_moth_stamps: stamps.length === 4,
    moths_clear_of_corners: allMothsInside,
    cursor_gone: !cursorFocused,
    input_refusal_trace: inputProof,
    frame_not_closed: foldProgress >= 84 && foldProgress <= 91.5,
    frame_gap_trace: frameProof,
    last_input_blank: lastInputBlank,
    idle_complete: true,
  }), [pollution, centerProof, edgeProof, stamps.length, allMothsInside, cursorFocused, inputProof, foldProgress, frameProof, lastInputBlank])
  const proofReady = Object.values(proof).every(Boolean) && phase === 5 && !frameFailure

  useEffect(() => {
    if (!proofReady || completed.current || solved) return
    const silence = window.setTimeout(() => {
      setSuccess(true)
      sound('success')
      successRef.current = window.setTimeout(() => {
        completed.current = true
        void onComplete(proof)
      }, 2600)
    }, 4500)
    return () => {
      window.clearTimeout(silence)
      if (successRef.current) window.clearTimeout(successRef.current)
    }
  }, [proofReady, solved, lastAction, onComplete, proof])

  const touchCenter = (event: ReactPointerEvent) => {
    event.stopPropagation()
    if (phase > 2) return
    markAction(false)
    setCenterTouched(true)
    setCenterSuppressedEdge(true)
    if (phase === 2) setMemoryCycle(true)
    setPollution((value) => Math.min(5, value + 1.25))
    sound('crack')
  }

  const finishCornerPass = (corner: Corner, duration: number) => {
    if (duration < clipMinimum || duration > clipMaximum || corner !== expectedCorner) return
    setStamps((current) => current.includes(corner) ? current : [...current, corner])
    setRottenCorners((current) => current.filter((item) => item !== corner))
    sound('stamp')
  }

  const moveMoth = (event: ReactPointerEvent) => {
    if (!dragging || !stageRef.current) return
    const bounds = stageRef.current.getBoundingClientRect()
    const point = {
      x: clamp(((event.clientX - bounds.left) / bounds.width) * 100, -1, 101),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * 100, -2, 102),
    }
    setPositions((current) => current.map((position, index) => index === dragging.id ? point : position))
    const corner = getCorner(point)
    if (corner !== dragging.corner) {
      if (dragging.corner && !corner) {
        finishCornerPass(dragging.corner, Date.now() - dragging.enteredAt)
        clippedSince.current.delete(dragging.id)
      }
      if (corner) clippedSince.current.set(dragging.id, Date.now())
      setDragging({ id: dragging.id, corner, enteredAt: corner ? Date.now() : 0 })
    }
    markAction(false)
  }

  const startMothDrag = (id: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (phase !== 3) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const corner = getCorner(positions[id])
    if (corner && !clippedSince.current.has(id)) clippedSince.current.set(id, Date.now())
    setDragging({ id, corner, enteredAt: corner ? clippedSince.current.get(id)! : 0 })
    markAction(false)
  }

  const endMothDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setDragging(null)
    markAction(false)
  }

  const focusMouth = () => {
    if (phase !== 4) return
    focusStartedAt.current = Date.now()
    typedDuringFocus.current = false
    setCursorFocused(true)
    markAction(false)
  }

  const typeIntoMouth = (event: ChangeEvent<HTMLInputElement>) => {
    const count = event.target.value.length
    if (!count) return
    typedDuringFocus.current = true
    setTypedPulse((value) => value + count)
    setPollution((value) => Math.min(5, value + count * .55))
    setInputProof(false)
    event.target.value = ''
    markAction(false)
    sound('type')
  }

  const tryBreakFocus = () => {
    if (phase !== 4 || !cursorFocused) return false
    inputRef.current?.blur()
    setCursorFocused(false)
    if (!typedDuringFocus.current && cursorDark && pollution === 0) {
      setInputProof(true)
      setPhase(5)
      sound('proof')
    }
    return true
  }

  const setFrame = (nextValue: number) => {
    const next = clamp(nextValue, 18, 100)
    if (next >= 92) setNearClosedSeen(true)
    if (next >= 99) {
      setFrameFailure(true)
      setFrameProof(false)
      setPollution((value) => Math.min(5, value + 2.5))
      sound('warning')
      window.setTimeout(() => {
        setFoldProgress(58)
        setNearClosedSeen(false)
        setFrameFailure(false)
      }, 900)
      return
    }
    if (nearClosedSeen && next >= 84 && next <= 91.5) {
      setFrameProof(true)
      sound('proof')
    } else if (frameProof && (next < 84 || next > 91.5)) {
      setFrameProof(false)
    }
    setFoldProgress(next)
  }

  const stagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget && !(event.target as HTMLElement).classList.contains('gf-passive')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (tryBreakFocus()) { markAction(true); return }
    if (phase === 5) frameDrag.current = { y: event.clientY, progress: foldProgress }
    markAction(true)
  }

  const stagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stageRef.current) {
      const bounds = stageRef.current.getBoundingClientRect()
      stageRef.current.style.setProperty('--dust-x', `${(((event.clientX - bounds.left) / bounds.width) - .5) * -12}px`)
      stageRef.current.style.setProperty('--dust-y', `${(((event.clientY - bounds.top) / bounds.height) - .5) * -9}px`)
    }
    if (dragging) { moveMoth(event); return }
    if (!activePointers.current.has(event.pointerId)) {
      const blank = event.target === event.currentTarget || (event.target as HTMLElement).classList.contains('gf-passive')
      if (blank && !pointerBlank) markAction(true)
      else if (!blank && pointerBlank) setPointerBlank(false)
      return
    }
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = [...activePointers.current.values()]
    if (phase === 5 && points.length === 2) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      if (lastPinchDistance.current !== null) setFrame(foldProgress + (lastPinchDistance.current - distance) * .11)
      lastPinchDistance.current = distance
    } else if (phase === 5 && frameDrag.current) {
      setFrame(frameDrag.current.progress + (frameDrag.current.y - event.clientY) * .13)
    }
    markAction(true)
  }

  const stagePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(event.pointerId)
    if (activePointers.current.size < 2) lastPinchDistance.current = null
    frameDrag.current = null
    const blank = event.target === event.currentTarget || (event.target as HTMLElement).classList.contains('gf-passive')
    if (blank) markAction(true)
  }

  const stageWheel = (event: WheelEvent<HTMLDivElement>) => {
    stageRef.current?.style.setProperty('--wheel-y', `${clamp(event.deltaY / 600, -1, 1) * 8}px`)
    if (phase !== 5) return
    setFrame(foldProgress + event.deltaY * .035)
    markAction(true)
  }

  const buyHint = async () => {
    const error = await onBuyHint()
    setHintMessage(error ?? null)
  }

  const resetPuzzle = () => {
    const nextSeed = crypto.getRandomValues(new Uint32Array(1))[0]
    if (successRef.current) window.clearTimeout(successRef.current)
    inputRef.current?.blur()
    activePointers.current.clear()
    lastPinchDistance.current = null
    frameDrag.current = null
    focusStartedAt.current = 0
    typedDuringFocus.current = false
    completed.current = false
    setSeed(nextSeed)
    setPhase(1)
    setPollution(0)
    setCenterTouched(false)
    setCenterSuppressedEdge(false)
    setCenterProof(false)
    setMemoryCycle(false)
    setEdgeProof(false)
    setPositions(INITIAL_MOTHS.map((position) => ({ ...position })))
    setDragging(null)
    clippedSince.current.clear()
    setStamps([])
    setRottenCorners([])
    setCursorFocused(false)
    setCursorDark(false)
    setTypedPulse(0)
    setInputProof(false)
    setFoldProgress(24)
    setNearClosedSeen(false)
    setFrameProof(false)
    setFrameFailure(false)
    setPointerBlank(false)
    setLastInputBlank(false)
    setLastAction(Date.now())
    setSuccess(false)
    setHintOpen(false)
    setResetOpen(false)
    setHintMessage(null)
    sound('cool')
  }

  const pollutionLevel = Math.ceil(pollution)
  const expectedEdgeClass = phase === 2 && !edgeProof ? `memory-${memoryEdge}` : ''
  const frameInset = 31 - foldProgress * .27

  return (
    <main className={`glassless-case phase-${phase} pollution-${pollutionLevel} ${typedPulse ? 'typed-flash' : ''} ${cursorDark ? 'cursor-dark' : ''} ${success ? 'is-success' : ''} ${frameFailure ? 'frame-failed' : ''}`}
      style={{
        '--pollution': pollution,
        '--cursor-period': `${cursorPeriod}ms`,
        '--stain-opacity': Math.max(.12, .72 - pollution * .115),
        '--light-opacity': pollution * .18,
        '--crack-opacity': pollution * .22,
        '--pollution-glow': `${pollution * 18}px`,
        '--frame-inset': `${frameInset}%`,
        '--warning-opacity': clamp((foldProgress - 84) / 15, 0, 1),
        '--gap-opacity': frameProof ? 1 : 0,
      } as CSSProperties}>
      <button className='gf-exit' onClick={onBack} aria-label='사건 목록으로 돌아가기'>←</button>
      <button className='gf-reset-button' onClick={() => setResetOpen(true)} aria-label='처음부터 다시 시작'>↺</button>
      <button className='gf-hint-button' onClick={() => setHintOpen(true)} aria-label='힌트 보관함'>?</button>

      <div ref={stageRef} className={`gf-stage warning-${warningEdge} hole-${holeDirection} gap-${gapEdge} ${expectedEdgeClass}`}
        onPointerDown={stagePointerDown} onPointerMove={stagePointerMove} onPointerUp={stagePointerUp}
        onPointerCancel={stagePointerUp} onWheel={stageWheel}>
        <div className='gf-passive gf-paper' />
        <div className='gf-passive gf-dust'>{Array.from({ length: 34 }, (_, index) => <i key={index} style={{
          '--x': `${(index * 37) % 97}%`, '--y': `${8 + (index * 53) % 84}%`,
          '--o': .08 + (index % 5) * .035, '--d': `${7 + index % 7}s`,
        } as CSSProperties} />)}</div>
        <div className='gf-passive gf-folds'><i /><i /><i /><i /></div>

        {EDGES.map((edge) => (
          <div key={edge} className={`gf-passive gf-stain stain-${edge} ${centerProof && edge === memoryEdge ? 'has-center-scar' : ''} ${edgeProof && edge === memoryEdge ? 'has-memory' : ''} ${phase === 2 && memoryCycle && pollution > 0 && edge === memoryEdge ? 'is-killed' : ''} ${clippedCorners.some((corner) => corner.includes(edge === 'top' ? 'n' : edge === 'bottom' ? 's' : edge === 'left' ? 'w' : 'e')) ? 'has-clipped-moth' : ''} ${rottenCorners.some((corner) => corner.includes(edge === 'top' ? 'n' : edge === 'bottom' ? 's' : edge === 'left' ? 'w' : 'e')) ? 'is-rotten' : ''}`}><i /></div>
        ))}
        {CORNERS.map((corner) => (
          <div key={corner} className={`gf-passive gf-corner corner-${corner} ${stamps.includes(corner) ? 'has-stamp' : ''} ${rottenCorners.includes(corner) ? 'is-rotten' : ''} ${expectedCorner === corner && phase === 3 ? 'is-next' : ''}`}><i /></div>
        ))}

        <button className={`gf-glass ${centerProof ? 'is-disproved' : ''} ${inputProof ? 'has-void' : ''}`}
          onPointerDown={touchCenter} onPointerUp={(event) => event.stopPropagation()}
          onPointerCancel={(event) => event.stopPropagation()} aria-label='검은 유리판'>
          <span className='gf-glass-shadow' /><span className='gf-light' /><span className='gf-cracks' />
        </button>

        {positions.map((position, index) => (
          <button key={index} className={`gf-moth moth-${index} ${dragging?.id === index ? 'is-dragging' : ''} ${getCorner(position) ? 'is-clipped' : ''}`}
            style={{ left: `${position.x}%`, top: `${position.y}%`, '--moth-delay': `${index * -390}ms`, '--moth-line-x': `${35 + index * 5}%` } as CSSProperties}
            onPointerDown={(event) => startMothDrag(index, event)} onPointerUp={endMothDrag}
            aria-label={`나방 ${index + 1}`}>
            <i className='wing left' /><i className='body' /><i className='wing right' />
          </button>
        ))}

        {phase === 4 && (
          <div className={`gf-mouth ${cursorFocused ? 'is-focused' : ''} ${cursorDark ? 'is-dark' : ''} ${typedPulse ? 'typed' : ''}`}>
            <input ref={inputRef} className='gf-mouth-input' aria-label='유리 안의 빈 입력 공간'
              autoComplete='off' autoCapitalize='off' spellCheck={false} onFocus={focusMouth}
              onBlur={() => setCursorFocused(false)} onChange={typeIntoMouth} />
            <i className='gf-caret' />
          </div>
        )}

        {phase === 5 && <div className='gf-passive gf-frame'><i className='rail top' /><i className='rail right' /><i className='rail bottom' /><i className='rail left' /><i className='proof-gap' /></div>}
        <div className='gf-passive gf-success-folds'><i /><i /><i /><i /></div>
      </div>

      {hintOpen && (
        <aside className='gf-hints' aria-label='힌트 보관함'>
          <button className='gf-hints-close' onClick={() => setHintOpen(false)} aria-label='닫기'>×</button>
          <small>{puzzle.code}</small><h2>관찰 기록</h2>
          <div>{puzzle.hints.slice(0, hintsUsed).map((hint, index) => <p key={hint}><b>{index + 1}</b>{hint}</p>)}
            {hintsUsed === 0 && <p className='gf-empty-hint'>아직 남겨진 기록이 없습니다.</p>}</div>
          <button className='secondary-button' disabled={busy || solved || hintsUsed >= 10} onClick={buyHint}>다음 기록 · 50 P</button>
          {hintMessage && <p className='gf-hint-error'>{hintMessage}</p>}
        </aside>
      )}
      {resetOpen && (
        <aside className='gf-reset-confirm' role='dialog' aria-modal='true' aria-label='처음부터 다시 시작'>
          <small>RESET OBSERVATION</small>
          <h2>처음부터 다시 시작할까요?</h2>
          <p>현재 세션의 오염, 증명 흔적, 나방 위치와 액자 상태가 모두 지워집니다.</p>
          <div>
            <button className='secondary-button' onClick={() => setResetOpen(false)}>취소</button>
            <button className='primary-button' onClick={resetPuzzle}>다시 시작</button>
          </div>
        </aside>
      )}
      {(busy || solved) && <div className='gf-server-state'>{busy ? '흔적을 확인하는 중…' : '액자에는 끝내 유리가 남지 않았다.'}</div>}
    </main>
  )
}
