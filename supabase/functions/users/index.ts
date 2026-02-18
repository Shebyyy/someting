// Users Edge Function - Handle user management and info
// Requires JWT authentication

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7/denonext/supabase-js.mjs'
import { verifyJWT, getUserRoleFromDB } from '../shared/jwt.ts'
import { getUserRole, hasMinRole } from '../shared/config.ts'
import { getUserStatistics } from '../shared/userManagement.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { action, jwt_token, target_user_id, target_client_type } = await req.json()

    // Verify JWT
    const jwtPayload = await verifyJWT(jwt_token)
    if (!jwtPayload) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired JWT token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = jwtPayload.user_id
    const userRole = jwtPayload.role

    // Handle each action
    switch (action) {
      case 'get_user_info':
        return await handleGetUserInfo(supabase, { userId, userRole, target_user_id, target_client_type })

      case 'get_user_stats':
        return await handleGetUserStats(supabase, { userId, userRole, target_user_id, target_client_type })

      case 'get_user_history':
        return await handleGetUserHistory(supabase, { userId, userRole, target_user_id, target_client_type })

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Users API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleGetUserInfo(supabase: any, params: any) {
  const { userId, userRole, target_user_id, target_client_type } = params

  // For getting own info, no special permissions needed
  // For getting others' info, moderator role required
  const isSelf = !target_user_id || target_user_id === userId
  if (!isSelf && !(await hasMinRole(supabase, userId, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required to view other users.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const queryUserId = isSelf ? userId : target_user_id
  const queryClientType = isSelf ? userRole : target_client_type

  // Get user from users table
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', queryUserId)
    .eq('client_type', queryClientType)
    .single()

  if (userError && userError.code !== 'PGRST116') {
    console.error('Error fetching user info:', userError)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch user info' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get user role from environment
  const role = getUserRole(queryUserId)

  return new Response(
    JSON.stringify({
      success: true,
      user: user ? {
        user_id: user.user_id,
        username: user.username,
        client_type: user.client_type,
        created_at: user.created_at,
        updated_at: user.updated_at,
      } : null,
      role,
      is_self: isSelf,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleGetUserStats(supabase: any, params: any) {
  const { userId, userRole, target_user_id, target_client_type } = params

  // For getting own stats, no special permissions needed
  // For getting others' stats, moderator role required
  const isSelf = !target_user_id || target_user_id === userId
  if (!isSelf && !(await hasMinRole(supabase, userId, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required to view other users.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const queryUserId = isSelf ? userId : target_user_id
  const queryClientType = isSelf ? userRole : target_client_type

  // Get user stats from comments
  const { data: comments, error: commentsError } = await supabase
    .from('comments')
    .select('user_id, client_type, deleted, upvotes, downvotes, vote_score, user_warnings, user_banned, user_shadow_banned, user_muted_until')
    .eq('user_id', queryUserId)
    .eq('client_type', queryClientType)

  if (commentsError) {
    console.error('Error fetching user stats:', commentsError)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch user stats' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Calculate stats
  const stats = {
    total_comments: comments?.length || 0,
    active_comments: comments?.filter((c: any) => !c.deleted).length || 0,
    deleted_comments: comments?.filter((c: any) => c.deleted).length || 0,
    total_upvotes: comments?.reduce((sum: number, c: any) => sum + (c.upvotes || 0), 0) || 0,
    total_downvotes: comments?.reduce((sum: number, c: any) => sum + (c.downvotes || 0), 0) || 0,
    net_score: comments?.reduce((sum: number, c: any) => sum + (c.vote_score || 0), 0) || 0,
    warnings: comments?.[0]?.user_warnings || 0,
    is_banned: comments?.[0]?.user_banned || false,
    is_shadow_banned: comments?.[0]?.user_shadow_banned || false,
    is_muted: comments?.[0]?.user_muted_until
      ? new Date(comments[0].user_muted_until) > new Date()
      : false,
    muted_until: comments?.[0]?.user_muted_until || null,
  }

  return new Response(
    JSON.stringify({
      success: true,
      user_id: queryUserId,
      client_type: queryClientType,
      stats,
      is_self: isSelf,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleGetUserHistory(supabase: any, params: any) {
  const { userId, userRole, target_user_id, target_client_type } = params

  // For getting own history, no special permissions needed
  // For getting others' history, moderator role required
  const isSelf = !target_user_id || target_user_id === userId
  if (!isSelf && !(await hasMinRole(supabase, userId, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required to view other users.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const queryUserId = isSelf ? userId : target_user_id
  const queryClientType = isSelf ? userRole : target_client_type

  // Get user's comment history
  const { data: comments, error: commentsError } = await supabase
    .from('comments')
    .select('*')
    .eq('user_id', queryUserId)
    .eq('client_type', queryClientType)
    .order('created_at', { ascending: false })
    .limit(50)

  if (commentsError) {
    console.error('Error fetching user history:', commentsError)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch user history' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      user_id: queryUserId,
      client_type: queryClientType,
      comments: comments || [],
      count: comments?.length || 0,
      is_self: isSelf,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
