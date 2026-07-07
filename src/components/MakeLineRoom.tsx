import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/game'
import {
  legalTargets, winningLine, makelineApi, type MakeLineGame,
} from '../lib/makeline'

interface MakeLineRoomProps {
  userId: string
  onExit: () => void
}

export function MakeLineRoom({ userId, onExit }: MakeLineRoomProps) {
  const [game, setGame] = useState<MakeLineGame | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [searching, setSearching] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const leavingRef = useRef(false)

  const startSearch = useCallback(async () => {
    setSearching(true)
    setError(null)
    setSelected(null)
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

  // 실시간 동기화: 내 게임 행의 변경을 구독한다.
  useEffect(() => {
    if (!game?.id) return
    const id = game.id
    const channel = supabase
      .channel('makeline-' + id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'makeline_games', filter: 'id=eq.' + id },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          setGame(payload.new as MakeLineGame)
        },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [game?.id])

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
        setGame(next)
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
    <main className={`ml-room${myColor === 'W' ? ' ml-flip' : ''}`}>
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
