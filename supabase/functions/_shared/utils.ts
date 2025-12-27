// Shared utilities for Edge Functions

// Check if running in development mode
export const isDevelopment = Deno.env.get('DENO_ENV') === 'development';

// Allowed origins for CORS
const allowedOrigins = [
  'https://rxmsfkblfouwlfgkkndr.lovableproject.com',
  'https://lovable.dev',
];

// Get CORS headers based on origin
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // In development or if origin matches, allow the request
  if (isDevelopment || !origin) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };
  }

  // Check if origin is in allowed list or is a lovable preview URL
  const isAllowed = allowedOrigins.includes(origin) || 
    origin.endsWith('.lovableproject.com') ||
    origin.endsWith('.lovable.app');

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Create a sanitized error response
export function createErrorResponse(
  corsHeaders: Record<string, string>,
  error: unknown, 
  userMessage: string, 
  status: number = 500
): Response {
  // Log full error for debugging
  console.error('Function error:', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString()
  });

  // Return sanitized message (hide internal details)
  return new Response(JSON.stringify({ 
    error: userMessage
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
