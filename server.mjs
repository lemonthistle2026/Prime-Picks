import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.mjs';
import { fetchProductWithConfig } from './creators-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// Helper to format product for frontend
function formatProduct(p) {
  if (!p) return null;
  const customerFeedback = p.customer_feedback ? JSON.parse(p.customer_feedback) : { themes: [] };
  const themes = Array.isArray(customerFeedback.themes) ? customerFeedback.themes.join(', ') : (customerFeedback.themes || '');
  
  return {
    ...p,
    features: JSON.parse(p.features || '[]'),
    imageUrls: JSON.parse(p.image_urls || '[]'),
    customerFeedbackThemes: themes,
    targetAudience: p.target_audience,
    seoKeywords: JSON.parse(p.seo_keywords || '[]').join(', '),
    createdAt: p.created_at
  };
}

// Helper to format package for frontend
function safeParseJson(val, fallback = {}) {
  if (!val) return fallback;
  // Handle double-stringified JSON
  let parsed = val;
  try {
    parsed = JSON.parse(val);
  } catch {
    return fallback;
  }
  // If it's still a string, parse again (double-serialized)
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return fallback;
    }
  }
  return parsed;
}

function formatPackage(pkg) {
  if (!pkg) return null;
  return {
    ...pkg,
    content: safeParseJson(pkg.package_json, {}),
    compliance_pass: pkg.compliance_pass === 1,
    missing_inputs: safeParseJson(pkg.missing_inputs, [])
  };
}

// Helper to enrich product data with Creators API
async function enrichProductData(userData) {
  const { asin } = userData;
  let liveData = {};
  
  if (asin) {
    try {
      console.log(`Fetching live data for ASIN: ${asin}`);
      liveData = await fetchProductWithConfig(asin);
    } catch (err) {
      console.error(`Creators API error for ASIN ${asin}:`, err.message);
      // Continue with user data if API fails, but maybe log it
    }
  }

  const affiliateLink = asin ? `https://www.amazon.com/dp/${asin}?tag=thebibman-20` : '';

  // Process customer feedback themes into an array
  const themes = userData.customerFeedbackThemes 
    ? userData.customerFeedbackThemes.split(',').map(s => s.trim()).filter(Boolean)
    : (liveData.customer_feedback_themes || []);

  return {
    asin: asin || '',
    name: userData.name || liveData.name || '',
    brand: userData.brand || liveData.brand || '',
    category: userData.category || liveData.category || '',
    price: userData.price || liveData.price || 0,
    features: userData.features && userData.features.length > 0 ? userData.features : (liveData.features || []),
    description: userData.description || liveData.description || '',
    image_urls: userData.imageUrls && userData.imageUrls.length > 0 ? userData.imageUrls : (liveData.imageUrls || []),
    customer_feedback: { themes },
    target_audience: userData.targetAudience || '',
    seo_keywords: (userData.seoKeywords || '').split(',').map(s => s.trim()).filter(Boolean),
    affiliate_link: userData.affiliate_link || liveData.affiliateLink || affiliateLink,
    created_at: new Date().toISOString()
  };
}

// Helper to convert simple markdown to HTML
function mdToHtml(md) {
  if (!md) return '';
  
  let html = md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/\n/gim, '<br />');

  // Handle lists more cleanly
  // This is a simple hack to wrap consecutive <li> lines in <ul>
  html = html.replace(/^[\*-] (.*$)/gim, '<li>$1</li>');
  
  return html;
}

// Layout helper
function layout(title, content, meta = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${meta}
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <header>
        <div class="container">
            <a href="/p" style="text-decoration: none; color: inherit;">
              <h1>Prime Picks</h1>
              <p>Smart Amazon finds, handpicked for you</p>
            </a>
        </div>
    </header>
    
    <main class="container">
        ${content}
    </main>

    <footer class="footer container">
        <p>&copy; ${new Date().getFullYear()} Prime Picks. All rights reserved.</p>
        <p class="disclosure">As an Amazon Associate, I earn from qualifying purchases. Prime Picks is a participant in the Amazon Services LLC Associates Program.</p>
    </footer>
</body>
</html>
  `;
}

// API Endpoints
app.use(express.static(path.join(__dirname, 'public')));

// Public Website Routes
app.get('/p', async (req, res) => {
  try {
    const packages = await db.getPackages();
    const approvedPackages = packages.filter(p => p.status === 'approved');
    
    const content = `
      <h2 class="section-title">Latest Smart Finds</h2>
      <div class="product-list">
        ${approvedPackages.map(p => `
          <a href="/p/${p.id}" class="product-list-item">
            <img src="${(safeParseJson(p.package_json, {}).mainImageUrl || '')}" alt="${p.product_name}">
            <div>
              <div style="font-weight: bold; font-size: 18px;">${p.product_name}</div>
              <div style="color: #666; font-size: 14px;">${(safeParseJson(p.package_json, {}).product_overview?.substring(0, 100) || '')}...</div>
            </div>
          </a>
        `).join('')}
      </div>
      ${approvedPackages.length === 0 ? '<p>No products published yet. Check back soon!</p>' : ''}
    `;
    
    res.send(layout('Prime Picks — Smart Amazon finds, handpicked for you', content));
  } catch (err) {
    res.status(500).send('Error loading page');
  }
});

app.get('/p/:id', async (req, res) => {
  try {
    const pkg = await db.getPackage(req.params.id);
    if (!pkg || pkg.status !== 'approved') {
      return res.status(404).send('Product not found');
    }
    
    const content = safeParseJson(pkg.package_json, {});
    const product = await db.getProduct(pkg.product_id);
    
    const meta = `
      <meta name="description" content="${content.seo_title_meta?.meta_description || ''}">
      <meta property="og:title" content="${content.seo_title_meta?.title || pkg.product_name}">
      <meta property="og:description" content="${content.seo_title_meta?.meta_description || ''}">
      <meta property="og:image" content="${content.mainImageUrl || ''}">
      <meta property="og:type" content="product">
    `;

    const htmlContent = `
      <div class="product-card">
        <h1 class="product-title">${pkg.product_name}</h1>
        <div class="price-tag">Check Price on Amazon</div>
        
        <div class="image-gallery">
          ${(product.image_urls ? JSON.parse(product.image_urls) : []).map(url => `<img src="${url}" alt="${pkg.product_name}">`).join('')}
        </div>

        <div class="product-overview">
          ${mdToHtml(content.product_overview)}
        </div>

        <a href="${product.affiliate_link}" class="amazon-button" target="_blank" rel="noopener noreferrer">
          Check Price on Amazon
        </a>

        <h2 class="section-title">Key Features</h2>
        <ul class="features-list">
          ${(content.key_features || []).map(f => `<li>${f}</li>`).join('')}
        </ul>

        <div class="feedback-summary">
          <h2 class="section-title" style="margin-top: 0; border: none;">What customers commonly say</h2>
          <p>${content.customer_feedback_summary}</p>
        </div>

        <div style="display: flex; gap: 40px; margin-top: 30px;">
          <div style="flex: 1;">
            <h3 class="pros">Pros</h3>
            <ul class="pros-cons">
              ${(content.pros_and_cons?.pros || []).map(p => `<li>${p}</li>`).join('')}
            </ul>
          </div>
          <div style="flex: 1;">
            <h3 class="cons">Cons</h3>
            <ul class="pros-cons">
              ${(content.pros_and_cons?.cons || []).map(c => `<li>${c}</li>`).join('')}
            </ul>
          </div>
        </div>

        <h2 class="section-title">Detailed Review</h2>
        <div class="product-copy">
          ${mdToHtml(content.product_page_copy)}
        </div>

        <h2 class="section-title">Frequently Asked Questions</h2>
        <div class="faq-list">
          ${(content.faq || []).map(item => `
            <div class="faq-item">
              <div class="faq-question">${item.question}</div>
              <div class="faq-answer">${item.answer}</div>
            </div>
          `).join('')}
        </div>

        <a href="${product.affiliate_link}" class="amazon-button" target="_blank" rel="noopener noreferrer">
          View "${pkg.product_name}" on Amazon
        </a>
      </div>
    `;

    res.send(layout(content.seo_title_meta?.title || pkg.product_name, htmlContent, meta));
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading product page');
  }
});
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.getProducts();
    res.json(products.map(formatProduct));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const id = `prod_${Date.now()}`;
    const enrichedData = await enrichProductData(req.body);
    const newProduct = {
      ...enrichedData,
      id
    };
    await db.createProduct(newProduct);
    
    // Fetch from DB to ensure we have the correct format for formatProduct
    const createdProduct = await db.getProduct(id);
    res.status(201).json(formatProduct(createdProduct));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products/with-generation', async (req, res) => {
  try {
    const timestamp = Date.now();
    const productId = `prod_${timestamp}`;
    const packageId = `pkg_${timestamp}`;
    const taskId = `cg_${timestamp}`;

    const enrichedData = await enrichProductData(req.body);
    const newProduct = {
      ...enrichedData,
      id: productId
    };
    await db.createProduct(newProduct);

    // Create a draft package
    await db.createPackage({
      id: packageId,
      product_id: productId,
      status: 'draft',
      package_json: {},
      compliance_pass: false,
      missing_inputs: [],
      created_by: 'system',
      created_at: new Date().toISOString()
    });

    // Create a task for the Content Generator
    await db.createTask({
      id: taskId,
      title: `Generate content for ${newProduct.name}`,
      description: JSON.stringify({
        product_id: productId,
        package_id: packageId,
        product_name: newProduct.name,
        asin: newProduct.asin,
        description: newProduct.description,
        features: newProduct.features,
        customer_feedback_themes: newProduct.customer_feedback.themes,
        target_audience: newProduct.target_audience,
        seo_keywords: newProduct.seo_keywords
      }),
      status: 'backlog',
      assigned_to: 'agent-content-generator',
      created_by: 'system',
      created_at: new Date().toISOString()
    });

    const createdProduct = await db.getProduct(productId);
    res.status(201).json({
      product: formatProduct(createdProduct),
      package_id: packageId,
      task_id: taskId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/packages', async (req, res) => {
  try {
    const packages = await db.getPackages();
    res.json(packages.map(formatPackage));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/packages/:id', async (req, res) => {
  try {
    const pkg = await db.getPackage(req.params.id);
    if (pkg) {
      res.json(formatPackage(pkg));
    } else {
      res.status(404).json({ error: 'Package not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/packages/:id', async (req, res) => {
  try {
    const updates = {
      ...req.body,
      reviewed_at: new Date().toISOString()
    };
    
    // If it's an approval/rejection, create an entry in approvals table too
    if (req.body.status === 'approved' || req.body.status === 'rejected' || req.body.revision_feedback) {
      const decision = req.body.status === 'approved' ? 'approved' : 
                       req.body.status === 'rejected' ? 'rejected' : 'revision_requested';
      
      await db.createApproval({
        id: `appr_${Date.now()}`,
        package_id: req.params.id,
        decision,
        feedback: req.body.revision_feedback || '',
        reviewed_by: 'owner', // Default for now
        reviewed_at: new Date().toISOString()
      });
    }

    await db.updatePackage(req.params.id, updates);
    const updatedPkg = await db.getPackage(req.params.id);
    res.json(formatPackage(updatedPkg));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/packages/generate', async (req, res) => {
  try {
    const { task_id, package_id, package_json, compliance_pass, missing_inputs } = req.body;

    const status = compliance_pass ? 'approved' : 'review';
    
    await db.updatePackage(package_id, {
      status,
      package_json,
      compliance_pass,
      missing_inputs
    });

    if (compliance_pass) {
      await db.createApproval({
        id: `appr_${Date.now()}`,
        package_id,
        decision: 'auto_approved',
        feedback: 'Auto-approved: all compliance checks passed.',
        reviewed_by: 'system',
        reviewed_at: new Date().toISOString()
      });
      await db.updateTaskStatus(task_id, 'done');
    } else {
      await db.updateTaskStatus(task_id, 'review');
    }

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
