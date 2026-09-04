import "server-only";
import { db, schema } from "@/db";

type EntityType = (typeof schema.auditLog.$inferInsert)["entityType"];
type Action = (typeof schema.auditLog.$inferInsert)["action"];

/** Every manual change is logged with full before/after snapshots (build-spec §2). */
export async function logAudit(input: {
  entityType: EntityType;
  entityId: number;
  action: Action;
  before?: unknown;
  after?: unknown;
  note?: string | null;
}) {
  await db.insert(schema.auditLog).values({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    beforeJson: input.before === undefined ? null : JSON.stringify(input.before),
    afterJson: input.after === undefined ? null : JSON.stringify(input.after),
    note: input.note ?? null,
  });
}
