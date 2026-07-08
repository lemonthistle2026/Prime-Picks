import pkg from 'pg';
const { Client } = pkg;
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runTeamDb(sql) {
  try {
    const { stdout } = await execAsync(`team-db "${sql.replace(/"/g, '\\"')}"`);
    return JSON.parse(stdout);
  } catch (err) {
    console.error(`Error running team-db query: ${sql}`, err.message);
    return [];
  }
}

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Create tables
    console.log('Creating tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        asin TEXT,
        name TEXT,
        brand TEXT DEFAULT '',
        category TEXT DEFAULT '',
        price REAL DEFAULT 0,
        features TEXT DEFAULT '[]',
        description TEXT DEFAULT '',
        image_urls TEXT DEFAULT '[]',
        customer_feedback TEXT DEFAULT '{}',
        target_audience TEXT DEFAULT '',
        seo_keywords TEXT DEFAULT '[]',
        affiliate_link TEXT DEFAULT '',
        created_at TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS content_packages (
        id TEXT PRIMARY KEY,
        product_id TEXT,
        status TEXT DEFAULT 'draft',
        package_json TEXT DEFAULT '{}',
        compliance_pass INTEGER DEFAULT 0,
        missing_inputs TEXT DEFAULT '[]',
        created_by TEXT DEFAULT '',
        created_at TEXT DEFAULT '',
        reviewed_at TEXT,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );

      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        package_id TEXT,
        decision TEXT,
        feedback TEXT DEFAULT '',
        reviewed_by TEXT DEFAULT '',
        reviewed_at TEXT DEFAULT '',
        FOREIGN KEY (package_id) REFERENCES content_packages(id)
      );

      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        status TEXT,
        assigned_to TEXT,
        created_by TEXT,
        created_at TEXT
      );
    `);
    console.log('Tables created successfully.');

    // Migration data
    const tables = ['products', 'content_packages', 'approvals', 'config', 'tasks'];

    for (const table of tables) {
      console.log(`Migrating data for table: ${table}...`);
      const rows = await runTeamDb(`SELECT * FROM ${table}`);
      
      if (rows.length === 0) {
        console.log(`No data to migrate for ${table}.`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

      for (const row of rows) {
        const values = columns.map(col => {
          const val = row[col];
          // Handle SQLite boolean/integer conversion if needed (though SQLite handles most things as strings/ints)
          return val;
        });
        await client.query(sql, values);
      }
      console.log(`Migrated ${rows.length} rows for ${table}.`);
    }

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
