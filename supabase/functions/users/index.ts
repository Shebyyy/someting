// Users Edge Function - Handle user management and info
// Requires JWT authentication

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7/denonext/supabase-js.mjs'
import { verifyJWT, getUserInfoFromDB, CLIENT_CODE_REVERSE_MAP } from '../shared/jwt.ts'
import { getUserRole, hasMinRole } from '../shared/config.ts'

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
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert client code to full client type
    const clientType = CLIENT_CODE_REVERSE_MAP[jwtPayload.ct as keyof typeof CLIENT_CODE_REVERSE_MAP] || 'other'

    // Get username and role from database in ONE query
    const userInfo = await getUserInfoFromDB(supabase, jwtPayload.uid, clientType)
    if (!userInfo) {
      return new Response(
        JSON.stringify({ error: 'User not found in database' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = jwtPayload.uid
    const userRole = userInfo.role

    // Handle each action
    switch (action) {
      case 'me':
        return await handleMe(supabase, { userId, clientType, username: userInfo.username, role: userRole })

      case 'get_user_info':
        return await handleGetUserInfo(supabase, { userId, clientType, userRole, target_user_id, target_client_type })

      case 'get_user_stats':
        return await handleGetUserStats(supabase, { userId, clientType, userRole, target_user_id, target_client_type })

      case 'get_user_history':
        return await handleGetUserHistory(supabase, { userId, clientType, userRole, target_user_id, target_client_type })

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

async function handleMe(supabase: any, params: any) {
  const { userId, clientType, username, role } = params

  // Get full user info
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .eq('client_type', clientType)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user info:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch user info' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get voting statistics for this user (aggregated query)
  const { data: voteStats, error: statsError } = await supabase
    .rpc('get_user_vote_stats', {
      p_user_id: userId,
      p_client_type: clientType
    })

  let totalVotes = {
    upvotes: 0,
    downvotes: 0,
    net_score: 0,
    total_comments: 0
  }

  // Fallback to manual calculation if RPC doesn't exist
  if (statsError || !voteStats) {
    const { data: comments, error: commentsError } = await supabase
      .from('comments')
      .select('upvotes, downvotes, vote_score')
      .eq('user_id', userId)
      .eq('client_type', clientType)

    if (!commentsError && comments) {
      totalVotes = {
        upvotes: comments.reduce((sum: number, c: any) => sum + (c.upvotes || 0), 0),
        downvotes: comments.reduce((sum: number, c: any) => sum + (c.downvotes || 0), 0),
        net_score: comments.reduce((sum: number, c: any) => sum + (c.vote_score || 0), 0),
        total_comments: comments.length
      }
    }
  } else {
    totalVotes = voteStats
  }

  return new Response(
    JSON.stringify({
      success: true,
      user: {
        user_id: userId,
        username: username,
        client_type: clientType,
        role: role,
        user_banned: user?.user_banned || false,
        user_muted_until: user?.user_muted_until || null,
        user_shadow_banned: user?.user_shadow_banned || false,
        user_warnings: user?.user_warnings || 0,
        created_at: user?.created_at || null,
        updated_at: user?.updated_at || null,
      },
      voting_stats: totalVotes,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleGetUserInfo(supabase: any, params: any) {
  const { userId, clientType, userRole, target_user_id, target_client_type } = params

  // For getting own info, no special permissions needed
  // For getting others' info, moderator role required
  const isSelf = !target_user_id || target_user_id === userId
  if (!isSelf && !(await hasMinRole(supabase, userId, 'moderator', clientType))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required to view other users.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const queryUserId = isSelf ? userId : target_user_id
  const queryClientType = isSelf ? clientType : (target_client_type || clientType)

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

  // Get user role from database
  const role = await getUserRole(supabase, queryUserId, queryClientType)

  return new Response(
    JSON.stringify({
      success: true,
      user: user ? {
        user_id: user.user_id,
        username: user.username,
        client_type: user.client_type,
        role: role,
        user_banned: user.user_banned,
        user_muted_until: user.user_muted_until,
        user_shadow_banned: user.user_shadow_banned,
        user_warnings: user.user_warnings,
        created_at: user.created_at,
        updated_at: user.updated_at,
      } : null,
      is_self: isSelf,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleGetUserStats(supabase: any, params: any) {
  const { userId, clientType, userRole, target_user_id, target_client_type } = params

  // For getting own stats, no special permissions needed
  // For getting others' stats, moderator role required
  const isSelf = !target_user_id || target_user_id === userId
  if (!isSelf && !(await hasMinRole(supabase, userId, 'moderator', clientType))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required to view other users.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const queryUserId = isSelf ? userId : target_user_id
  const queryClientType = isSelf ? clientType : (target_client_type || clientType)

  // Get user stats using fast database aggregation function
  const { data: statsData, error: statsError } = await supabase.rpc('get_user_stats_agg', {
    user_id_param: queryUserId,
    client_type_param: queryClientType
  })

  if (statsError || !statsData || statsData.length === 0) {
    console.error('Error fetching user stats:', statsError)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch user stats' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get user status from users table
  const { data: userStatus } = await supabase
    .from('users')
    .select('user_warnings, user_banned, user_shadow_banned, user_muted_until')
    .eq('user_id', queryUserId)
    .eq('client_type', queryClientType)
    .maybeSingle()

  // Combine stats
  const stats = statsData[0]
  const finalStats = {
    total_comments: stats.total_comments || 0,
    active_comments: stats.active_comments || 0,
    deleted_comments: stats.deleted_comments || 0,
    total_upvotes: stats.total_upvotes || 0,
    total_downvotes: stats.total_downvotes || 0,
    net_score: stats.net_score || 0,
    warnings: userStatus?.user_warnings || 0,
    is_banned: userStatus?.user_banned || false,
    is_shadow_banned: userStatus?.user_shadow_banned || false,
    is_muted: userStatus?.user_muted_until
      ? new Date(userStatus.user_muted_until) > new Date()
      : false,
    muted_until: userStatus?.user_muted_until || null,
  }

  return new Response(
    JSON.stringify({
      success: true,
      user_id: queryUserId,
      client_type: queryClientType,
      stats: finalStats,
      is_self: isSelf,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleGetUserHistory(supabase: any, params: any) {
  const { userId, clientType, userRole, target_user_id, target_client_type } = params

  // For getting own history, no special permissions needed
  // For getting others' history, moderator role required
  const isSelf = !target_user_id || target_user_id === userId
  if (!isSelf && !(await hasMinRole(supabase, userId, 'moderator', clientType))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required to view other users.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const queryUserId = isSelf ? userId : target_user_id
  const queryClientType = isSelf ? clientType : (target_client_type || clientType)

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
