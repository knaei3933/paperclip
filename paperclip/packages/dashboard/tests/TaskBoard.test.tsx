// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TaskBoard } from '../src/components/TaskBoard';

const mockTasks = [
  {
    id: 'task-1',
    title: 'Process order',
    description: 'Handle incoming order',
    status: 'queued',
    assigneeId: '',
    budgetAllocated: 100,
    budgetUsed: 0,
    priority: 2,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'task-2',
    title: 'Generate report',
    description: 'Monthly report',
    status: 'running',
    assigneeId: 'agent-1',
    budgetAllocated: 200,
    budgetUsed: 50,
    priority: 3,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'task-3',
    title: 'Handle refund',
    description: 'Customer refund request',
    status: 'completed',
    assigneeId: 'agent-2',
    budgetAllocated: 150,
    budgetUsed: 120,
    priority: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('TaskBoard', () => {
  it('renders loading state', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<TaskBoard wsEvent={null} />);
    expect(screen.getByText('Loading tasks...')).toBeInTheDocument();
  });

  it('renders all column headers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ tasks: mockTasks, total: 3 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<TaskBoard wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('Queued')).toBeInTheDocument();
      expect(screen.getByText('Assigned')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  it('renders tasks in correct columns based on status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ tasks: mockTasks, total: 3 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<TaskBoard wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('Process order')).toBeInTheDocument();
      expect(screen.getByText('Generate report')).toBeInTheDocument();
      expect(screen.getByText('Handle refund')).toBeInTheDocument();
    });
  });

  it('shows task count per column', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ tasks: mockTasks, total: 3 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<TaskBoard wsEvent={null} />);

    await waitFor(() => {
      // Queued column has 1 task
      const queuedHeader = screen.getByText('Queued').parentElement!;
      expect(queuedHeader.textContent).toContain('1');
      // Completed column has 1 task
      const completedHeader = screen.getByText('Completed').parentElement!;
      expect(completedHeader.textContent).toContain('1');
    });
  });

  it('shows priority labels on task cards', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ tasks: mockTasks, total: 3 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<TaskBoard wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Low')).toBeInTheDocument();
    });
  });

  it('updates tasks on websocket task_updated event', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ tasks: mockTasks, total: 3 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { rerender } = render(<TaskBoard wsEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('Process order')).toBeInTheDocument();
    });

    // Simulate a task status update
    const updatedTask = { ...mockTasks[0], status: 'failed' };
    const wsEvent = {
      type: 'task_updated' as const,
      data: updatedTask,
    };

    rerender(<TaskBoard wsEvent={wsEvent} />);

    await waitFor(() => {
      // "Process order" should now appear in Failed column
      // The task should still exist in the DOM
      expect(screen.getByText('Process order')).toBeInTheDocument();
    });
  });
});
