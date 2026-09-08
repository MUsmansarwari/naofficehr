import "server-only";
import { db, schema } from "@/db";

type EntityType = (typeof schema.auditLog.$inferInsert)["entityType"];
type Action = (typeof schema.auditLog.$inferInsert)["action"];

/** `db`, or the handle passed to a `db.transaction` callback. */
export type Writer = Pick<typeof db, "insert">;

/**
 * Every manual change is logged with full before/after snapshots (build-spec §2).
 * Inside a transaction, pass the transaction handle — SQLite takes a write lock
 * for the whole transaction, so a second connection would deadlock.
 */
export async function logAudit(
  input: {
    entityType: EntityType;
    entityId: number;
    action: Action;
    before?: unknown;
    after?: unknown;
    note?: string | null;
  },
  tx: Writer = db,
) {
  await tx.insert(schema.auditLog).values({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    beforeJson: input.before === undefined ? null : JSON.stringify(input.before),
    afterJson: input.after === undefined ? null : JSON.stringify(input.after),
    note: input.note ?? null,
  });
}
