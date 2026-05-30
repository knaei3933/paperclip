import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbPool } from '../src/db/pool.js';

function createMockDb(queryMock?: ReturnType<typeof vi.fn>): DbPool {
  return { pool: { query: queryMock ?? vi.fn() } } as unknown as DbPool;
}

describe('proposal-draft.service', () => {
  let mockQuery: ReturnType<typeof vi.fn>;
  let db: DbPool;

  beforeEach(() => {
    mockQuery = vi.fn();
    db = createMockDb(mockQuery);
  });

  describe('getProposalById', () => {
    it('returns proposal when found', async () => {
      const row = {
        id: 'prop-1',
        dealId: 'deal-1',
        customerId: 'cust-1',
        manufacturerId: null,
        items: [],
        status: 'draft',
        notes: '',
        pdfPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockQuery.mockResolvedValue({ rows: [row] });

      const { getProposalById } = await import('../src/skills/proposal-draft/proposal-draft.service.js');
      const result = await getProposalById(db, 'prop-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('prop-1');
      expect(result!.dealId).toBe('deal-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM proposal_drafts WHERE id = $1'),
        ['prop-1']
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { getProposalById } = await import('../src/skills/proposal-draft/proposal-draft.service.js');
      const result = await getProposalById(db, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateProposal', () => {
    it('updates items and returns updated record', async () => {
      const updatedRow = {
        id: 'prop-1',
        dealId: 'deal-1',
        customerId: 'cust-1',
        manufacturerId: null,
        items: [{ description: 'Updated', quantity: 1, unitPriceSource: 100 }],
        status: 'draft',
        notes: '',
        pdfPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockQuery.mockResolvedValue({ rows: [updatedRow] });

      const { updateProposal } = await import('../src/skills/proposal-draft/proposal-draft.service.js');
      const result = await updateProposal(db, 'prop-1', {
        items: [{ description: 'Updated', quantity: 1, unitPriceSource: 100 }] as any,
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe('prop-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE proposal_drafts'),
        expect.arrayContaining([expect.any(String), 'prop-1'])
      );
    });

    it('returns existing record when no fields to update', async () => {
      const existingRow = {
        id: 'prop-1',
        dealId: 'deal-1',
        customerId: 'cust-1',
        manufacturerId: null,
        items: [],
        status: 'draft',
        notes: 'existing',
        pdfPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockQuery.mockResolvedValue({ rows: [existingRow] });

      const { updateProposal } = await import('../src/skills/proposal-draft/proposal-draft.service.js');
      const result = await updateProposal(db, 'prop-1', {});

      expect(result).not.toBeNull();
      // Should call getProposalById (SELECT), not UPDATE
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['prop-1']
      );
    });
  });

  describe('approveProposal', () => {
    it('sets status to approved', async () => {
      const approvedRow = {
        id: 'prop-1',
        dealId: 'deal-1',
        customerId: 'cust-1',
        manufacturerId: null,
        items: [],
        status: 'approved',
        notes: '',
        pdfPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockQuery.mockResolvedValue({ rows: [approvedRow] });

      const { approveProposal } = await import('../src/skills/proposal-draft/proposal-draft.service.js');
      const result = await approveProposal(db, 'prop-1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('approved');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = 'approved'"),
        ['prop-1']
      );
    });

    it('returns null when proposal not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { approveProposal } = await import('../src/skills/proposal-draft/proposal-draft.service.js');
      const result = await approveProposal(db, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('rejectProposal', () => {
    it('sets status back to draft', async () => {
      const rejectedRow = {
        id: 'prop-1',
        dealId: 'deal-1',
        customerId: 'cust-1',
        manufacturerId: null,
        items: [],
        status: 'draft',
        notes: '',
        pdfPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockQuery.mockResolvedValue({ rows: [rejectedRow] });

      const { rejectProposal } = await import('../src/skills/proposal-draft/proposal-draft.service.js');
      const result = await rejectProposal(db, 'prop-1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('draft');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = 'draft'"),
        ['prop-1']
      );
    });

    it('returns null when proposal not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { rejectProposal } = await import('../src/skills/proposal-draft/proposal-draft.service.js');
      const result = await rejectProposal(db, 'nonexistent');

      expect(result).toBeNull();
    });
  });
});
