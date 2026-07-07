import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/game'
import {
  legalTargets, winningLine, makelineApi, type MakeLineGame,
} from '../lib/makeline'

interface MakeLineRoomProps {
  userId: string
  onExit: () => void
}

// 게임 진행 단계 순위 — 역행(오래된 이벤트)을 걸러내는 데 쓴다.
const PHASE_RANK: Record<MakeLineGame['status'], number> = {
  waiting: 0, betting: 1, playing: 2, finished: 3,
}

export function MakeLineRoom({ userId, onExit }: MakeLineRoomProps) {
  const [game, setGame] = useState<MakeLineGame | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [searching, setSearching] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [betInput, setBetInput] = useState('')
  const leavingRef = useRef(false)

  // 실시간 이벤트는 순서가 뒤바뀌거나 누락될 수 있으므로, updated_at 기준으로 최신만 반영한다.
  const applyGame = useCallback((next: MakeLineGame | null) => {
    if (!next) return
    setGame((prev) => {
      if (!prev || prev.id !== next.id) return next
      if (prev.status === 'finished') return prev                       // 종료는 최종 상태
      if (PHASE_RANK[next.status] < PHASE_RANK[prev.status]) return prev // 단계 역행 무시
      if (Date.parse(next.updated_at) <= Date.parse(prev.updated_at)) return prev // 오래된/동일 갱신 무시
      return next
    })
  }, [])

  const startSearch = useCallback(async () => {
    setSearching(true)
    setError(null)
    setSelected(null)
    setGame(null)
    try {
      const next = await makelineApi.findOrCreate()
      setGame(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : '매칭에 실패했습니다.')
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    void startSearch()
  }, [startSearch])

  // 실시간 동기화: 내 게임 행을 구독하고, 구독 성립·복귀 시 권위 상태를 다시 읽는다.
  useEffect(() => {
    if (!game?.id) return
    const id = game.id
    const refetch = async () => {
      try { applyGame(await makelineApi.get(id)) } catch { /* 재시도는 폴링이 담당 */ }
    }
    const channel = supabase
      .channel('makeline-' + id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'makeline_games', filter: 'id=eq.' + id },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          applyGame(payload.new as MakeLineGame)
        },
      )
      .subscribe((status) => { if (status === 'SUBSCRIBED') void refetch() })
    const onVisible = () => { if (document.visibilityState === 'visible') void refetch() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [game?.id, applyGame])

  // 상대를 기다리는 동안(매칭 대기 또는 상대 차례)에는 실시간 누락에 대비해 주기적으로 재확인한다.
  useEffect(() => {
    if (!game) return
    const myC: 'B' | 'W' = game.black_player === userId ? 'B' : 'W'
    const waitingForOpponent =
      game.status === 'waiting' || game.status === 'betting' ||
      (game.status === 'playing' && game.turn !== myC)
    if (!waitingForOpponent) return
    const id = game.id
    const timer = window.setInterval(() => {
      makelineApi.get(id).then(applyGame).catch(() => { /* 무시 */ })
    }, 3500)
    return () => window.clearInterval(timer)
  }, [game?.id, game?.status, game?.turn, userId, applyGame, game])

  // 판이 바뀌면 선택을 해제한다.
  useEffect(() => { setSelected(null) }, [game?.board, game?.status])

  const myColor: 'B' | 'W' = game && game.black_player === userId ? 'B' : 'W'
  const isMyTurn = Boolean(game && game.status === 'playing' && game.turn === myColor)
  const targets = game && selected !== null
    ? legalTargets(game.board, selected, myColor, game.history)
    : []
  const winLine = game && game.status === 'finished' && game.win_reason === 'line' && game.winner
    ? winningLine(game.board, game.winner)
    : null

  const cellClick = async (index: number) => {
    if (!game || !isMyTurn || busy) return
    if (selected !== null && targets.includes(index)) {
      const from = selected
      setBusy(true)
      setError(null)
      try {
        const next = await makelineApi.move(game.id, from, index)
        applyGame(next)
      } catch (err) {
        setError(err instanceof Error ? err.message : '둘 수 없는 수입니다.')
      } finally {
        setBusy(false)
      }
      return
    }
    if (game.board[index] === myColor) {
      setSelected((current) => (current === index ? null : index))
    } else {
      setSelected(null)
    }
  }

  const leave = async () => {
    if (leavingRef.current) return
    leavingRef.current = true
    try {
      if (game && game.status !== 'finished') await makelineApi.leave(game.id)
    } catch {
      // 나가기는 실패해도 화면은 닫는다.
    }
    onExit()
  }

  const runBet = async (fn: () => Promise<MakeLineGame>): Promise<boolean> => {
    if (!game || busy) return false
    setBusy(true)
    setError(null)
    try {
      applyGame(await fn())
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청을 처리하지 못했습니다.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const doAnte = (want: boolean) => { if (game) void runBet(() => makelineApi.ante(game.id, want)) }
  const doAccept = () => { if (game) void runBet(() => makelineApi.bet(game.id, true, null)) }
  const doPropose = async () => {
    if (!game) return
    const amount = Math.floor(Number(betInput))
    if (!betInput || !Number.isFinite(amount) || amount < 1 || amount > game.max_bet) {
      setError('1 P 이상, 최대 ' + game.max_bet.toLocaleString() + ' P까지 제안할 수 있습니다.')
      return
    }
    if (await runBet(() => makelineApi.bet(game.id, false, amount))) setBetInput('')
  }

  const statusLine = () => {
    if (!game) return ''
    if (game.status === 'waiting') return '상대를 기다리는 중…'
    if (game.status === 'finished') {
      const won = game.winner === myColor
      const reason = game.win_reason === 'forfeit'
        ? (won ? '상대가 나갔습니다' : '기권했습니다')
        : game.win_reason === 'stuck'
          ? (won ? '상대가 둘 수 없게 되었습니다' : '둘 수 있는 수가 없습니다')
          : (won ? '한 줄을 완성했습니다' : '상대가 한 줄을 완성했습니다')
      return `${won ? '승리' : '패배'} · ${reason}`
    }
    return isMyTurn ? '내 차례입니다' : '상대의 차례입니다'
  }

  return (
    <main className="ml-room">
      <header className="ml-topbar">
        <button className="ml-exit" onClick={leave} aria-label="나가기">←</button>
        <div className="ml-wordmark">◆ 메이크라인</div>
        <div className="ml-spacer" />
      </header>

      {searching && !game && (
        <section className="ml-center">
          <div className="ml-spinner" />
          <p>상대를 찾는 중…</p>
        </section>
      )}

      {game && (
        <section className="ml-stage">
          <div className="ml-players">
            <span className={`ml-tag ${game.turn === 'B' && game.status === 'playing' ? 'is-active' : ''}`}>
              <i className="ml-dot stone-B" /> {game.black_nickname ?? '흑'}
              {myColor === 'B' && ' (나)'}
            </span>
            <span className="ml-vs">VS</span>
            <span className={`ml-tag ${game.turn === 'W' && game.status === 'playing' ? 'is-active' : ''}`}>
              <i className="ml-dot stone-W" /> {game.white_nickname ?? '백'}
              {myColor === 'W' && ' (나)'}
            </span>
          </div>

          {game.status === 'betting' ? (
            <div className="ml-betting">
              {game.bet_turn === null ? (
                <>
                  <p className="ml-bet-title">이번 판, 포인트를 걸까요?</p>
                  {(myColor === 'B' ? game.ante_black : game.ante_white) === null ? (
                    <div className="ml-actions">
                      <button className="ml-primary" disabled={busy} onClick={() => doAnte(true)}>포인트 걸기</button>
                      <button className="ml-secondary" disabled={busy} onClick={() => doAnte(false)}>그냥 하기</button>
                    </div>
                  ) : (
                    <p className="ml-bet-wait">상대의 응답을 기다리는 중…</p>
                  )}
                  <p className="ml-bet-hint">양쪽 모두 수락해야 판돈을 겁니다. (최대 {game.max_bet.toLocaleString()} P)</p>
                </>
              ) : (
                <>
                  <p className="ml-bet-title">판돈 협상 <small>최대 {game.max_bet.toLocaleString()} P</small></p>
                  {game.bet_proposal !== null && (
                    <p className="ml-bet-proposal">
                      {game.bet_turn === myColor ? '상대 제안' : '내 제안'}
                      <b>{game.bet_proposal.toLocaleString()} P</b>
                    </p>
                  )}
                  {game.bet_turn === myColor ? (
                    <div className="ml-bet-form">
                      {game.bet_proposal !== null && (
                        <button className="ml-primary" disabled={busy} onClick={doAccept}>수락하고 시작</button>
                      )}
                      <div className="ml-bet-input-row">
                        <input
                          type="number" min={1} max={game.max_bet} inputMode="numeric"
                          value={betInput} onChange={(e) => setBetInput(e.target.value)}
                          placeholder={game.bet_proposal !== null ? '새 금액' : '금액 입력'}
                        />
                        <button className="ml-secondary" disabled={busy} onClick={() => void doPropose()}>
                          {game.bet_proposal !== null ? '거절하고 제안' : '제안'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="ml-bet-wait">
                      {game.bet_proposal !== null ? '상대의 응답을 기다리는 중…' : '상대의 제안을 기다리는 중…'}
                    </p>
                  )}
                </>
              )}
              <button className="ml-secondary ml-bet-leave" onClick={leave}>나가기</button>
            </div>
          ) : (
            <>
          {game.bet > 0 && <p className="ml-bet-badge">판돈 {game.bet.toLocaleString()} P</p>}
          <p className={`ml-status ${game.status === 'finished' ? (game.winner === myColor ? 'is-win' : 'is-lose') : ''}`}>
            {statusLine()}
          </p>

          <div className={`ml-board ${isMyTurn ? 'is-my-turn' : ''}`} aria-label="게임판">
            {game.board.split('').map((cell, index) => {
              const isMine = cell === myColor
              const isSelected = selected === index
              const isTarget = targets.includes(index)
              const inWin = winLine?.includes(index)
              return (
                <button
                  key={index}
                  className={`ml-cell${isTarget ? ' is-target' : ''}${isSelected ? ' is-selected' : ''}${inWin ? ' is-win' : ''}`}
                  onClick={() => void cellClick(index)}
                  disabled={game.status !== 'playing' || busy}
                  aria-label={`${index + 1}번 칸`}
                >
                  {cell !== '.' && (
                    <span className={`ml-stone stone-${cell}${isMine && isMyTurn ? ' is-movable' : ''}`} />
                  )}
                  {isTarget && <span className="ml-target-dot" />}
                </button>
              )
            })}
          </div>

          <div className="ml-actions">
            {game.status === 'waiting' && (
              <button className="ml-secondary" onClick={leave}>매칭 취소</button>
            )}
            {game.status === 'finished' && (
              <>
                <button className="ml-primary" onClick={() => void startSearch()} disabled={searching}>
                  {searching ? '매칭 중…' : '새 게임'}
                </button>
                <button className="ml-secondary" onClick={onExit}>나가기</button>
              </>
            )}
            {game.status === 'playing' && (
              <button className="ml-secondary" onClick={leave}>기권</button>
            )}
          </div>
            </>
          )}

          <details className="ml-rules">
            <summary>규칙 보기</summary>
            <ol>
              <li>자기 돌 하나를 상하좌우 한 칸 옮긴다.</li>
              <li>빈 칸으로 이동하거나, 상대 돌 칸으로 이동하면 서로 자리를 바꾼다.</li>
              <li>자기 돌이 있는 칸으로는 이동할 수 없다.</li>
              <li>착수 후 자기 돌 3개가 한 줄이면 즉시 승리한다.</li>
              <li>이전에 한 번이라도 나온 판 모양은 다시 만들 수 없다.</li>
              <li>자기 차례에 둘 수 있는 수가 없으면 패배한다.</li>
            </ol>
          </details>
        </section>
      )}

      {error && <div className="ml-toast" role="alert">{error}<button onClick={() => setError(null)}>×</button></div>}
    </main>
  )
}
