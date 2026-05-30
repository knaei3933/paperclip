// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AgentStatus } from '../src/components/AgentStatus';

const mockAgents = [
  {
    id: 'agent-1',
    name: 'Sales Agent',
    role: 'sales',
    departmentId: 'dept-sales',
    status: 'idle',
    budgetLimit: 1000,
    currentTaskId: null,
  },
  {
    id: 'agent-2',
    name: 'Support Agent',
    role: 'support',
    departmentId: 'dept-support',
    status: 'running',
    budgetLimit: 500,
    currentTaskId: 'task-123',
  },
  {
    id: 'agent-3',
    name: 'Billing Agent',
    role: 'billing',
    departmentId: 'dept-finance',
    status: 'error',
    budgetLimit: 2000,
    currentTaskId: null,
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('AgentStatus', () => {
  it('renders loading state', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<AgentStatus wsEvent={null} />);
    expect(screen.getByText('Loading agents...')).toBeInTheDocument();
  });

  it('renders agent cards with names and statuses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ agents: mockAgents, total: 3 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<AgentStatus wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('Sales Agent')).toBeInTheDocument();
      expect(screen.getByText('Support Agent')).toBeInTheDocument();
      expect(screen.getByText('Billing Agent')).toBeInTheDocument();
    });

    expect(screen.getByText('idle')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('shows role and department for each agent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ agents: mockAgents, total: 3 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<AgentStatus wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('Role: sales')).toBeInTheDocument();
      expect(screen.getByText('Dept: dept-sales')).toBeInTheDocument();
    });
  });

  it('shows current task when assigned', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ agents: mockAgents, total: 3 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<AgentStatus wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('Task: task-123')).toBeInTheDocument();
    });
  });

  it('shows empty state when no agents', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ agents: [], total: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<AgentStatus wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('No agents found.')).toBeInTheDocument();
    });
  });

  it('updates agent status on websocket event', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ agents: mockAgents, total: 3 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { rerender } = render(<AgentStatus wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('Sales Agent')).toBeInTheDocument();
    });

    // Simulate WebSocket event changing agent-1 from idle to error
    const wsEvent = {
      type: 'agent_status_changed' as const,
      data: { agentId: 'agent-1', status: 'error' },
    };

    rerender(<AgentStatus wsEvent={wsEvent} />);

    // Should now have two agents with "error" status (agent-1 changed, agent-3 was already error)
    const errorBadges = screen.getAllByText('error');
    expect(errorBadges.length).toBe(2);
  });
});
