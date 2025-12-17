// --- OmniGraph DSI Engine Backend Blueprint ---
// This is a minimal, runnable blueprint for the Decoupled Schema Injection (DSI) server.
// It uses Express for handling HTTP requests and includes placeholder logic for security,
// rule fetching, and conditional schema processing.

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// --- CONFIGURATION (Environment Variables in production) ---
// NOTE: In a real environment, these would be loaded securely via environment variables.
const SHOPIFY_WEBHOOK_SECRET = "shhhhhh_this_is_a_secret_key";
const DSI_API_KEY = "dsi_api_key_for_client_requests";
const FIRESTORE_MOCK_DB = {
    // Mock data structure retrieved from the Admin UI's Firestore document
    'default-app-id': {
        // Mock of the JSON-LD template (from the admin app)
        jsonLdTemplate: `{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "[product.title]",
  "description": "A fully customized, SEO-optimized product.",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "USD",
    "price": "[current_price]"
  },
  "identifier": "[product.metafields.custom.isbn]",
  "_comment_id_1": "// Mapped via OmniGraph Node ID 1",
  "review": { 
    "@type": "AggregateRating",
    "ratingValue_Rule": "IF (review_count > 5 AND average_rating > 4.5 END) THEN [average_rating] ELSE [NULL]"
  },
  "_comment_rule_2": "// Mapped to review with 2 condition(s)."
}`,
        // Mock of the raw rules structure (from the admin app, typically parsed for use)
        mappings: JSON.stringify([
            { id: 1, source: 'product.metafields.custom.isbn', target: 'identifier', type: 'Text', conditions: [] },
            { id: 2, source: 'average_rating', target: 'review', type: 'Condition', conditions: [
                { field: 'review_count', operator: '>', value: 5, logic: 'AND' },
                { field: 'average_rating', operator: '>', value: 4.5, logic: 'END' }
            ]}
        ])
    }
};


// --- CORE LOGIC: DSI PROCESSOR ---

/**
 * 1. Executes a single conditional rule against the data map.
 * (This is a simplified implementation of the complex conditional engine.)
 * @param {string} field - The data path (e.g., 'review_count').
 * @param {string} operator - The operator (e.g., '>').
 * @param {string} value - The comparison value (e.g., '5').
 * @param {object} data - The complete product data map.
 * @returns {boolean} - True if the condition is met.
 */
function evaluateCondition(field, operator, value, data) {
    // Simple mock evaluation: assumes field names match data keys directly for blueprint
    const dataValue = data[field];

    if (dataValue === undefined) return false;

    switch (operator) {
        case '>':
            return parseFloat(dataValue) > parseFloat(value);
        case '<':
            return parseFloat(dataValue) < parseFloat(value);
        case '==':
            return String(dataValue) === String(value);
        // ... more operators (!=, contains, is empty)
        default:
            return false;
    }
}

/**
 * 2. Processes the JSON-LD template using the product data and complex conditional rules.
 * @param {object} data - The product data map from the Shopify storefront.
 * @param {object} rulesData - The configuration object containing jsonLdTemplate and mappings.
 * @returns {string} - The final, processed JSON-LD string.
 */
function processDsiSchema(data, rulesData) {
    let jsonString = rulesData.jsonLdTemplate;
    const mappings = JSON.parse(rulesData.mappings);
    const finalSchema = JSON.parse(jsonString);

    // --- A. Process Simple Placeholders ---
    // Substitute all placeholders like [current_price] with actual data
    for (const key in finalSchema) {
        let value = finalSchema[key];

        if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
            const sourceKey = value.slice(1, -1);
            if (data[sourceKey] !== undefined) {
                finalSchema[key] = data[sourceKey];
            } else {
                // Remove the property if source data is missing
                delete finalSchema[key];
            }
        }
    }


    // --- B. Process Conditional Rules (DSI Logic) ---
    // Focus on the complex 'review' example
    if (finalSchema.review && finalSchema.review.ratingValue_Rule) {
        const mapping = mappings.find(m => m.target === 'review' && m.type === 'Condition');
        
        if (mapping && mapping.conditions && mapping.conditions.length > 0) {
            let isMet = true;
            for (const condition of mapping.conditions) {
                const result = evaluateCondition(condition.field, condition.operator, condition.value, data);
                // For simplicity, we are assuming all conditions are joined by AND (as per the blueprint design)
                if (!result) {
                    isMet = false;
                    break;
                }
            }

            // Apply the result
            if (isMet) {
                const source = mapping.source; // e.g., 'average_rating'
                finalSchema.review.ratingValue = data[source] || '5.0'; // Inject actual value
            } else {
                // If conditions are not met, delete the entire review object
                delete finalSchema.review; 
            }
        }
        
        // Clean up the proprietary rule key
        if (finalSchema.review) {
            delete finalSchema.review.ratingValue_Rule;
        }
    }

    // Remove comments before final output
    for (const key in finalSchema) {
        if (key.startsWith('_comment')) {
            delete finalSchema[key];
        }
    }

    return JSON.stringify(finalSchema, null, 2);
}

// --- ENDPOINTS ---

/**
 * Endpoint for the Shopify Storefront Loader to request the final Schema.
 * It's crucial to protect this endpoint with an API key/token.
 * Request body structure: { appId: string, productData: object }
 */
app.post('/api/dsi/schema', async (req, res) => {
    // 1. API Key Validation (Security)
    const clientApiKey = req.headers['x-dsi-api-key'];
    if (clientApiKey !== DSI_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }

    const { appId, productData } = req.body;
    if (!appId || !productData) {
        return res.status(400).json({ error: 'Missing required parameters (appId or productData)' });
    }

    // 2. Fetch Rules (Mocked from a centralized data store like Firestore)
    // NOTE: In production, this would be a real Firestore/database lookup
    const rulesData = FIRESTORE_MOCK_DB[appId] || FIRESTORE_MOCK_DB['default-app-id']; 
    if (!rulesData) {
        // Fallback or use a generic template if rules are not found
        console.warn(`Rules not found for App ID: ${appId}`);
        return res.status(404).json({ error: 'Mapping rules not deployed for this app.' });
    }

    try {
        // 3. Process Schema (The core DSI logic)
        const finalJsonLd = processDsiSchema(productData, rulesData);
        
        // 4. Respond with the final, optimized Schema
        res.json({ 
            schema: finalJsonLd,
            timestamp: new Date().toISOString()
        });

    } catch (e) {
        console.error('DSI Processing Error:', e);
        res.status(500).json({ error: 'Internal DSI processing failed.' });
    }
});


/**
 * Endpoint for Shopify webhooks (e.g., product creation/update).
 * This is where the Admin UI would notify the DSI engine of rule changes.
 * The primary purpose here is security validation (signature check).
 */
app.post('/webhook/rules_update', (req, res) => {
    // 1. Signature Verification (CRITICAL SECURITY STEP)
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const body = JSON.stringify(req.body); // Use raw body buffer in production

    const generatedHash = crypto
        .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
        .update(body)
        .digest('base64');

    if (generatedHash !== hmac) {
        console.warn('Webhook received with invalid HMAC signature.');
        return res.status(401).send('Invalid signature.');
    }

    // 2. Process Update (Placeholder)
    // In production, this would trigger an update or cache invalidation for the rules.
    console.log(`Webhook received and validated for shop: ${req.headers['x-shopify-shop-domain']}`);

    res.status(200).send('Webhook processed successfully.');
});


// Start the server
app.listen(PORT, () => {
    console.log(`DSI Engine is running on port ${PORT}`);
    console.log(`DSI API Key is: ${DSI_API_KEY}`);
});
