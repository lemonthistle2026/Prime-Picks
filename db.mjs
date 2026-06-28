import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runQuery(sql) {
  try {
    // Escape double quotes for the shell command
    const shellEscapedSql = sql.replace(/"/g, '\\"');
    const { stdout } = await execAsync(`team-db "${shellEscapedSql}"`);
    return JSON.parse(stdout);
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
}

function escapeSql(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/'/g, "''");
}

export const db = {
  // Products
  async getProducts() {
    return await runQuery('SELECT * FROM products ORDER BY created_at DESC');
  },

  async getProduct(id) {
    const results = await runQuery(`SELECT * FROM products WHERE id = '${id}'`);
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
      '${escapeSql(id)}', '${escapeSql(asin)}', '${escapeSql(name)}', '${escapeSql(brand)}', '${escapeSql(category)}', ${price || 0}, 
      '${escapeSql(JSON.stringify(features))}', '${escapeSql(description)}', '${escapeSql(JSON.stringify(image_urls))}', 
      '${escapeSql(JSON.stringify(customer_feedback))}', '${escapeSql(target_audience)}', '${escapeSql(JSON.stringify(seo_keywords))}', 
      '${escapeSql(affiliate_link || '')}', '${escapeSql(created_at)}'
    )`;
    await runQuery(sql);
    return product;
  },

  // Content Packages
  async getPackages() {
    // Join with products to get product_name
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
      WHERE p.id = '${id}'
    `);
    return results[0];
  },

  async createPackage(pkg) {
    const {
      id, product_id, status, package_json, compliance_pass, 
      missing_inputs, created_by, created_at
    } = pkg;

    const sql = `INSERT INTO content_packages (
      id, product_id, status, package_json, compliance_pass, 
      missing_inputs, created_by, created_at
    ) VALUES (
      '${escapeSql(id)}', '${escapeSql(product_id)}', '${escapeSql(status)}', '${escapeSql(JSON.stringify(package_json))}', 
      ${compliance_pass ? 1 : 0}, '${escapeSql(JSON.stringify(missing_inputs))}', 
      '${escapeSql(created_by)}', '${escapeSql(created_at)}'
    )`;
    await runQuery(sql);
    return pkg;
  },

  async updatePackage(id, updates) {
    const fields = [];
    if (updates.status) fields.push(`status = '${escapeSql(updates.status)}'`);
    if (updates.package_json) fields.push(`package_json = '${escapeSql(JSON.stringify(updates.package_json))}'`);
    if (updates.compliance_pass !== undefined) fields.push(`compliance_pass = ${updates.compliance_pass ? 1 : 0}`);
    if (updates.reviewed_at) fields.push(`reviewed_at = '${escapeSql(updates.reviewed_at)}'`);

    if (fields.length === 0) return;

    const sql = `UPDATE content_packages SET ${fields.join(', ')} WHERE id = '${escapeSql(id)}'`;
    await runQuery(sql);
  },

  // Tasks
  async createTask(task) {
    const { id, title, description, status, assigned_to, created_by, created_at } = task;
    const sql = `INSERT INTO tasks (
      id, title, description, status, assigned_to, created_by, created_at
    ) VALUES (
      '${escapeSql(id)}', '${escapeSql(title)}', '${escapeSql(description)}', '${escapeSql(status)}', 
      '${escapeSql(assigned_to || '')}', '${escapeSql(created_by)}', '${escapeSql(created_at)}'
    )`;
    await runQuery(sql);
    return task;
  },

  async updateTaskStatus(id, status) {
    const sql = `UPDATE tasks SET status = '${escapeSql(status)}' WHERE id = '${escapeSql(id)}'`;
    await runQuery(sql);
  },

  // Approvals
  async createApproval(approval) {
    const { id, package_id, decision, feedback, reviewed_by, reviewed_at } = approval;
    const sql = `INSERT INTO approvals (
      id, package_id, decision, feedback, reviewed_by, reviewed_at
    ) VALUES (
      '${escapeSql(id)}', '${escapeSql(package_id)}', '${escapeSql(decision)}', '${escapeSql(feedback || '')}', 
      '${escapeSql(reviewed_by)}', '${escapeSql(reviewed_at)}'
    )`;
    await runQuery(sql);
    return approval;
  }
};
