// Auth Edge Function - Handle login and JWT token generation
// POST /auth with { token, client_type } -> returns JWT

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7/denonext/supabase-js.mjs'
import { verifyClientToken } from '../shared/clientAuth.ts'
import { generateJWT } from '../shared/jwt.ts'
import { getUserRole } from '../shared/config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only POST method is supported
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { token, client_type } = await req.json()

    // Validate required fields
    if (!token || !client_type) {
      return new Response(
        JSON.stringify({ error: 'token and client_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate client type
    const validClientTypes = ['anilist', 'myanimelist', 'simkl', 'other']
    if (!validClientTypes.includes(client_type.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Invalid client_type. Must be anilist, myanimelist, simkl, or other' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify token with provider API
    const verifiedUser = await verifyClientToken(client_type, token)
    if (!verifiedUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get user role from mod_plus table
    const userRole = await getUserRole(supabase, verifiedUser.provider_user_id)

    // Upsert user in database (minimal user info)
    const { error: userError } = await supabase
      .from('users')
      .upsert({
        user_id: verifiedUser.provider_user_id,
        username: verifiedUser.username,
        client_type: client_type.toLowerCase(),
      }, {
        onConflict: 'user_id,client_type',
        ignoreDuplicates: false,
      })

    if (userError) {
      console.error('Error upserting user:', userError)
      // Continue anyway - user creation is not critical for auth flow
    }

    // Generate JWT token (never expires until re-login)
    const jwtToken = await generateJWT({
      user_id: verifiedUser.provider_user_id,
      username: verifiedUser.username,
      client_type: client_type.toLowerCase(),
      role: userRole,
    })

    // Return JWT token and user info
    return new Response(
      JSON.stringify({
        success: true,
        token: jwtToken,
        user: {
          user_id: verifiedUser.provider_user_id,
          username: verifiedUser.username,
          avatar: verifiedUser.avatar_url,
          client_type: client_type.toLowerCase(),
          role: userRole,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Auth error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
