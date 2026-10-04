import { Capacitor } from '@capacitor/core';
import { hasSupabaseConfig } from '../api/supabaseClient';
import { getApiBaseUrl, hasApiBaseUrl } from './apiBaseUrl';

function isNativePlatform() {
  return typeof Capacitor?.isNativePlatform === 'function'
    ? Capacitor.isNativePlatform()
    : false;
}

export function isGooglePlayBillingAvailable() {
  if (typeof window === 'undefined') return false;
  return isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function isIosRevenueCatAvailable() {
  if (typeof window === 'undefined') return false;
  const apiKey = String(import.meta.env.VITE_REVENUECAT_IOS_API_KEY || '').trim();
  return isNativePlatform() && Capacitor.getPlatform() === 'ios' && apiKey.length > 0;
}

export function usesStripeCheckout() {
  return !isGooglePlayBillingAvailable() && !isIosRevenueCatAvailable();
}

export function formatUsdFromCents(amount) {
  return `$${(amount / 100).toFixed(2)}`;
}

export function hasPaymentsApiBaseUrl() {
  if (isGooglePlayBillingAvailable()) {
    return Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
  }

  if (isIosRevenueCatAvailable()) {
    return true;
  }

  return hasSupabaseConfig || hasApiBaseUrl();
}
