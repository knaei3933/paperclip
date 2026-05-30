import { AgentStatus } from '../components/AgentStatus';
import type { WsEvent } from '../api/websocket';

interface Props {
  wsEvent: WsEvent | null;
}

export function Agents({ wsEvent }: Props) {
  return (
    <div>
      <h2 style={styles.heading}>エージェント</h2>
      <AgentStatus wsEvent={wsEvent} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { color: '#e2e8f0', fontSize: '1.25rem', fontWeight: 600, margin: '0 0 1.5rem 0' },
};
