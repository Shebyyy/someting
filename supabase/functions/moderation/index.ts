// Moderation Edge Function - Handle advanced moderation actions
// Requires JWT with moderator or admin role

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7/denonext/supabase-js.mjs'
import { verifyJWT } from '../shared/jwt.ts'
import { hasMinRole } from '../shared/config.ts'
import { queueDiscordNotification } from '../shared/discordNotifications.ts'

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

    const { action, jwt_token, comment_id, target_user_id, target_client_type, reason, shadow_ban, duration, pin } = await req.json()

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
      case 'pin_comment':
        return await handlePinComment(supabase, { userId, userRole, comment_id, reason, pin })

      case 'lock_thread':
        return await handleLockThread(supabase, { userId, userRole, comment_id, reason })

      case 'unlock_thread':
        return await handleUnlockThread(supabase, { userId, userRole, comment_id, reason })

      case 'warn_user':
        return await handleWarnUser(supabase, { userId, userRole, target_user_id, target_client_type, reason })

      case 'unwarn_user':
        return await handleUnwarnUser(supabase, { userId, userRole, target_user_id, target_client_type, reason })

      case 'mute_user':
        return await handleMuteUser(supabase, { userId, userRole, target_user_id, target_client_type, reason, duration })

      case 'unmute_user':
        return await handleUnmuteUser(supabase, { userId, userRole, target_user_id, target_client_type, reason })

      case 'ban_user':
        return await handleBanUser(supabase, { userId, userRole, target_user_id, target_client_type, reason, shadow_ban })

      case 'unban_user':
        return await handleUnbanUser(supabase, { userId, userRole, target_user_id, target_client_type, reason })

      case 'get_queue':
        return await handleGetQueue(supabase, { userId, userRole })

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Moderation API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handlePinComment(supabase: any, params: any) {
  const { userId, userRole, comment_id, reason, pin } = params

  // Check moderator role
  if (!(await hasMinRole(supabase, userId, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!comment_id) {
    return new Response(
      JSON.stringify({ error: 'comment_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const pinValue = pin !== undefined ? pin : true

  // Get comment
  const { data: comment, error: commentError } = await supabase
    .from('comments')
    .select('*')
    .eq('id', comment_id)
    .single()

  if (commentError || !comment) {
    return new Response(
      JSON.stringify({ error: 'Comment not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Update comment
  const updateData: any = {
    pinned: pinValue,
  }

  if (pinValue) {
    updateData.pinned_at = new Date().toISOString()
    updateData.pinned_by = userId
  } else {
    updateData.pinned_at = null
    updateData.pinned_by = null
  }

  // Add moderation info if pinning
  if (pinValue) {
    updateData.moderated = true
    updateData.moderated_at = new Date().toISOString()
    updateData.moderated_by = userId
    updateData.moderation_action = 'pin_comment'
    updateData.moderation_reason = reason || ''
  }

  const { data: updatedComment, error: updateError } = await supabase
    .from('comments')
    .update(updateData)
    .eq('id', comment_id)
    .select()
    .single()

  if (updateError) {
    console.error('Error pinning comment:', updateError)
    return new Response(
      JSON.stringify({ error: 'Failed to pin/unpin comment' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      comment: updatedComment,
      moderator: {
        id: userId,
        username: userRole === 'user' ? 'Unknown' : 'Moderator',
        role: userRole,
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleLockThread(supabase: any, params: any) {
  const { userId, userRole, comment_id, reason } = params

  // Check moderator role
  if (!(await hasMinRole(supabase, userId, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!comment_id) {
    return new Response(
      JSON.stringify({ error: 'comment_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Update comment
  const { data: updatedComment, error: updateError } = await supabase
    .from('comments')
    .update({
      locked: true,
      locked_at: new Date().toISOString(),
      locked_by: userId,
      moderated: true,
      moderated_at: new Date().toISOString(),
      moderated_by: userId,
      moderation_action: 'lock_thread',
      moderation_reason: reason || '',
    })
    .eq('id', comment_id)
    .select()
    .single()

  if (updateError) {
    console.error('Error locking thread:', updateError)
    return new Response(
      JSON.stringify({ error: 'Failed to lock thread' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      comment: updatedComment,
      moderator: {
        id: userId,
        username: userRole === 'user' ? 'Unknown' : 'Moderator',
        role: userRole,
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleUnlockThread(supabase: any, params: any) {
  const { userId, userRole, comment_id, reason } = params

  // Check moderator role
  if (!(await hasMinRole(supabase, userId, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!comment_id) {
    return new Response(
      JSON.stringify({ error: 'comment_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Update comment
  const { data: updatedComment, error: updateError } = await supabase
    .from('comments')
    .update({
      locked: false,
      locked_at: null,
      locked_by: null,
      moderated: true,
      moderated_at: new Date().toISOString(),
      moderated_by: userId,
      moderation_action: 'unlock_thread',
      moderation_reason: reason || '',
    })
    .eq('id', comment_id)
    .select()
    .single()

  if (updateError) {
    console.error('Error unlocking thread:', updateError)
    return new Response(
      JSON.stringify({ error: 'Failed to unlock thread' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      comment: updatedComment,
      moderator: {
        id: userId,
        username: userRole === 'user' ? 'Unknown' : 'Moderator',
        role: userRole,
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleWarnUser(supabase: any, params: any) {
  const { userId, userRole, target_user_id, target_client_type, reason } = params

  // Check moderator role
  if (!(await hasMinRole(supabase, userId, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!target_user_id || !target_client_type || !reason) {
    return new Response(
      JSON.stringify({ error: 'target_user_id, target_client_type, and reason are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get current user status
  const { data: userStatus, error: statusError } = await supabase
    .from('users')
    .select('user_warnings, username')
    .eq('user_id', target_user_id)
    .eq('client_type', target_client_type)
    .single()

  if (statusError || !userStatus) {
    return new Response(
      JSON.stringify({ error: 'User not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Increment warnings in users table
  const newWarnings = (userStatus.user_warnings || 0) + 1
  const { error: updateError } = await supabase
    .from('users')
    .update({ user_warnings: newWarnings })
    .eq('user_id', target_user_id)
    .eq('client_type', target_client_type)

  if (updateError) {
    console.error('Error warning user:', updateError)
    return new Response(
      JSON.stringify({ error: 'Failed to warn user' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Queue Discord notification
  queueDiscordNotification({
    type: 'user_warned',
    moderator: { id: userId, username: userRole === 'user' ? 'Unknown' : 'Moderator', role: userRole },
    user: { username: userStatus.username },
    reason
  })

  return new Response(
    JSON.stringify({
      success: true,
      target_user_id,
      target_client_type,
      warnings: newWarnings,
      moderator: {
        id: userId,
        username: userRole === 'user' ? 'Unknown' : 'Moderator',
        role: userRole,
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleUnwarnUser(supabase: any, params: any) {
  const { userId, userRole, target_user_id, target_client_type, reason } = params

  // Check moderator role
  if (!(await hasMinRole(supabase, userId, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!target_user_id || !target_client_type) {
    return new Response(
      JSON.stringify({ error: 'target_user_id and target_client_type are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get current user status
  const { data: userStatus, error: statusError } = await supabase
    .from('users')
    .select('user_warnings, username')
    .eq('user_id', target_user_id)
    .eq('client_type', target_client_type)
    .single()

  if (statusError || !userStatus) {
    return new Response(
      JSON.stringify({ error: 'User not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Decrement warnings (minimum 0)
  const newWarnings = Math.max(0, (userStatus.user_warnings || 0) - 1)
  const { error: updateError } = await supabase
    .from('users')
    .update({ user_warnings: newWarnings })
    .eq('user_id', target_user_id)
    .eq('client_type', target_client_type)

  if (updateError) {
    console.error('Error unwarning user:', updateError)
    return new Response(
      JSON.stringify({ error: 'Failed to unwarn user' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Queue Discord notification (optional - might be less important)
  queueDiscordNotification({
    type: 'user_warned',
    moderator: { id: userId, username: userRole === 'user' ? 'Unknown' : 'Moderator', role: userRole },
    user: { username: userStatus.username },
    reason: `Warning removed. Reason: ${reason || 'No reason provided'}`
  })

  return new Response(
    JSON.stringify({
      success: true,
      target_user_id,
      target_client_type,
      warnings: newWarnings,
      moderator: {
        id: userId,
        username: userRole === 'user' ? 'Unknown' : 'Moderator',
        role: userRole,
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleMuteUser(supabase: any, params: any) {
  const { userId, userRole, target_user_id, target_client_type, reason, duration } = params

  // Check moderator role
  if (!(await hasMinRole(supabase, userId, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!target_user_id || !target_client_type || !duration) {
    return new Response(
      JSON.stringify({ error: 'target_user_id, target_client_type, and duration are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get current user status
  const { data: userStatus, error: statusError } = await supabase
    .from('users')
    .select('username')
    .eq('user_id', target_user_id)
    .eq('client_type', target_client_type)
    .single()

  if (statusError || !userStatus) {
    return new Response(
      JSON.stringify({ error: 'User not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Calculate mute expiration
  const mutedUntil = new Date()
  mutedUntil.setHours(mutedUntil.getHours() + duration)

  // Update user in users table
  const { error: updateError } = await supabase
    .from('users')
    .update({ user_muted_until: mutedUntil.toISOString() })
    .eq('user_id', target_user_id)
    .eq('client_type', target_client_type)

  if (updateError) {
    console.error('Error muting user:', updateError)
    return new Response(
      JSON.stringify({ error: 'Failed to mute user' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Queue Discord notification
  queueDiscordNotification({
    type: 'user_warned',
    moderator: { id: userId, username: userRole === 'user' ? 'Unknown' : 'Moderator', role: userRole },
    user: { username: userStatus.username },
    reason: `User muted for ${duration} hours. ${reason || 'No reason provided'}`
  })

  return new Response(
    JSON.stringify({
      success: true,
      target_user_id,
      target_client_type,
      muted_until: mutedUntil.toISOString(),
      moderator: {
        id: userId,
        username: userRole === 'user' ? 'Unknown' : 'Moderator',
        role: userRole,
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleUnmuteUser(supabase: any, params: any) {
  const { userId, userRole, target_user_id, target_client_type, reason } = params

  // Check moderator role
  if (!(await hasMinRole(supabase, userId, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!target_user_id || !target_client_type) {
    return new Response(
      JSON.stringify({ error: 'target_user_id and target_client_type are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get current user status
  const { data: userStatus, error: statusError } = await supabase
    .from('users')
    .select('username')
    .eq('user_id', target_user_id)
    .eq('client_type', target_client_type)
    .single()

  if (statusError || !userStatus) {
    return new Response(
      JSON.stringify({ error: 'User not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Update user in users table
  const { error: updateError } = await supabase
    .from('users')
    .update({ user_muted_until: null })
    .eq('user_id', target_user_id)
    .eq('client_type', target_client_type)

  if (updateError) {
    console.error('Error unmuting user:', updateError)
    return new Response(
      JSON.stringify({ error: 'Failed to unmute user' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Queue Discord notification
  queueDiscordNotification({
    type: 'user_warned',
    moderator: { id: userId, username: userRole === 'user' ? 'Unknown' : 'Moderator', role: userRole },
    user: { username: userStatus.username },
    reason: `User unmuted. ${reason || 'No reason provided'}`
  })

  return new Response(
    JSON.stringify({
      success: true,
      target_user_id,
      target_client_type,
      moderator: {
        id: userId,
        username: userRole === 'user' ? 'Unknown' : 'Moderator',
        role: userRole,
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleBanUser(supabase: any, params: any) {
  const { userId, userRole, target_user_id, target_client_type, reason, shadow_ban } = params

  // Check admin role
  if (!(await hasMinRole(supabase, userId, 'admin'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Admin role required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!target_user_id || !target_client_type || !reason) {
    return new Response(
      JSON.stringify({ error: 'target_user_id, target_client_type, and reason are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get current user status
  const { data: userStatus, error: statusError } = await supabase
    .from('users')
    .select('username')
    .eq('user_id', target_user_id)
    .eq('client_type', target_client_type)
    .single()

  if (statusError || !userStatus) {
    return new Response(
      JSON.stringify({ error: 'User not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Update user in users table
  const { error: updateError } = await supabase
    .from('users')
    .update({ 
      user_banned: true, 
      user_shadow_banned: shadow_ban || false 
    })
    .eq('user_id', target_user_id)
    .eq('client_type', target_client_type)

  if (updateError) {
    console.error('Error banning user:', updateError)
    return new Response(
      JSON.stringify({ error: 'Failed to ban user' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Queue Discord notification
  queueDiscordNotification({
    type: 'user_banned',
    moderator: { id: userId, username: userRole === 'user' ? 'Unknown' : 'Admin', role: userRole },
    user: { username: userStatus.username },
    reason: shadow_ban ? `Shadow banned. ${reason}` : reason
  })

  return new Response(
    JSON.stringify({
      success: true,
      target_user_id,
      target_client_type,
      shadow_ban: shadow_ban || false,
      moderator: {
        id: userId,
        username: userRole === 'user' ? 'Unknown' : 'Admin',
        role: userRole,
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleUnbanUser(supabase: any, params: any) {
  const { userId, userRole, target_user_id, target_client_type, reason } = params

  // Check admin role
  if (!(await hasMinRole(supabase, userId, 'admin'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Admin role required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!target_user_id || !target_client_type) {
    return new Response(
      JSON.stringify({ error: 'target_user_id and target_client_type are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get current user status
  const { data: userStatus, error: statusError } = await supabase
    .from('users')
    .select('username')
    .eq('user_id', target_user_id)
    .eq('client_type', target_client_type)
    .single()

  if (statusError || !userStatus) {
    return new Response(
      JSON.stringify({ error: 'User not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Update user in users table
  const { error: updateError } = await supabase
    .from('users')
    .update({ 
      user_banned: false, 
      user_shadow_banned: false 
    })
    .eq('user_id', target_user_id)
    .eq('client_type', target_client_type)

  if (updateError) {
    console.error('Error unbanning user:', updateError)
    return new Response(
      JSON.stringify({ error: 'Failed to unban user' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Queue Discord notification
  queueDiscordNotification({
    type: 'user_warned',
    moderator: { id: userId, username: userRole === 'user' ? 'Unknown' : 'Admin', role: userRole },
    user: { username: userStatus.username },
    reason: `User unbanned. ${reason || 'No reason provided'}`
  })

  return new Response(
    JSON.stringify({
      success: true,
      target_user_id,
      target_client_type,
      moderator: {
        id: userId,
        username: userRole === 'user' ? 'Unknown' : 'Admin',
        role: userRole,
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleGetQueue(supabase: any, params: any) {
  const { userId, userRole } = params

  // Check moderator role
  if (!(await hasMinRole(supabase, userId, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get reported comments
  const { data: reportedComments, error: queryError } = await supabase
    .from('comments')
    .select('*')
    .eq('reported', true)
    .eq('report_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100)

  if (queryError) {
    console.error('Error getting moderation queue:', queryError)
    return new Response(
      JSON.stringify({ error: 'Failed to get moderation queue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      queue: reportedComments || [],
      count: reportedComments?.length || 0,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
