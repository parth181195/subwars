import { quizAuthService } from '../services/auth';

/**
 * Get the Authorization header with Firebase ID token
 * Returns headers object with Authorization header if user is authenticated
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    // Try Firebase ID token first (new method)
    if (typeof quizAuthService.getIdToken === 'function') {
      const token = await quizAuthService.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        return headers;
      }
    }
    
    // Fallback to Supabase token (for migration period)
    const session = await quizAuthService.supabaseClient.auth.getSession();
    if (session.data.session?.access_token) {
      headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
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

