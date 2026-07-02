import type { GameState } from '../lib/game'
import type { Puzzle } from '../data/puzzles'

interface DashboardProps {
  state: GameState
  puzzle: Puzzle
  busy: boolean
  onEnter: () => void
  onLogout: () => void
}

const points = new Intl.NumberFormat('ko-KR')

export function Dashboard({ state, puzzle, busy, onEnter, onLogout }: DashboardProps) {
  const profile = state.profile!
  const round = state.round!
  const hasEntry = Boolean(state.entry)
  const solved = Boolean(round.solved_at)

  return (
    <main className='dashboard'>
      <header className='topbar'>
        <div className='wordmark'><span className='mini-piece'>◆</span> 데일리퍼즐</div>
        <div className='user-area'>
          <div className='balance'><small>MY POINT</small><strong>{points.format(profile.balance)} P</strong></div>
          <button className='profile-button' onClick={onLogout} aria-label='로그아웃'>{profile.nickname.slice(0, 1)}</button>
        </div>
      </header>

      <section className='dashboard-grid'>
        <article className='today-card puzzle-cut'>
          <div className='today-head'>
            <span className='live-dot'>{solved ? 'SOLVED' : 'LIVE'}</span>
            <span>{round.play_date.replaceAll('-', '.')}</span>
          </div>
          <p className='eyebrow'>{puzzle.code}</p>
          <h1>{puzzle.title}</h1>
          <p className='subtitle'>{puzzle.subtitle}</p>
          <div className='clue-preview' aria-hidden='true'>
            <span>03</span><span>?</span><span>14</span><span>∴</span><span>59</span>
          </div>
          <button className='primary-button enter-button' onClick={onEnter} disabled={busy}>
            {busy ? '처리 중...' : hasEntry ? '퍼즐 계속하기' : solved ? '무료로 입장' : '100 P 지불하고 입장'}
            <span>→</span>
          </button>
          <p className='entry-note'>
            {hasEntry
              ? '오늘 입장권 보유 중'
              : solved
                ? '최초 정답자가 나와 무료로 입장할 수 있습니다.'
                : '입장료 전액이 오늘의 상금 풀에 합산됩니다.'}
          </p>
        </article>

        <aside className='side-stack'>
          <section className='prize-card puzzle-cut'>
            <p className='eyebrow'>TODAY&apos;S PRIZE POOL</p>
            <strong>{points.format(round.prize_pool)}<small>P</small></strong>
            <div className='prize-meter'><i /></div>
            {solved
              ? <p><b>{round.winner_nickname}</b> 님이 최초로 해결했습니다.</p>
              : <p>최초 정답자에게 현재 풀의 <b>90%</b> 지급</p>}
          </section>
          <section className='rules-card puzzle-cut'>
            <div className='section-title'><span>게임 규칙</span><small>HOW TO PLAY</small></div>
            <ol>
              <li><b>01</b><span>100P를 내고 오늘의 사건에 입장</span></li>
              <li><b>02</b><span>필요하면 50P로 단계별 힌트 해제</span></li>
              <li><b>03</b><span>최초 정답자가 누적 상금 90% 획득</span></li>
            </ol>
          </section>
        </aside>
      </section>
    </main>
  )
}
