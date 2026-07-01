import { Modal } from './Modal'

interface WinnerModalProps {
  nickname: string
  onClose: () => void
}

export function WinnerModal({ nickname, onClose }: WinnerModalProps) {
  return (
    <Modal eyebrow='CASE CLOSED' title='오늘의 퍼즐이 해결되었습니다' onClose={onClose}>
      <div className='winner-emblem' aria-hidden='true'>◆</div>
      <p className='winner-name'><strong>{nickname}</strong> 님이 최초로 해결했습니다.</p>
      <p className='modal-copy winner-copy'>
        오늘의 힌트 판매는 종료되었습니다. 퍼즐은 계속 풀 수 있지만 추가 상금은 지급되지 않습니다.
      </p>
      <button className='primary-button winner-confirm' onClick={onClose}>확인</button>
    </Modal>
  )
}
