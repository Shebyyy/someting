import { create, verify, Algorithm, Header, Payload } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

export interface JWTPayload {
  user_id: string;
  username: string;
  client_type: string;
  role: string;
  iat?: number;
}

async function getKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function generateJWT(payload: JWTPayload): Promise<string> {
  const secret = Deno.env.get('JWT_SECRET');
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');

  const key = await getKey(secret);

  const jwtPayload: Payload = {
    user_id: payload.user_id,
    username: payload.username,
    client_type: payload.client_type,
    role: payload.role,
    iat: Math.floor(Date.now() / 1000),
  };

  const header: Header = { alg: 'HS256', typ: 'JWT' };

  return await create(header, jwtPayload, key);
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const secret = Deno.env.get('JWT_SECRET');
    if (!secret) {
      console.error('JWT_SECRET environment variable is not set');
      return null;
    }

    const key = await getKey(secret);
    const payload = await verify(token, key);

    if (!payload) return null;
    return payload as JWTPayload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

export async function getUserRoleFromDB(supabase: any, userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('mod_plus')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return 'user';
      console.error('Error fetching user role:', error);
      return 'user';
    }

    return data?.role || 'user';
  } catch (error) {
    console.error('Error in getUserRoleFromDB:', error);
    return 'user';
  }
}
