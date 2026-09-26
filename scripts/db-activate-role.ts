import pg from 'pg';

const { Client } = pg;

const password = process.argv[2];
if (!password || password.length < 32) {
  throw new Error('Usage: db-activate-role.ts <password-min-32-chars>');
}

const directUrl = process.env.DIRECT_URL;
if (!directUrl) throw new Error('DIRECT_URL is not set.');

const client = new Client({ connectionString: directUrl });
await client.connect();
await client.query(`ALTER ROLE payproof_app WITH LOGIN PASSWORD '${password.replace(/'/g, "''")}'`);

const rls = await client.query(
  `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%' ORDER BY tablename`,
);
console.log('ROLE_ACTIVE payproof_app LOGIN set');
console.log('RLS=' + JSON.stringify(rls.rows));

const grants = await client.query(
  `SELECT table_name FROM information_schema.role_table_grants WHERE grantee = 'payproof_app' AND privilege_type = 'SELECT' ORDER BY table_name`,
);
console.log('GRANTS=' + JSON.stringify(grants.rows.map((r: { table_name: string }) => r.table_name)));

await client.end();
process.exit(0);
