/**
 * creators-api.mjs
 * Amazon Creators API v3.1 client for fetching live product data.
 * 
 * Uses OAuth 2.0 Client Credentials grant to authenticate.
 * Store credentials securely in the config table.
 */

const TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const API_BASE = 'https://creators-api.amazon.com';

/**
 * Get an OAuth access token from Amazon using client credentials.
 */
async function getAccessToken(clientId, clientSecret) {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'creators_api'
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Fetch product data from Creators API by ASIN.
 * Returns a normalized product object.
 */
export async function fetchProductByAsin(asin, tag, region = 'US', clientId, clientSecret) {
  const token = await getAccessToken(clientId, clientSecret);

  const url = `${API_BASE}/product/v3.1/${asin}?region=${region}&tag=${tag}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Product fetch failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  // Normalize the API response to our format
  return normalizeProductData(data, asin, tag);
}

/**
 * Normalize Creators API response into our internal product format.
 * The exact response shape depends on the Creators API v3.1 spec.
 */
function normalizeProductData(raw, asin, tag) {
  const product = raw.product || raw;
  
  // Build affiliate link
  const affiliateLink = `https://www.amazon.com/dp/${asin}?tag=${tag}`;

  return {
    asin: asin,
    name: product.title || product.name || '',
    brand: product.brand || '',
    category: product.category || (product.categories ? product.categories[0] : ''),
    price: product.price?.amount || product.price || product.listPrice?.amount || 0,
    currency: product.price?.currency || 'USD',
    features: product.features || product.bulletPoints || [],
    description: product.description || product.productDescription || '',
    imageUrls: extractImageUrls(product),
    mainImageUrl: product.mainImage?.url || product.imageUrl || product.images?.[0]?.url || '',
    manufacturer: product.manufacturer || '',
    affiliateLink: affiliateLink,
    raw: product // Keep raw for future field extraction
  };
}

/**
 * Extract all available image URLs from the API response.
 */
function extractImageUrls(product) {
  const urls = [];
  
  if (product.mainImage?.url) urls.push(product.mainImage.url);
  if (product.imageUrl) urls.push(product.imageUrl);
  
  if (product.images && Array.isArray(product.images)) {
    product.images.forEach(img => {
      if (img.url && !urls.includes(img.url)) urls.push(img.url);
    });
  }
  
  if (product.variantImages && Array.isArray(product.variantImages)) {
    product.variantImages.forEach(img => {
      if (img.url && !urls.includes(img.url)) urls.push(img.url);
    });
  }
  
  return urls;
}

/**
 * Fetches product data for multiple ASINs in batch.
 */
export async function fetchProductsBatch(asinList, tag, region, clientId, clientSecret) {
  const results = [];
  for (const asin of asinList) {
    try {
      const data = await fetchProductByAsin(asin, tag, region, clientId, clientSecret);
      results.push(data);
    } catch (err) {
      console.error(`Failed to fetch ASIN ${asin}:`, err.message);
      results.push({ asin, error: err.message });
    }
  }
  return results;
}

/**
 * Fetches product data using credentials from the config table.
 * This is the main entry point for pipeline integration.
 */
export async function fetchProductWithConfig(asin) {
  const { execSync } = await import('child_process');
  
  function db(query) {
    const output = execSync(`team-db "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' });
    return JSON.parse(output);
  }

  const configs = db("SELECT key, value FROM config WHERE key LIKE 'creators_api_%'");
  const config = {};
  configs.forEach(c => { config[c.key] = c.value; });

  const clientId = config['creators_api_client_id'];
  const clientSecret = config['creators_api_client_secret'];
  const tag = config['creators_api_tag'];
  const region = config['creators_api_region'] || 'US';

  if (!clientId || !clientSecret || !tag) {
    throw new Error('Creators API not configured. Set creators_api_client_id, creators_api_client_secret, and creators_api_tag in config table.');
  }

  return await fetchProductByAsin(asin, tag, region, clientId, clientSecret);
}

// CLI usage: node creators-api.mjs <ASIN>
if (process.argv[1] && process.argv[1].includes('creators-api.mjs')) {
  const asin = process.argv[2];
  if (!asin) {
    console.error('Usage: node creators-api.mjs <ASIN>');
    process.exit(1);
  }
  fetchProductWithConfig(asin)
    .then(data => {
      console.log(JSON.stringify(data, null, 2));
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}
