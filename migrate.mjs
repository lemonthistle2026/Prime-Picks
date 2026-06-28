import fs from 'fs/promises';
import { db } from './db.mjs';

async function migrate() {
  try {
    const productsData = JSON.parse(await fs.readFile('./data/products.json', 'utf8'));
    const packagesData = JSON.parse(await fs.readFile('./data/packages.json', 'utf8'));

    console.log(`Migrating ${productsData.length} products...`);
    for (const p of productsData) {
      const price = parseFloat(p.price.replace(/[^0-9.]/g, ''));
      await db.createProduct({
        id: p.id,
        asin: p.asin,
        name: p.name,
        brand: '',
        category: p.category,
        price: isNaN(price) ? 0 : price,
        features: p.features,
        description: p.description,
        image_urls: p.imageUrls,
        customer_feedback: { themes: p.customerFeedbackThemes },
        target_audience: p.targetAudience,
        seo_keywords: p.seoKeywords.split(',').map(s => s.trim()),
        affiliate_link: '',
        created_at: p.createdAt
      });
    }

    console.log(`Migrating ${packagesData.length} packages...`);
    for (const pkg of packagesData) {
      await db.createPackage({
        id: pkg.id,
        product_id: pkg.product_id,
        status: pkg.status,
        package_json: pkg.content,
        compliance_pass: pkg.compliance_pass,
        missing_inputs: [],
        created_by: 'generator',
        created_at: pkg.created_at
      });
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

migrate();
