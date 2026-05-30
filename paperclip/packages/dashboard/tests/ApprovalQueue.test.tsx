// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApprovalQueue } from '../src/components/ApprovalQueue';

const mockEscalations = [
  {
    id: 'esc-1',
    taskId: 'task-1',
    reason: 'Budget exceeds threshold',
    urgency: 'high',
    channel: 'slack',
    status: 'pending',
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'esc-2',
    taskId: 'task-2',
    reason: 'Requires human approval for sensitive data',
    urgency: 'critical',
    channel: 'email',
    status: 'pending',
    createdAt: '2026-01-15T11:00:00Z',
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ApprovalQueue', () => {
  it('renders loading state', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<ApprovalQueue wsEvent={null} />);
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('renders pending escalations with details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ escalations: mockEscalations }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<ApprovalQueue wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('Budget exceeds threshold')).toBeInTheDocument();
      expect(screen.getByText('Requires human approval for sensitive data')).toBeInTheDocument();
    });
  });

  it('renders approve and reject buttons for each escalation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ escalations: mockEscalations }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<ApprovalQueue wsEvent={null} />);

    await waitFor(() => {
      const approveButtons = screen.getAllByText('承認');
      const rejectButtons = screen.getAllByText('却下');
      expect(approveButtons.length).toBe(2);
      expect(rejectButtons.length).toBe(2);
    });
  });

  it('shows urgency level with correct formatting', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ escalations: mockEscalations }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<ApprovalQueue wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });
  });

  it('shows empty state when no pending approvals', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ escalations: [] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<ApprovalQueue wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('承認待ちはありません。')).toBeInTheDocument();
    });
  });

  it('removes escalation after approve action', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // Initial load
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ escalations: mockEscalations }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Approve call
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, escalation: {} }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<ApprovalQueue wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('Budget exceeds threshold')).toBeInTheDocument();
    });

    const approveButtons = screen.getAllByText('承認');
    await userEvent.click(approveButtons[0]);

    // After approval, only one escalation should remain
    await waitFor(() => {
      expect(screen.queryByText('Budget exceeds threshold')).not.toBeInTheDocument();
      expect(screen.getByText('Requires human approval for sensitive data')).toBeInTheDocument();
    });
  });

  it('removes escalation after reject action', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ escalations: mockEscalations }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, escalation: {} }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<ApprovalQueue wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('Requires human approval for sensitive data')).toBeInTheDocument();
    });

    const rejectButtons = screen.getAllByText('却下');
    await userEvent.click(rejectButtons[1]);

    await waitFor(() => {
      expect(screen.queryByText('Requires human approval for sensitive data')).not.toBeInTheDocument();
    });
  });

  it('refetches escalations on websocket escalation_created event', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // Initial load
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ escalations: [] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Refetch after ws event
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ escalations: mockEscalations }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { rerender } = render(<ApprovalQueue wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('承認待ちはありません。')).toBeInTheDocument();
    });

    const wsEvent = {
      type: 'escalation_created' as const,
      data: { escalationId: 'esc-new', taskId: 'task-new' },
    };

    rerender(<ApprovalQueue wsEvent={wsEvent} />);

    await waitFor(() => {
      expect(screen.getByText('Budget exceeds threshold')).toBeInTheDocument();
    });
  });
});
