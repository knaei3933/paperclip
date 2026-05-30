// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BudgetTracker } from '../src/components/BudgetTracker';

const mockBudgets = [
  { agentId: 'agent-1', limit: 1000, spent: 500, remaining: 500 },
  { agentId: 'agent-2', limit: 500, spent: 450, remaining: 50 },
  { agentId: 'agent-3', limit: 2000, spent: 1980, remaining: 20 },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('BudgetTracker', () => {
  it('renders loading state', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<BudgetTracker />);
    expect(screen.getByText('Loading budget data...')).toBeInTheDocument();
  });

  it('renders budget entries for each agent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockBudgets), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<BudgetTracker />);

    await waitFor(() => {
      expect(screen.getByText('agent-1')).toBeInTheDocument();
      expect(screen.getByText('agent-2')).toBeInTheDocument();
      expect(screen.getByText('agent-3')).toBeInTheDocument();
    });
  });

  it('shows spent and limit amounts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockBudgets), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<BudgetTracker />);

    await waitFor(() => {
      expect(screen.getByText('$500.00')).toBeInTheDocument();
    });
  });

  it('shows percentage labels', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockBudgets), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<BudgetTracker />);

    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument(); // agent-1: 500/1000
      expect(screen.getByText('90%')).toBeInTheDocument(); // agent-2: 450/500
      expect(screen.getByText('99%')).toBeInTheDocument(); // agent-3: 1980/2000
    });
  });

  it('shows WARNING for budgets at 80%+', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockBudgets), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<BudgetTracker />);

    await waitFor(() => {
      expect(screen.getByText('WARNING')).toBeInTheDocument(); // agent-2 at 90%
    });
  });

  it('shows CRITICAL for budgets at 95%+', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockBudgets), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<BudgetTracker />);

    await waitFor(() => {
      expect(screen.getByText('CRITICAL')).toBeInTheDocument(); // agent-3 at 99%
    });
  });

  it('shows empty state when no budget data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<BudgetTracker />);

    await waitFor(() => {
      expect(screen.getByText('No budget data available.')).toBeInTheDocument();
    });
  });
});
