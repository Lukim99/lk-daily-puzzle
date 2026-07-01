import { type FormEvent, useEffect, useState } from 'react'
import type { Puzzle } from '../data/puzzles'
import type { GameState, SubmitResult } from '../lib/game'
import { Modal } from './Modal'

interface GameRoomProps {
  state: GameState
  puzzle: Puzzle
  busy: boolean
  onBack: () => void
  onBuyHint: () => Promise<string | null>
  onSubmit: (answer: string) => Promise<SubmitResult | null>
}

export function GameRoom({ state, puzzle, busy, onBack, onBuyHint, onSubmit }: GameRoomProps) {
  const [activeClue, setActiveClue] = useState(0)
  const [answer, setAnswer] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmHint, setConfirmHint] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const hintsUsed = state.entry?.hints_used ?? 0
  const solved = Boolean(state.round?.solved_at)

  useEffect(() => {
    if (solved) setConfirmHint(false)
  }, [solved])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!answer.trim()) return
    const result = await onSubmit(answer)
    if (!result) return
    if (!result.correct) setMessage('정답이 아닙니다. 단서를 다시 조합해 보세요.')
    else if (result.first_solver) setMessage('최초 해결 성공! ' + result.awarded_points?.toLocaleString() + 'P를 획득했습니다.')
    else setMessage('사건 해결 성공! 최초 정답 상금은 이미 지급되었습니다.')
  }

  const buyHint = async () => {
    const error = await onBuyHint()
    setConfirmHint(false)
    setMessage(error ?? '새 힌트가 해제되었습니다.')
  }

  return (
    <main className='game-room'>
      <header className='game-topbar'>
        <button className='back-button' onClick={onBack}>← <span>사건 목록</span></button>
        <div className='game-title'><small>{puzzle.code}</small><strong>{puzzle.title}</strong></div>
        <div className='game-points'>{state.profile?.balance.toLocaleString()} P</div>
      </header>

      <section className='game-layout'>
        <aside className='case-file puzzle-cut'>
          <p className='eyebrow'>CASE BRIEFING</p>
          <h2>{puzzle.title}</h2>
          <p>{puzzle.briefing}</p>
          <dl>
            <div><dt>난이도</dt><dd>◆◆◆◆◆</dd></div>
            <div><dt>정답 형식</dt><dd>{puzzle.answerFormat}</dd></div>
            <div><dt>해제한 힌트</dt><dd>{hintsUsed} / 10</dd></div>
          </dl>
        </aside>

        <section className='investigation-board puzzle-cut'>
          <div className='board-tabs' role='tablist'>
            {puzzle.clues.map((clue, index) => (
              <button key={clue.label} role='tab' aria-selected={activeClue === index}
                onClick={() => setActiveClue(index)}>
                단서 {String(index + 1).padStart(2, '0')}
              </button>
            ))}
          </div>
          <article className='clue-sheet'>
            <span className='clue-stamp'>EVIDENCE {activeClue + 1}</span>
            <h3>{puzzle.clues[activeClue].label}</h3>
            <p>{puzzle.clues[activeClue].content}</p>
            <div className='cipher-line' aria-hidden='true'>◇ — ◆ · ◇ — ◇ · ◆</div>
          </article>
          <label className='notes-label'>추리 메모
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)}
              placeholder='단서의 관계를 자유롭게 기록하세요.' />
          </label>
        </section>
        <aside className='solve-panel'>
          <section className='hint-panel puzzle-cut'>
            <div className='section-title'><span>힌트 보관함</span><small>{hintsUsed}/10 OPEN</small></div>
            <div className='unlocked-hints'>
              {puzzle.hints.slice(0, hintsUsed).map((hint, index) => (
                <p key={hint}><b>{index + 1}</b>{hint}</p>
              ))}
              {hintsUsed === 0 && <p className='empty-hint'>아직 해제한 힌트가 없습니다.</p>}
            </div>
            <button className='secondary-button' onClick={() => setConfirmHint(true)}
              disabled={busy || solved || hintsUsed >= 10}>
              {solved ? '힌트 판매 종료' : '다음 힌트 해제 · 50 P'}
            </button>
          </section>
          <form className='answer-panel puzzle-cut' onSubmit={submit}>
            <p className='eyebrow'>FINAL ANSWER</p>
            <label htmlFor='answer'>사건의 해답</label>
            <input id='answer' value={answer} onChange={(event) => setAnswer(event.target.value)}
              placeholder={puzzle.answerFormat} autoComplete='off' />
            <button className='primary-button' disabled={busy || !answer.trim()}>
              {busy ? '검증 중...' : '정답 제출'}
            </button>
            {message && <p className='result-message' role='status'>{message}</p>}
          </form>
        </aside>
      </section>

      {confirmHint && (
        <Modal eyebrow='HINT UNLOCK' title={'힌트 ' + (hintsUsed + 1) + '을 해제할까요?'}
          onClose={() => setConfirmHint(false)}>
          <p className='modal-copy'>50P가 즉시 차감되고 오늘의 상금 풀에 합산됩니다. 해제한 힌트는 되돌릴 수 없습니다.</p>
          <div className='modal-actions'>
            <button className='secondary-button' onClick={() => setConfirmHint(false)}>취소</button>
            <button className='primary-button' onClick={buyHint} disabled={busy || solved}>50P 지불</button>
          </div>
        </Modal>
      )}
    </main>
  )
}
