import type { Proposal, ProposalItem } from '../../api/client';

interface Props {
  proposal: Proposal;
}

function formatJpy(amount: number): string {
  return `${amount.toLocaleString()} JPY`;
}

export function ProposalPreview({ proposal }: Props) {
  return (
    <div style={s.card}>
      <h3 style={s.title}>提案書プレビュー</h3>

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>品目</th>
            <th style={{ ...s.th, textAlign: 'right' as const }}>数量</th>
            <th style={{ ...s.th, textAlign: 'right' as const }}>単価</th>
            <th style={{ ...s.th, textAlign: 'right' as const }}>マージン率</th>
            <th style={{ ...s.th, textAlign: 'right' as const }}>マージン込価格</th>
            <th style={{ ...s.th, textAlign: 'right' as const }}>小計</th>
          </tr>
        </thead>
        <tbody>
          {proposal.items.map((item: ProposalItem) => (
            <tr key={item.id} style={s.tr}>
              <td style={s.td}>
                {item.equipmentName}
                {item.equipmentNameKo && (
                  <span style={s.nameKo}> / {item.equipmentNameKo}</span>
                )}
              </td>
              <td style={{ ...s.td, textAlign: 'right' as const }}>{item.quantity}</td>
              <td style={{ ...s.td, textAlign: 'right' as const }}>{formatJpy(item.unitPrice)}</td>
              <td style={{ ...s.td, textAlign: 'right' as const }}>{(item.marginRate * 100).toFixed(1)}%</td>
              <td style={{ ...s.td, textAlign: 'right' as const }}>{formatJpy(item.marginInclusivePrice)}</td>
              <td style={{ ...s.td, textAlign: 'right' as const, fontWeight: 600 }}>{formatJpy(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ ...s.td, textAlign: 'right' as const, fontWeight: 700 }}>合計</td>
            <td style={{ ...s.td, textAlign: 'right' as const, fontWeight: 700, color: '#fcd34d' }}>{formatJpy(proposal.totalAmount)}</td>
          </tr>
        </tfoot>
      </table>

      {(itemHasSpecs(proposal.items) || proposal.deliveryTerms || proposal.paymentTerms) && (
        <div style={s.metaSection}>
          <h4 style={s.sectionTitle}>取引条件</h4>
          <div style={s.metaGrid}>
            {proposal.deliveryTerms && (
              <div style={s.metaField}>
                <span style={s.metaLabel}>納入条件</span>
                <span style={s.metaValue}>{proposal.deliveryTerms}</span>
              </div>
            )}
            {proposal.paymentTerms && (
              <div style={s.metaField}>
                <span style={s.metaLabel}>支払条件</span>
                <span style={s.metaValue}>{proposal.paymentTerms}</span>
              </div>
            )}
            {proposal.validityDays && (
              <div style={s.metaField}>
                <span style={s.metaLabel}>有効期間</span>
                <span style={s.metaValue}>{proposal.validityDays}日間</span>
              </div>
            )}
          </div>
        </div>
      )}

      {proposal.notes && (
        <div style={s.notes}>
          <span style={s.metaLabel}>備考</span>
          <p style={s.notesText}>{proposal.notes}</p>
        </div>
      )}
    </div>
  );
}

function itemHasSpecs(items: ProposalItem[]): boolean {
  return items.some((item) => item.manufacturerSpecs && Object.keys(item.manufacturerSpecs).length > 0);
}

const s: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#16213e',
    border: '1px solid #2a3a5c',
    borderRadius: '8px',
    padding: '1.25rem',
  },
  title: {
    color: '#e2e8f0',
    fontSize: '1rem',
    fontWeight: 600,
    margin: '0 0 1rem 0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.85rem',
  },
  th: {
    color: '#94a3b8',
    fontWeight: 500,
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    padding: '0.5rem 0.6rem',
    borderBottom: '1px solid #2a3a5c',
    textAlign: 'left' as const,
  },
  tr: {
    borderBottom: '1px solid #1e293b',
  },
  td: {
    color: '#e2e8f0',
    padding: '0.6rem',
    fontSize: '0.85rem',
  },
  nameKo: {
    color: '#64748b',
    fontSize: '0.75rem',
  },
  metaSection: {
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #1e293b',
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: '0.9rem',
    fontWeight: 600,
    margin: '0 0 0.75rem 0',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '0.75rem',
  },
  metaField: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.2rem',
  },
  metaLabel: {
    color: '#94a3b8',
    fontSize: '0.75rem',
  },
  metaValue: {
    color: '#e2e8f0',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  notes: {
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #1e293b',
  },
  notesText: {
    color: '#94a3b8',
    fontSize: '0.85rem',
    margin: '0.25rem 0 0 0',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
  },
};
