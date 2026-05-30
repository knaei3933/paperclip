import { ApprovalQueue } from '../components/ApprovalQueue';
import type { WsEvent } from '../api/websocket';

interface Props {
  wsEvent: WsEvent | null;
}

export function Approvals({ wsEvent }: Props) {
  return (
    <div>
      <h2 style={styles.heading}>承認待ち</h2>
      <ApprovalQueue wsEvent={wsEvent} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { color: '#e2e8f0', fontSize: '1.25rem', fontWeight: 600, margin: '0 0 1.5rem 0' },
};
