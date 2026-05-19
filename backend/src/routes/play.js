import crypto from 'node:crypto';

import express from 'express';

import {
  GOOGLE_PLAY_PACKAGE_NAME,
  GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY,
  configError,
  hasGooglePlayConfig,
} from '../config.js';
import { findCurrencyPack } from '../catalog.js';
import {
  applyCurrencyPurchase,
  isCurrencyPurchaseServiceConfigured,
} from '../services/currencyPurchases.js';

const router = express.Router();

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_PLAY_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function base64UrlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createServiceAccountAssertion() {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  const claims = {
    iss: GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,
    scope: GOOGLE_PLAY_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(claims)
  )}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY);
  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function getGooglePlayAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessTokenExpiresAt - 60_000 > now) {
    return cachedAccessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: createServiceAccountAssertion(),
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Unable to authenticate with Google Play.');
  }

  cachedAccessToken = data.access_token;
  cachedAccessTokenExpiresAt = now + Number(data.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

async function googlePlayRequest(path, { method = 'GET', body } = {}) {
  const accessToken = await getGooglePlayAccessToken();
  const response = await fetch(`https://androidpublisher.googleapis.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }
  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.error_description ||
      text ||
      `Google Play API request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

function buildPurchasePath(productId, purchaseToken) {
  const packageName = encodeURIComponent(GOOGLE_PLAY_PACKAGE_NAME);
  const encodedProductId = encodeURIComponent(productId);
  const encodedPurchaseToken = encodeURIComponent(purchaseToken);

  return `/androidpublisher/v3/applications/${packageName}/purchases/products/${encodedProductId}/tokens/${encodedPurchaseToken}`;
}

async function fetchGooglePlayPurchase(productId, purchaseToken) {
  return googlePlayRequest(buildPurchasePath(productId, purchaseToken));
}

async function consumeGooglePlayPurchase(productId, purchaseToken) {
  return googlePlayRequest(`${buildPurchasePath(productId, purchaseToken)}:consume`, {
    method: 'POST',
    body: {},
  });
}

router.post('/verify-product-purchase', async (req, res) => {
  if (!hasGooglePlayConfig || !isCurrencyPurchaseServiceConfigured()) {
    return res
      .status(503)
      .json(configError('Google Play purchase verification is not configured for this installation.'));
  }

  const {
    userId,
    currencyType,
    packId,
    productId,
    purchaseToken,
    obfuscatedAccountId,
  } = req.body;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing userId' });
  }

  if (!['coins', 'diamonds'].includes(currencyType)) {
    return res.status(400).json({ error: 'Invalid or missing currencyType' });
  }

  if (!packId || typeof packId !== 'string') {
    return res.status(400).json({ error: 'Missing packId' });
  }

  if (!productId || typeof productId !== 'string') {
    return res.status(400).json({ error: 'Missing productId' });
  }

  if (!purchaseToken || typeof purchaseToken !== 'string') {
    return res.status(400).json({ error: 'Missing purchaseToken' });
  }

  const pack = findCurrencyPack(currencyType, packId);
  if (!pack) {
    return res.status(400).json({ error: 'Unknown currency pack' });
  }

  try {
    const purchase = await fetchGooglePlayPurchase(productId, purchaseToken);

    if (purchase.purchaseState === 2) {
      return res.status(409).json({
        error: 'Google Play purchase is still pending.',
        purchaseState: purchase.purchaseState,
      });
    }

    if (purchase.purchaseState !== 0) {
      return res.status(409).json({
        error: 'Google Play purchase is not in a purchased state.',
        purchaseState: purchase.purchaseState,
      });
    }

    if (
      obfuscatedAccountId &&
      purchase.obfuscatedExternalAccountId &&
      purchase.obfuscatedExternalAccountId !== obfuscatedAccountId
    ) {
      return res.status(409).json({
        error: 'Google Play account binding does not match the signed-in user.',
      });
    }

    const unitQuantity = currencyType === 'diamonds' ? pack.diamonds : pack.coins;
    const purchaseQuantity = Math.max(1, Number(purchase.quantity || 1));
    const grantQuantity = unitQuantity * purchaseQuantity;

    const result = await applyCurrencyPurchase({
      userId,
      currencyType,
      quantity: grantQuantity,
      source: 'google-play',
      referenceId: purchaseToken,
      orderId: purchase.orderId || null,
      metadata: {
        productId,
        purchaseToken,
        googlePlayQuantity: purchaseQuantity,
        obfuscatedExternalAccountId: purchase.obfuscatedExternalAccountId || null,
      },
    });

    let consumed = Number(purchase.consumptionState || 0) === 1;
    if (!consumed) {
      await consumeGooglePlayPurchase(productId, purchaseToken);
      consumed = true;
    }

    return res.json({
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
      balance: result.balance,
      consumed,
      orderId: purchase.orderId || null,
    });
  } catch (error) {
    console.error('Google Play purchase verification error:', error);
    return res.status(500).json({
      error: 'Google Play purchase verification failed',
      message: error?.message || 'Unable to verify Google Play purchase.',
    });
  }
});

export default router;
