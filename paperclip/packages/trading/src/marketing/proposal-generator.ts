import type { DbPool } from '../db/pool.js';
import { getCustomerById, type Customer } from '../customers/customer.service.js';
import { getEquipmentById, type Equipment } from '../equipment/equipment.service.js';
import { getManufacturerById } from '../manufacturers/manufacturer.service.js';

export interface ProposalDraft {
  templateId: string;
  formData: ProposalFormData;
}

export interface ProposalFormData {
  customerName: string;
  customerContact: string;
  customerAddress: string;
  customerIndustry: string;
  equipmentItems: EquipmentFormItem[];
  createdAt: string;
  validUntil: string;
}

export interface EquipmentFormItem {
  equipmentId: string;
  name: string;
  nameJa: string;
  manufacturerName: string;
  manufacturerCountry: string;
  specs: Record<string, unknown>;
  priceRange: string | null;
  leadTime: string | null;
}

const PROPOSAL_TEMPLATE_ID = 'equipment-proposal-v1';
const VALIDITY_DAYS = 30;

export async function generateProposalDraft(
  db: DbPool,
  customerId: string,
  equipmentIds: string[],
): Promise<ProposalDraft> {
  const customer = await getCustomerById(db, customerId);
  if (!customer) {
    throw new Error(`Customer not found: ${customerId}`);
  }

  const equipmentItems: EquipmentFormItem[] = [];
  for (const eqId of equipmentIds) {
    const equipment = await getEquipmentById(db, eqId);
    if (!equipment) {
      throw new Error(`Equipment not found: ${eqId}`);
    }

    let manufacturerName = '';
    let manufacturerCountry = '';
    if (equipment.manufacturerId) {
      const mfr = await getManufacturerById(db, equipment.manufacturerId);
      if (mfr) {
        manufacturerName = mfr.name;
        manufacturerCountry = mfr.country;
      }
    }

    equipmentItems.push({
      equipmentId: equipment.id,
      name: equipment.name,
      nameJa: equipment.nameJa ?? equipment.name,
      manufacturerName,
      manufacturerCountry,
      specs: equipment.specs,
      priceRange: equipment.priceRange,
      leadTime: equipment.leadTime,
    });
  }

  const now = new Date();
  const validUntil = new Date(now.getTime() + VALIDITY_DAYS * 24 * 60 * 60 * 1000);

  const formData: ProposalFormData = {
    customerName: customer.name,
    customerContact: customer.contactName ?? '',
    customerAddress: customer.address ?? '',
    customerIndustry: customer.industry ?? '',
    equipmentItems,
    createdAt: now.toISOString(),
    validUntil: validUntil.toISOString(),
  };

  const { rows } = await db.pool.query(
    `INSERT INTO documents (type, status, customer_id, data, created_at, updated_at)
     VALUES ('proposal', 'draft', $1, $2, now(), now())
     RETURNING id`,
    [customerId, JSON.stringify(formData)],
  );

  return {
    templateId: PROPOSAL_TEMPLATE_ID,
    formData,
  };
}
