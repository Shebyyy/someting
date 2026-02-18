// JWT utilities for Commentum Shelby
// Generate and verify JWT tokens with user information and role

import { create } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

export interface JWTPayload {
  user_id: string;
  username: string;
  client_type: string;
  role: string; // 'user', 'moderator', 'admin', 'super_admin'
  iat?: number;
}

/**
 * Generate a JWT token for the user
 * Token never expires (until user re-authenticates)
 */
export async function generateJWT(payload: JWTPayload): Promise<string> {
  const secret = Deno.env.get('JWT_SECRET');

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  // Token never expires - user must re-login to refresh role
  const jwtPayload = {
    user_id: payload.user_id,
    username: payload.username,
    client_type: payload.client_type,
    role: payload.role,
    iat: Math.floor(Date.now() / 1000),
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const token = await create(header, jwtPayload, secret);

  return token;
}

/**
 * Verify and decode a JWT token
 * Returns the payload if valid, null if invalid
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const secret = Deno.env.get('JWT_SECRET');

    if (!secret) {
      console.error('JWT_SECRET environment variable is not set');
      return null;
    }

    // Use verifyToken function to verify signature
    const payload = await verifyToken(token, secret);

    if (!payload) {
      return null;
    }

    return payload as JWTPayload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Internal verify function
 */
async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    // Split token into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (Base64URL)
    const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadStr);

    // Verify signature
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    const signature = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signature,
      data
    );

    if (!isValid) {
      return null;
    }

    return {
      user_id: payload.user_id,
      username: payload.username,
      client_type: payload.client_type,
      role: payload.role,
      iat: payload.iat,
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Get user role from mod_plus table (NOT from environment variables)
 * Requires Supabase client to query database
 * This is exported for use by other functions
 */
export async function getUserRoleFromDB(supabase: any, userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('mod_plus')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (error) {
      // If no record found, return 'user'
      if (error.code === 'PGRST116') {
        return 'user';
      }
      console.error('Error fetching user role:', error);
      return 'user';
    }

    return data?.role || 'user';
  } catch (error) {
    console.error('Error in getUserRoleFromDB:', error);
    return 'user';
  }
}
