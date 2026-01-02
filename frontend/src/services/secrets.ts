/**
 * AWS Secrets Manager Service
 * 
 * Use this service to retrieve secrets from AWS Secrets Manager.
 * 
 * ⚠️ IMPORTANT SECURITY NOTE:
 * This service should ONLY be used in backend/server-side code:
 * - Node.js Lambda functions
 * - Backend API servers (Express, Fastify, etc.)
 * - Server-side rendering (SSR)
 * 
 * ❌ NEVER use this in frontend/browser code as it requires AWS credentials
 * which should never be exposed to the client.
 * 
 * The AWS SDK will automatically use credentials from:
 * - IAM role (when running in Lambda or EC2)
 * - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * - AWS credentials file (~/.aws/credentials)
 * - IAM instance profile (when running on EC2)
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const secret_name = "prolink/oauth/secrets";

// Initialize the Secrets Manager client
const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || "us-east-1",
});

// Type definitions for OAuth secrets
export interface OAuthSecrets {
  google_client_secret: string;
  linkedin_client_secret: string;
}

/**
 * Retrieves OAuth secrets from AWS Secrets Manager
 * @returns Promise<OAuthSecrets> - The OAuth client secrets
 * @throws Error if secret retrieval fails
 */
export async function getOAuthSecrets(): Promise<OAuthSecrets> {
  let response;

  try {
    response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
      })
    );
  } catch (error) {
    // For a list of exceptions thrown, see
    // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
    console.error("Error retrieving secret from AWS Secrets Manager:", error);
    throw error;
  }

  const secret = response.SecretString;

  if (!secret) {
    throw new Error("Secret string is empty or undefined");
  }

  try {
    const secrets: OAuthSecrets = JSON.parse(secret);
    
    // Validate that required secrets are present
    if (!secrets.google_client_secret || !secrets.linkedin_client_secret) {
      throw new Error("Missing required OAuth secrets in secret value");
    }

    return secrets;
  } catch (parseError) {
    console.error("Error parsing secret JSON:", parseError);
    throw new Error("Failed to parse secret JSON");
  }
}

/**
 * Retrieves a specific secret value by key
 * @param key - The key of the secret to retrieve (e.g., "google_client_secret")
 * @returns Promise<string> - The secret value
 */
export async function getSecretValue(key: keyof OAuthSecrets): Promise<string> {
  const secrets = await getOAuthSecrets();
  return secrets[key];
}

/**
 * Cached secrets (optional - for performance if secrets don't change often)
 * Remove this if you want to always fetch fresh secrets
 */
let cachedSecrets: OAuthSecrets | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Gets OAuth secrets with caching
 * @param forceRefresh - Force refresh the cache
 * @returns Promise<OAuthSecrets>
 */
export async function getOAuthSecretsCached(forceRefresh: boolean = false): Promise<OAuthSecrets> {
  const now = Date.now();
  
  if (!forceRefresh && cachedSecrets && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSecrets;
  }

  const secrets = await getOAuthSecrets();
  cachedSecrets = secrets;
  cacheTimestamp = now;
  
  return secrets;
}

