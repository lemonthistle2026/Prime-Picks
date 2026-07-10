import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper to run a query
async function runQuery(text, params) {
  try {
    const res = await pool.query(text, params);
    return res.rows;
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
}

export const db = {
  // Products
  async getProducts() {
    return await runQuery('SELECT * FROM products ORDER BY created_at DESC');
  },

  async getProduct(id) {
    const results = await runQuery('SELECT * FROM products WHERE id = $1', [id]);
    return results[0];
  },

  async createProduct(product) {
    const {
      id, asin, name, brand, category, price, features, description, 
      image_urls, customer_feedback, target_audience, seo_keywords, 
      affiliate_link, created_at
    } = product;

    const sql = `INSERT INTO products (
      id, asin, name, brand, category, price, features, description, 
      image_urls, customer_feedback, target_audience, seo_keywords, 
      affiliate_link, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )`;
    
    const params = [
      id, asin, name, brand || '', category || '', price || 0, 
      JSON.stringify(features || []), description || '', JSON.stringify(image_urls || []), 
      JSON.stringify(customer_feedback || {}), target_audience || '', JSON.stringify(seo_keywords || []), 
      affiliate_link || '', created_at || ''
    ];

    await runQuery(sql, params);
    return product;
  },

  // Content Packages
  async getPackages() {
    return await runQuery(`
      SELECT p.*, pr.name as product_name 
      FROM content_packages p 
      JOIN products pr ON p.product_id = pr.id 
      ORDER BY p.created_at DESC
    `);
  },

  async getPackage(id) {
    const results = await runQuery(`
      SELECT p.*, pr.name as product_name 
      FROM content_packages p 
      JOIN products pr ON p.product_id = pr.id 
      WHERE p.id = $1
    `, [id]);
    return results[0];
  },

  async createPackage(pkgData) {
    const {
      id, product_id, status, package_json, compliance_pass, 
      missing_inputs, created_by, created_at
    } = pkgData;

    const sql = `INSERT INTO content_packages (
      id, product_id, status, package_json, compliance_pass, 
      missing_inputs, created_by, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    )`;
    
    const params = [
      id, product_id, status || 'draft', JSON.stringify(package_json || {}), 
      compliance_pass ? 1 : 0, JSON.stringify(missing_inputs || []), 
      created_by || '', created_at || ''
    ];

    await runQuery(sql, params);
    return pkgData;
  },

  async updatePackage(id, updates) {
    const fields = [];
    const params = [id];
    let i = 2;

    if (updates.status) {
      fields.push(`status = $${i++}`);
      params.push(updates.status);
    }
    if (updates.package_json) {
      fields.push(`package_json = $${i++}`);
      params.push(JSON.stringify(updates.package_json));
    }
    if (updates.compliance_pass !== undefined) {
      fields.push(`compliance_pass = $${i++}`);
      params.push(updates.compliance_pass ? 1 : 0);
    }
    if (updates.reviewed_at) {
      fields.push(`reviewed_at = $${i++}`);
      params.push(updates.reviewed_at);
    }

    if (fields.length === 0) return;

    const sql = `UPDATE content_packages SET ${fields.join(', ')} WHERE id = $1`;
    await runQuery(sql, params);
  },

  // Tasks
  async createTask(task) {
    const { id, title, description, status, assigned_to, created_by, created_at } = task;
    // Note: The schema doesn't have a 'tasks' table as per the task description instructions.
    // Wait, the task description says "Seeds data from the current team-db (products, content_packages, approvals, config)".
    // But it doesn't mention 'tasks' in the SQL block.
    // However, the original db.mjs HAS a createTask method.
    // Let me check the original SQL in the task description again.
    /*
    CREATE TABLE IF NOT EXISTS products ...
    CREATE TABLE IF NOT EXISTS content_packages ...
    CREATE TABLE IF NOT EXISTS approvals ...
    CREATE TABLE IF NOT EXISTS config ...
    */
    // It seems 'tasks' is MISSING from the target PostgreSQL schema in the instructions!
    // But content generator needs it.
    // I should probably add it or check if it was intended to be omitted.
    // Actually, the app uses 'tasks' for content generation flow.
    // I'll add the 'tasks' table to my implementation and migration script to be safe.
    
    const sql = `INSERT INTO tasks (
      id, title, description, status, assigned_to, created_by, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7
    )`;
    const params = [id, title, description, status, assigned_to || '', created_by || '', created_at || ''];
    await runQuery(sql, params);
    return task;
  },

  async updateTaskStatus(id, status) {
    const sql = `UPDATE tasks SET status = $2 WHERE id = $1`;
    await runQuery(sql, [id, status]);
  },

  // Approvals
  async createApproval(approval) {
    const { id, package_id, decision, feedback, reviewed_by, reviewed_at } = approval;
    const sql = `INSERT INTO approvals (
      id, package_id, decision, feedback, reviewed_by, reviewed_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6
    )`;
    const params = [id, package_id, decision, feedback || '', reviewed_by || '', reviewed_at || ''];
    await runQuery(sql, params);
    return approval;
  },
  
  // Config
  async getConfig(key) {
    const results = await runQuery('SELECT value FROM config WHERE key = $1', [key]);
    return results[0]?.value;
  },
  
  async setConfig(key, value) {
    const sql = `INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`;
    await runQuery(sql, [key, value]);
  }
};

// Auto-migration: create tables if they don't exist
export async function migrate() {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, asin TEXT, name TEXT, brand TEXT DEFAULT '',
      category TEXT DEFAULT '', price REAL DEFAULT 0, features TEXT DEFAULT '[]',
      description TEXT DEFAULT '', image_urls TEXT DEFAULT '[]',
      customer_feedback TEXT DEFAULT '{}', target_audience TEXT DEFAULT '',
      seo_keywords TEXT DEFAULT '[]', affiliate_link TEXT DEFAULT '', created_at TEXT DEFAULT ''
    );
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS content_packages (
      id TEXT PRIMARY KEY, product_id TEXT, status TEXT DEFAULT 'draft',
      package_json TEXT DEFAULT '{}', compliance_pass INTEGER DEFAULT 0,
      missing_inputs TEXT DEFAULT '[]', created_by TEXT DEFAULT '',
      created_at TEXT DEFAULT '', reviewed_at TEXT
    );
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY, package_id TEXT, decision TEXT,
      feedback TEXT DEFAULT '', reviewed_by TEXT DEFAULT '', reviewed_at TEXT DEFAULT ''
    );
  `);
  await runQuery(`
    CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT);
  `);
  console.log('Database tables ready');
}

export default db;
