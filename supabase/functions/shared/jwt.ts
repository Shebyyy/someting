// JWT utilities for Commentum Shelby
// JWT contains only identity (uid, ct) - no role
// Database is single source of truth for permissions

export interface JWTPayload {
  uid: string;  // user_id
  ct: string;   // client_type: 'al'=anilist, 'mal'=myanimelist, 'sim'=simkl, 'oth'=other
}

// Client type code mapping
export const CLIENT_CODE_MAP = {
  'anilist': 'al',
  'myanimelist': 'mal',
  'simkl': 'sim',
  'other': 'oth'
} as const;

export const CLIENT_CODE_REVERSE_MAP = {
  'al': 'anilist',
  'mal': 'myanimelist',
  'sim': 'simkl',
  'oth': 'other'
} as const;

// Base64URL encoding/decoding utilities
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// HMAC-SHA256 signing
async function signHMAC(data: string, secret: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return new Uint8Array(signature);
}

// HMAC-SHA256 verification
async function verifyHMAC(data: string, signature: Uint8Array, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  return await crypto.subtle.verify('HMAC', key, signature, messageData);
}

/**
 * Generate a minimal JWT token for the user
 * Payload contains only: uid (user_id) and ct (client_type code)
 * NO ROLE - role is fetched from database on each request
 * Token never expires (until user re-authenticates with provider)
 */
export async function generateJWT(userId: string, clientType: string): Promise<string> {
  const secret = Deno.env.get('JWT_SECRET');

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  // Convert client type to code
  const clientCode = CLIENT_CODE_MAP[clientType as keyof typeof CLIENT_CODE_MAP] || 'oth';

  // Minimal payload: only user_id and client_type (as code)
  const jwtPayload = {
    uid: userId,
    ct: clientCode,
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encoder = new TextEncoder();
  const headerEncoded = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadEncoded = base64UrlEncode(encoder.encode(JSON.stringify(jwtPayload)));
  const dataToSign = `${headerEncoded}.${payloadEncoded}`;

  const signature = await signHMAC(dataToSign, secret);
  const signatureEncoded = base64UrlEncode(signature);

  return `${dataToSign}.${signatureEncoded}`;
}

/**
 * Verify and decode a JWT token
 * Returns the identity payload if valid, null if invalid
 * Does NOT contain role - role must be fetched from database
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const secret = Deno.env.get('JWT_SECRET');

    if (!secret) {
      console.error('JWT_SECRET environment variable is not set');
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid token format');
      return null;
    }

    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
    const dataToSign = `${headerEncoded}.${payloadEncoded}`;
    const signature = base64UrlDecode(signatureEncoded);

    // Verify signature
    const isValid = await verifyHMAC(dataToSign, signature, secret);
    if (!isValid) {
      console.error('Invalid token signature');
      return null;
    }

    // Decode payload
    const payloadStr = atob(payloadEncoded.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadStr);

    // Validate payload structure
    if (!payload.uid || !payload.ct) {
      console.error('Invalid payload structure');
      return null;
    }

    // Validate client code
    if (!CLIENT_CODE_REVERSE_MAP[payload.ct as keyof typeof CLIENT_CODE_REVERSE_MAP]) {
      console.error('Invalid client code:', payload.ct);
      return null;
    }

    return {
      uid: payload.uid,
      ct: payload.ct,
    };
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Get user info (username + role) from database in one query
 * This is the single source of truth for permissions
 */
export async function getUserInfoFromDB(supabase: any, userId: string, clientType: string): Promise<{
  username: string;
  role: string;
} | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('username, role')
      .eq('user_id', userId)
      .eq('client_type', clientType)
      .maybeSingle()

    if (error || !data) {
      console.error('Error fetching user info:', error);
      return null;
    }

    return {
      username: data.username,
      role: data.role || 'user',  // Default to 'user' if role is null
    };
  } catch (error) {
    console.error('Error in getUserInfoFromDB:', error);
    return null;
  }
}

/**
 * Get user role from mod_plus table
 * This is for backward compatibility with mod_plus table
 * Now supports per-platform roles via client_type parameter
 */
export async function getUserRoleFromDB(supabase: any, userId: string, clientType?: string): Promise<string> {
  try {
    let query = supabase
      .from('mod_plus')
      .select('role')
      .eq('user_id', userId);

    // If client_type is specified, filter by it (for per-platform roles)
    if (clientType) {
      query = query.eq('client_type', clientType);
    }

    const { data, error } = await query.single();

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
