/**
 * Verifies the database connection and lists the tables that exist.
 * Run with: npm run db:check
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

try {
  const [info] = await sql`select current_database() as db, version() as version`;
  console.log(`Connected to "${info.db}"`);
  console.log(info.version.split(",")[0]);

  const tables = await sql<{ table_name: string; columns: number }[]>`
    select t.table_name, count(c.column_name)::int as columns
    from information_schema.tables t
    join information_schema.columns c
      on c.table_schema = t.table_schema and c.table_name = t.table_name
    where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    group by t.table_name
    order by t.table_name`;

  console.log(`\n${tables.length} tables:`);
  for (const t of tables) console.log(`  ${t.table_name.padEnd(24)} ${t.columns} columns`);
} catch (err) {
  console.error("Connection failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
