import { adminAuthService } from '../services/auth';

/**
 * Get the Authorization header with Firebase ID token
 * Returns headers object with Authorization header if user is authenticated
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const token = await adminAuthService.getIdToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Failed to get auth token:', error);
  }

  return headers;
}

/**
 * Get auth headers for FormData requests (without Content-Type)
 */
export async function getAuthHeadersForFormData(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  try {
    const token = await adminAuthService.getIdToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Failed to get auth token:', error);
  }

  return headers;
}

/**
 * Fetch wrapper that automatically includes Authorization header
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  
  return fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });
}

/**
 * Fetch wrapper for FormData that automatically includes Authorization header
 * Does NOT set Content-Type: application/json, as FormData handles its own Content-Type
 */
export async function authenticatedFetchForFormData(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = await getAuthHeadersForFormData();
  
  return fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers, // Allow overriding or adding other headers
    },
  });
}
