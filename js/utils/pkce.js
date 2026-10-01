/**
 * PKCE (Proof Key for Code Exchange) Utility for OAuth 2.0 SPA authentication.
 * Uses standard Web Crypto API.
 */

function getCrypto() {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is not available in this environment');
}

/**
 * Generates a random cryptographically secure string.
 * @param {number} length
 * @returns {string}
 */
export function generateRandomString(length = 64) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const cryptoObj = getCrypto();
  const values = new Uint8Array(length);
  cryptoObj.getRandomValues(values);
  return Array.from(values)
    .map((x) => possible[x % possible.length])
    .join('');
}

/**
 * Computes SHA-256 hash of a string.
 * @param {string} plain
 * @returns {Promise<ArrayBuffer>}
 */
export async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const cryptoObj = getCrypto();
  return cryptoObj.subtle.digest('SHA-256', data);
}

/**
 * Encodes an ArrayBuffer into base64url format.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export function base64urlencode(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates code_verifier and code_challenge pair for OAuth 2.0 PKCE.
 * @returns {Promise<{ codeVerifier: string, codeChallenge: string }>}
 */
export async function generatePKCE() {
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64urlencode(hashed);
  return { codeVerifier, codeChallenge };
}
