import "dotenv/config";
import { db, schema } from "../src/db";

// Idempotent dev seed: settings row + one company so the shell can render.
async function main() {
  await db
    .insert(schema.settings)
    .values({ id: 1, schemaVersion: 1 })
    .onConflictDoNothing();

  await db
    .insert(schema.companies)
    .values({ name: "Nahope LLC", slug: "nahope" })
    .onConflictDoNothing();

  const companies = await db.select().from(schema.companies);
  console.log(`seeded: ${companies.length} compan${companies.length === 1 ? "y" : "ies"}`);
}

main().then(() => process.exit(0));
