// JWT utilities for Commentum Shelby
// Generate and verify JWT tokens with user information and role

import { create, verify, Algorithm, Header, Payload } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

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
  const jwtPayload: Payload = {
    user_id: payload.user_id,
    username: payload.username,
    client_type: payload.client_type,
    role: payload.role,
    iat: Math.floor(Date.now() / 1000),
  };

  const header: Header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  // Use HS256 algorithm directly with the secret as string
  const algorithm: Algorithm = 'HS256';
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

    // Use HS256 algorithm directly with the secret as string
    const algorithm: Algorithm = 'HS256';
    const payload = await verify(token, secret, algorithm);

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
