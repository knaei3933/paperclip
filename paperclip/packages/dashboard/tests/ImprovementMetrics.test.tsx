// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock recharts components to avoid canvas rendering issues in jsdom
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Legend: () => null,
}));

import { ImprovementMetrics } from '../src/components/ImprovementMetrics';

const mockMetrics = [
  {
    agentId: 'agent-1',
    completionTimes: [
      { timestamp: '2026-01-01T00:00:00Z', value: 120 },
      { timestamp: '2026-01-02T00:00:00Z', value: 100 },
    ],
    successRates: [
      { timestamp: '2026-01-01T00:00:00Z', value: 85 },
      { timestamp: '2026-01-02T00:00:00Z', value: 90 },
    ],
    costEfficiency: [
      { timestamp: '2026-01-01T00:00:00Z', value: 70 },
      { timestamp: '2026-01-02T00:00:00Z', value: 75 },
    ],
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ImprovementMetrics', () => {
  it('renders loading state', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<ImprovementMetrics />);
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('renders chart titles when data loaded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockMetrics), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<ImprovementMetrics />);

    await waitFor(() => {
      expect(screen.getByText('完了時間の推移')).toBeInTheDocument();
      expect(screen.getByText('成功率の推移')).toBeInTheDocument();
      expect(screen.getByText('コスト効率の推移')).toBeInTheDocument();
    });
  });

  it('renders agent selector dropdown', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockMetrics), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<ImprovementMetrics />);

    await waitFor(() => {
      expect(screen.getByText('エージェント:')).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });
  });

  it('renders line chart components', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockMetrics), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<ImprovementMetrics />);

    await waitFor(() => {
      const charts = screen.getAllByTestId('line-chart');
      expect(charts.length).toBe(3);
    });
  });

  it('shows empty state when no metrics', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<ImprovementMetrics />);

    await waitFor(() => {
      expect(screen.getByText('改善データがありません。')).toBeInTheDocument();
    });
  });
});
