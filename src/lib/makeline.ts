import { supabase } from './game'

export type Cell = 'B' | 'W' | '.'

export interface MakeLineGame {
  id: string
  black_player: string
  white_player: string | null
  board: string
  turn: 'B' | 'W'
  status: 'waiting' | 'betting' | 'playing' | 'finished'
  winner: 'B' | 'W' | null
  win_reason: 'line' | 'stuck' | 'forfeit' | null
  history: string[]
  move_count: number
  black_nickname: string | null
  white_nickname: string | null
  ante_black: boolean | null
  ante_white: boolean | null
  bet: number
  bet_proposal: number | null
  bet_turn: 'B' | 'W' | null
  max_bet: number
  black_balance: number | null
  white_balance: number | null
  created_at: string
  updated_at: string
}

export const INITIAL_BOARD = 'BWB...WBW'

// 각 칸(0..8)의 직교 이웃.
const NEIGHBORS: number[][] = [
  [1, 3], [0, 2, 4], [1, 5],
  [0, 4, 6], [1, 3, 5, 7], [2, 4, 8],
  [3, 7], [4, 6, 8], [5, 7],
]

const LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export function swap(board: string, i: number, j: number): string {
  const cells = board.split('')
  const tmp = cells[i]
  cells[i] = cells[j]
  cells[j] = tmp
  return cells.join('')
}

export function hasLine(board: string, who: 'B' | 'W'): boolean {
  return LINES.some((line) => line.every((cell) => board[cell] === who))
}

export function winningLine(board: string, who: 'B' | 'W'): number[] | null {
  return LINES.find((line) => line.every((cell) => board[cell] === who)) ?? null
}

// 선택한 자기 돌(from)에서 규칙상 둘 수 있는 목표 칸들(반복 판 금지 포함).
export function legalTargets(board: string, from: number, who: 'B' | 'W', history: string[]): number[] {
  return NEIGHBORS[from].filter(
    (to) => board[to] !== who && !history.includes(swap(board, from, to)),
  )
}

// 어떤 자기 돌이라도 둘 수 있는 수가 하나라도 있는지.
export function anyLegalMove(board: string, who: 'B' | 'W', history: string[]): boolean {
  for (let i = 0; i < 9; i += 1) {
    if (board[i] === who && legalTargets(board, i, who, history).length > 0) return true
  }
  return false
}

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('NOT_YOUR_TURN')) return '상대의 차례입니다.'
  if (message.includes('REPEATED_POSITION')) return '이전에 나온 판 모양은 다시 만들 수 없습니다.'
  if (message.includes('INVALID_MOVE')) return '둘 수 없는 수입니다.'
  if (message.includes('GAME_NOT_ACTIVE')) return '이미 끝났거나 진행 중이 아닌 게임입니다.'
  if (message.includes('GAME_NOT_FOUND')) return '게임을 찾을 수 없습니다.'
  if (message.includes('NOT_A_PLAYER')) return '이 게임의 참가자가 아닙니다.'
  if (message.includes('INVALID_BET')) return '제안할 수 없는 금액입니다.'
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

async function rpc<T>(name: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(readableError(error))
  return data as T
}

export const makelineApi = {
  findOrCreate: () => rpc<MakeLineGame>('makeline_find_or_create_game'),
  move: (gameId: string, from: number, to: number) =>
    rpc<MakeLineGame>('makeline_move', { p_game_id: gameId, p_from: from, p_to: to }),
  leave: (gameId: string) => rpc<void>('makeline_leave_game', { p_game_id: gameId }),
  ante: (gameId: string, want: boolean) =>
    rpc<MakeLineGame>('makeline_ante', { p_game_id: gameId, p_want: want }),
  bet: (gameId: string, accept: boolean, amount: number | null) =>
    rpc<MakeLineGame>('makeline_bet', { p_game_id: gameId, p_accept: accept, p_amount: amount }),
  // 권위 있는 최신 상태를 다시 읽어 실시간 누락/순서역전을 자가 치유한다.
  get: async (gameId: string): Promise<MakeLineGame> => {
    const { data, error } = await supabase
      .from('makeline_games').select('*').eq('id', gameId).single()
    if (error) throw new Error(readableError(error))
    return data as MakeLineGame
  },
}
