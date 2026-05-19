import { isIosAppStoreBuild } from './releaseConfig';

export function getApiBaseUrl() {
  const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBase) return configuredBase;

  if (isIosAppStoreBuild) {
    return '';
  }

  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:3000/api';
  }

  const { hostname, origin } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:3000/api';
  }

  return `${origin}/api`;
}

export function hasApiBaseUrl() {
  return Boolean(getApiBaseUrl());
}
