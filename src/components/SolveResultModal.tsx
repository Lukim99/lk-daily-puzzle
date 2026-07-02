import { Modal } from './Modal'

interface SolveResultModalProps {
  firstSolver: boolean
  awardedPoints: number
  onClose: () => void
}

const points = new Intl.NumberFormat('ko-KR')

export function SolveResultModal({ firstSolver, awardedPoints, onClose }: SolveResultModalProps) {
  return (
    <Modal
      eyebrow={firstSolver ? 'FIRST SOLVE' : 'CASE SOLVED'}
      title={firstSolver ? '최초 해결에 성공했습니다!' : '사건을 해결했습니다!'}
      onClose={onClose}
    >
      <div className={'winner-emblem solve-emblem' + (firstSolver ? ' solve-emblem-gold' : '')} aria-hidden='true'>
        {firstSolver ? '★' : '◆'}
      </div>

      {firstSolver ? (
        <>
          <p className='winner-name'>오늘의 사건을 <strong>가장 먼저</strong> 풀어냈습니다.</p>
          <div className='solve-reward'>
            <small>획득 상금</small>
            <strong>+{points.format(awardedPoints)} P</strong>
          </div>
        </>
      ) : (
        <>
          <p className='winner-name'>정답입니다. 사건 파일이 <strong>종결</strong>되었습니다.</p>
          <p className='modal-copy winner-copy'>
            이미 최초 정답자가 나와 추가 상금은 없지만, 당신의 해결 기록은 남습니다.
          </p>
        </>
      )}

      <button className='primary-button winner-confirm' onClick={onClose}>확인</button>
    </Modal>
  )
}
