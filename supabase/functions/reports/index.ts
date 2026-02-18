// Reports Edge Function - Handle comment reporting and moderation queue
// Uses JWT for authentication

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7/denonext/supabase-js.mjs'
import { verifyJWT } from '../shared/jwt.ts'
import { getConfig, hasMinRole } from '../shared/config.ts'
import { validateUserInfo } from '../shared/clientAPIs.ts'
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { action, jwt_token, reporter_info, comment_id, reason, notes, report_id, resolution, review_notes } = body

    // Validate action
    const validActions = ['create', 'resolve', 'get_queue']
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be create, resolve, or get_queue' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get configuration
    const config = getConfig()

    if (!config.reporting_enabled) {
      return new Response(
        JSON.stringify({ error: 'Reporting is disabled' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    switch (action) {
      case 'create':
        return await handleCreateReport(supabase, { comment_id, reporter_info, reason, notes, req })

      case 'resolve':
        return await handleResolveReport(supabase, { jwt_token, comment_id, report_id, resolution, review_notes })

      case 'get_queue':
        return await handleGetQueue(supabase, { jwt_token })

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Reports API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleCreateReport(supabase: any, params: any) {
  const { comment_id, reporter_info, reason, notes, req } = params

  // Validate required fields
  if (!comment_id || !reporter_info || !reason) {
    return new Response(
      JSON.stringify({ error: 'comment_id, reporter_info, and reason are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate reporter_info
  if (!validateUserInfo(reporter_info)) {
    return new Response(
      JSON.stringify({ error: 'Invalid reporter_info format' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate reason
  const validReasons = ['spam', 'offensive', 'harassment', 'spoiler', 'nsfw', 'off_topic', 'other']
  if (!validReasons.includes(reason.toLowerCase())) {
    return new Response(
      JSON.stringify({ error: 'Invalid reason' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

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

  // Check if comment is already deleted
  if (comment.deleted) {
    return new Response(
      JSON.stringify({ error: 'Cannot report deleted comment' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check user status from users table
  const { data: userStatus } = await supabase
    .from('users')
    .select('user_banned, user_muted_until, user_shadow_banned, user_warnings')
    .eq('user_id', comment.user_id)
    .eq('client_type', comment.client_type)
    .single()

  // If user is banned, the report is automatically marked as resolved
  if (userStatus?.user_banned) {
    return new Response(
      JSON.stringify({ 
        error: 'User is already banned',
        user_status: userStatus
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Parse existing reports
  const reports = comment.reports ? JSON.parse(comment.reports) : []

  // Create new report
  const newReport = {
    id: `report-${Date.now()}-${reporter_info.user_id}`,
    reporter_id: reporter_info.user_id,
    reporter_username: reporter_info.username,
    reason: reason.toLowerCase(),
    notes: notes || '',
    created_at: new Date().toISOString(),
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
  }

  reports.push(newReport)

  // Update comment with new report
  const { data: updatedComment, error: updateError } = await supabase
    .from('comments')
    .update({
      reported: true,
      report_count: reports.length,
      reports: JSON.stringify(reports),
      report_status: 'pending',
    })
    .eq('id', comment_id)
    .select()
    .single()

  if (updateError) {
    console.error('Error creating report:', updateError)
    return new Response(
      JSON.stringify({ error: 'Failed to create report' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Queue Discord notification for new report
  queueDiscordNotification({
    type: 'comment_reported',
    comment: {
      id: comment.id,
      content: comment.content
    },
    user: {
      username: reporter_info.username
    },
    reason: reason
  })

  return new Response(
    JSON.stringify({
      success: true,
      comment: updatedComment,
      report: newReport,
      user_status: userStatus || null,
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleResolveReport(supabase: any, params: any) {
  const { jwt_token, comment_id, report_id, resolution, review_notes } = params

  // Verify JWT
  const jwtPayload = await verifyJWT(jwt_token)
  if (!jwtPayload) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired JWT token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check moderator role
  if (!(await hasMinRole(supabase, jwtPayload.user_id, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate resolution
  const validResolutions = ['resolved', 'dismissed']
  if (!validResolutions.includes(resolution)) {
    return new Response(
      JSON.stringify({ error: 'Invalid resolution. Must be resolved or dismissed' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

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

  // Get user status from users table
  const { data: userStatus } = await supabase
    .from('users')
    .select('user_banned, user_muted_until, user_shadow_banned, user_warnings, username')
    .eq('user_id', comment.user_id)
    .eq('client_type', comment.client_type)
    .single()

  // Parse reports
  const reports = comment.reports ? JSON.parse(comment.reports) : []

  // Find and update the report
  const reportIndex = reports.findIndex((r: any) => r.id === report_id)
  if (reportIndex === -1) {
    return new Response(
      JSON.stringify({ error: 'Report not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  reports[reportIndex].status = resolution
  reports[reportIndex].reviewed_by = jwtPayload.user_id
  reports[reportIndex].reviewed_at = new Date().toISOString()
  reports[reportIndex].review_notes = review_notes || null

  // Update comment with resolved report
  const { data: updatedComment, error: updateError } = await supabase
    .from('comments')
    .update({
      reports: JSON.stringify(reports),
      report_status: resolution,
      moderated: true,
      moderated_at: new Date().toISOString(),
      moderated_by: jwtPayload.user_id,
      moderation_action: 'resolve_report',
    })
    .eq('id', comment_id)
    .select()
    .single()

  if (updateError) {
    console.error('Error resolving report:', updateError)
    return new Response(
      JSON.stringify({ error: 'Failed to resolve report' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Queue Discord notification for resolved report
  if (resolution === 'resolved') {
    queueDiscordNotification({
      type: 'user_warned',
      comment: {
        id: comment.id,
        content: comment.content
      },
      user: userStatus || { username: comment.username },
      moderator: {
        id: jwtPayload.user_id,
        username: jwtPayload.username || 'Moderator',
        role: jwtPayload.role
      },
      reason: `Report resolved: ${review_notes || 'No notes provided'}`
    })
  }

  return new Response(
    JSON.stringify({
      success: true,
      comment: updatedComment,
      resolved_report: reports[reportIndex],
      user_status: userStatus || null,
      moderator: {
        id: jwtPayload.user_id,
        username: jwtPayload.username,
        role: jwtPayload.role,
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleGetQueue(supabase: any, params: any) {
  const { jwt_token } = params

  // Verify JWT
  const jwtPayload = await verifyJWT(jwt_token)
  if (!jwtPayload) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired JWT token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check moderator role
  if (!(await hasMinRole(supabase, jwtPayload.user_id, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions. Moderator role required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get all comments with pending reports
  const { data: reportedComments, error: queryError } = await supabase
    .from('comments')
    .select('*')
    .eq('reported', true)
    .eq('report_status', 'pending')
    .order('created_at', { ascending: false })

  if (queryError) {
    console.error('Error getting report queue:', queryError)
    return new Response(
      JSON.stringify({ error: 'Failed to get report queue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Enrich comments with user status from users table
  const enrichedComments = await Promise.all(
    (reportedComments || []).map(async (comment: any) => {
      const { data: userStatus } = await supabase
        .from('users')
        .select('user_banned, user_muted_until, user_shadow_banned, user_warnings')
        .eq('user_id', comment.user_id)
        .eq('client_type', comment.client_type)
        .single()

      return {
        ...comment,
        user_status: userStatus || null
      }
    })
  )

  return new Response(
    JSON.stringify({
      success: true,
      queue: enrichedComments || [],
      count: enrichedComments?.length || 0,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
