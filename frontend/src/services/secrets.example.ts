/**
 * Example usage of the secrets service
 * 
 * IMPORTANT: This service should ONLY be used in backend/server-side code:
 * - Node.js Lambda functions
 * - Backend API servers
 * - Server-side rendering (SSR)
 * 
 * NEVER use this in frontend/browser code as it requires AWS credentials
 */

import { getOAuthSecrets, getSecretValue, getOAuthSecretsCached } from './secrets';

// Example 1: Get all OAuth secrets
async function example1() {
  try {
    const secrets = await getOAuthSecrets();
    console.log('Google Client Secret:', secrets.google_client_secret);
    console.log('LinkedIn Client Secret:', secrets.linkedin_client_secret);
    
    // Use the secrets in your application
    // For example, configure OAuth providers
  } catch (error) {
    console.error('Failed to retrieve secrets:', error);
  }
}

// Example 2: Get a specific secret value
async function example2() {
  try {
    const googleSecret = await getSecretValue('google_client_secret');
    console.log('Google Secret:', googleSecret);
    
    // Use the secret
  } catch (error) {
    console.error('Failed to retrieve secret:', error);
  }
}

// Example 3: Use cached secrets (for better performance)
async function example3() {
  try {
    // First call - fetches from AWS
    const secrets1 = await getOAuthSecretsCached();
    
    // Second call within 5 minutes - returns cached value
    const secrets2 = await getOAuthSecretsCached();
    
    // Force refresh
    const secrets3 = await getOAuthSecretsCached(true);
  } catch (error) {
    console.error('Failed to retrieve secrets:', error);
  }
}

// Example 4: Use in a Lambda function handler
export const handler = async (event: unknown) => {
  try {
    // Retrieve secrets
    const secrets = await getOAuthSecrets();
    
    // Use secrets in your Lambda logic
    // For example, validate OAuth tokens, make API calls, etc.
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Secrets retrieved successfully' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to retrieve secrets' }),
    };
  }
};

// Example 5: Use in an Express.js API endpoint
/*
import express from 'express';
const app = express();

app.get('/api/config/oauth', async (req, res) => {
  try {
    const secrets = await getOAuthSecrets();
    // Return only what's needed (never return full secrets to frontend!)
    res.json({ 
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      linkedinClientId: process.env.LINKEDIN_CLIENT_ID,
      // Don't send secrets to frontend!
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load OAuth configuration' });
  }
});
*/

