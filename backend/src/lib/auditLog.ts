import { Prisma, AuditAction } from "@prisma/client";

export interface RecordChangeParams {
  entityType: string;
  entityId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  action: AuditAction;
  changedById: number;
  note?: string;
}

function toAuditString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Single reusable recorder so every mutating endpoint audits the same way. Call within the same Prisma transaction as the actual mutation. */
export async function recordChange(
  tx: Prisma.TransactionClient,
  params: RecordChangeParams
): Promise<void> {
  await tx.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      fieldName: params.fieldName,
      oldValue: toAuditString(params.oldValue),
      newValue: toAuditString(params.newValue),
      action: params.action,
      changedById: params.changedById,
      note: params.note,
    },
  });
}
