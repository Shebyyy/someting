// Comments Edge Function - Handle comment CRUD operations
// Uses JWT for authentication

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7/denonext/supabase-js.mjs'
import { verifyJWT, getUserRoleFromDB } from '../shared/jwt.ts'
import { getConfig, getUserRole, hasMinRole } from '../shared/config.ts'
import { queueDiscordNotification } from '../shared/discordNotifications.ts'
import { getOrCreateUser, updateUserCommentActivity } from '../shared/userManagement.ts'
import { fetchMediaFromClientAPI } from '../shared/clientAPIs.ts'

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
    const { action, jwt_token, user_info, media_info, comment_id, content, parent_id, tag } = body

    // Validate action
    const validActions = ['create', 'edit', 'delete', 'mod_delete']
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify JWT and get user info
    let jwtPayload = null
    let currentUser = null

    if (jwt_token) {
      jwtPayload = await verifyJWT(jwt_token)
      if (!jwtPayload) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired JWT token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Refresh role from database (in case it changed)
      jwtPayload.role = await getUserRoleFromDB(supabase, jwtPayload.user_id)

      currentUser = {
        user_id: jwtPayload.user_id,
        username: jwtPayload.username,
        role: jwtPayload.role,
        client_type: jwtPayload.client_type,
      }
    }

    // Handle each action
    switch (action) {
      case 'create':
        return await handleCreateComment(supabase, { jwt_token, user_info, media_id: body.media_id, content, parent_id, tag, req })

      case 'edit':
        return await handleEditComment(supabase, { jwt_token, comment_id, content, req })

      case 'delete':
        return await handleDeleteComment(supabase, { jwt_token, comment_id, req })

      case 'mod_delete':
        return await handleModDeleteComment(supabase, { jwt_token, comment_id, req })

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Comments API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleCreateComment(supabase: any, params: any) {
  const { jwt_token, media_id, content, parent_id, tag, req } = params

  // Validate required fields
  if (!content || !media_id) {
    return new Response(
      JSON.stringify({ error: 'content and media_id are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify JWT for authentication and get user info
  const jwtPayload = await verifyJWT(jwt_token)
  if (!jwtPayload) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get user role from database (in case it changed)
  const userRole = await getUserRoleFromDB(supabase, jwtPayload.user_id)
  const userId = jwtPayload.user_id
  const username = jwtPayload.username
  const clientType = jwtPayload.client_type

  // Get configuration
  const config = getConfig()

  if (!config.system_enabled) {
    return new Response(
      JSON.stringify({ error: 'Comment system is disabled' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate content length
  if (content.length < 1 || content.length > config.max_comment_length) {
    return new Response(
      JSON.stringify({ error: `Content must be between 1 and ${config.max_comment_length} characters` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check user status from centralized users table
  const { data: userStatus } = await supabase
    .from('users')
    .select('user_banned, user_muted_until, user_shadow_banned, user_warnings')
    .eq('user_id', userId)
    .eq('client_type', clientType)
    .single()

  // Check if banned
  if (userStatus?.user_banned) {
    return new Response(
      JSON.stringify({ error: 'User is banned' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check if muted
  if (userStatus?.user_muted_until && new Date(userStatus.user_muted_until) > new Date()) {
    return new Response(
      JSON.stringify({ error: 'User is temporarily muted' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check banned keywords
  const hasBannedKeyword = config.banned_keywords.some((keyword: string) =>
    content.toLowerCase().includes(keyword.toLowerCase())
  )

  if (hasBannedKeyword) {
    return new Response(
      JSON.stringify({ error: 'Comment contains prohibited content' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check parent comment if reply
  if (parent_id) {
    const { data: parentComment } = await supabase
      .from('comments')
      .select('locked, media_id, media_type, client_type')
      .eq('id', parent_id)
      .single()

    if (!parentComment) {
      return new Response(
        JSON.stringify({ error: 'Parent comment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (parentComment.locked) {
      return new Response(
        JSON.stringify({ error: 'Comment thread is locked' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check nesting level
    const { data: depth } = await supabase.rpc('get_comment_depth', { comment_id: parent_id })

    if (depth !== null && depth >= config.max_nesting_level) {
      return new Response(
        JSON.stringify({ error: 'Maximum nesting level exceeded' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  // Get or create user record and update activity
  const userRecord = await getOrCreateUser(
    supabase,
    clientType,
    userId,
    username,
    null, // avatar
    userRole
  )

  // Create comment IMMEDIATELY (no media info yet)
  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      user_id: userId,
      client_type: clientType,
      media_id: media_id,
      content,
      username: username,
      user_role: userRole,
      media_type: 'other', // Temporary, will be updated
      media_title: 'Loading...', // Temporary, will be updated
      media_year: null,
      media_poster: null,
      parent_id,
      tags: tag !== undefined ? JSON.stringify([tag]) : null,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent'),
    })
    .select(`
      id, client_type, user_id, media_id, content, username, user_role,
      media_type, media_title, media_year, media_poster, parent_id, created_at, updated_at,
      deleted, pinned, locked, edited, edit_count, upvotes, downvotes, vote_score
    `)
    .single()

  if (error) throw error

  // Update user comment activity tracking (non-blocking)
  updateUserCommentActivity(supabase, clientType, userId, comment.id).catch(err => {
    console.error('Failed to update user comment activity:', err)
  })

  // Fetch media info in BACKGROUND after comment created
  fetchAndCacheMediaInfo(supabase, clientType, media_id, comment.id).catch(err => {
    console.error('Failed to fetch media info in background:', err)
  })

  // Queue Discord notification in background - NON-BLOCKING
  queueDiscordNotification({
    type: 'comment_created',
    comment: {
      id: comment.id,
      username: comment.username,
      user_id: comment.user_id,
      content: comment.content,
      client_type: comment.client_type,
      media_id: comment.media_id,
      media_type: comment.media_type,
      parent_id: comment.parent_id
    },
    user: {
      id: userId,
      username: username,
      avatar: null
    },
    media: {
      id: media_id,
      title: comment.media_title,
      year: comment.media_year,
      poster: comment.media_poster,
      type: comment.media_type,
      client_type: clientType
    }
  })

  return new Response(
    JSON.stringify({ success: true, comment }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Background function to fetch and cache media info
async function fetchAndCacheMediaInfo(
  supabase: any,
  clientType: string,
  mediaId: string,
  commentId: number
): Promise<void> {
  try {
    // Check if media already exists in database
    const { data: existingMedia } = await supabase
      .from('media')
      .select('*')
      .eq('media_id', mediaId)
      .eq('client_type', clientType)
      .single()

    let mediaData: any

    if (existingMedia) {
      // Media already exists, use it
      mediaData = existingMedia
      console.log('Media found in database:', existingMedia)
    } else {
      // Fetch from client API
      console.log(`Fetching media ${mediaId} from ${clientType} API...`)
      mediaData = await fetchMediaFromClientAPI(clientType, mediaId, 'anime')

      if (!mediaData) {
        console.error('Failed to fetch media from API')
        return
      }

      // Insert into media table
      const { data: insertedMedia } = await supabase
        .from('media')
        .insert({
          media_id: mediaData.media_id,
          client_type: clientType,
          media_type: mediaData.type,
          title: mediaData.title,
          year: mediaData.year,
          poster: mediaData.poster,
        })
        .select('*')
        .single()

      console.log('Media cached in database:', insertedMedia)
      mediaData = insertedMedia
    }

    // Update the comment with fetched media info
    const { error: updateError } = await supabase
      .from('comments')
      .update({
        media_type: mediaData.media_type,
        media_title: mediaData.title,
        media_year: mediaData.year,
        media_poster: mediaData.poster,
      })
      .eq('id', commentId)

    if (updateError) {
      console.error('Failed to update comment with media info:', updateError)
    } else {
      console.log(`Comment ${commentId} updated with media info`)
    }
  } catch (error) {
    console.error('Error in fetchAndCacheMediaInfo:', error)
  }
}

async function handleEditComment(supabase: any, params: any) {
  const { jwt_token, comment_id, content, req } = params

  if (!comment_id || !content) {
    return new Response(
      JSON.stringify({ error: 'comment_id and content are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify JWT
  const jwtPayload = await verifyJWT(jwt_token)
  if (!jwtPayload) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get comment
  const { data: comment } = await supabase
    .from('comments')
    .select('*')
    .eq('id', comment_id)
    .single()

  if (!comment) {
    return new Response(
      JSON.stringify({ error: 'Comment not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check ownership
  if (comment.user_id !== jwtPayload.user_id && !(await hasMinRole(supabase, jwtPayload.user_id, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'You can only edit your own comments' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check if deleted or locked
  if (comment.deleted || comment.locked) {
    return new Response(
      JSON.stringify({ error: 'Cannot edit deleted or locked comments' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Update edit history
  const editHistory = comment.edit_history ? JSON.parse(comment.edit_history) : []
  editHistory.push({
    oldContent: comment.content,
    newContent: content,
    editedAt: new Date().toISOString(),
    editedBy: jwtPayload.user_id,
  })

  // Update comment
  const { data: updatedComment, error } = await supabase
    .from('comments')
    .update({
      content,
      edited: true,
      edited_at: new Date().toISOString(),
      edit_count: comment.edit_count + 1,
      edit_history: JSON.stringify(editHistory),
    })
    .eq('id', comment_id)
    .select()
    .single()

  if (error) throw error

  // Queue Discord notification in background - NON-BLOCKING
  queueDiscordNotification({
    type: 'comment_updated',
    comment: {
      id: updatedComment.id,
      username: updatedComment.username,
      user_id: updatedComment.user_id,
      content: updatedComment.content,
      client_type: updatedComment.client_type,
      media_id: updatedComment.media_id,
      media_type: updatedComment.media_type
    },
    user: {
      id: jwtPayload.user_id,
      username: jwtPayload.username,
      avatar: null
    },
    media: {
      id: updatedComment.media_id,
      title: updatedComment.media_title,
      type: updatedComment.media_type,
      year: updatedComment.media_year,
      poster: updatedComment.media_poster,
      client_type: updatedComment.client_type
    }
  })

  return new Response(
    JSON.stringify({ success: true, comment: updatedComment }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleDeleteComment(supabase: any, params: any) {
  const { jwt_token, comment_id, req } = params

  if (!comment_id) {
    return new Response(
      JSON.stringify({ error: 'comment_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify JWT
  const jwtPayload = await verifyJWT(jwt_token)
  if (!jwtPayload) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get comment
  const { data: comment } = await supabase
    .from('comments')
    .select('*')
    .eq('id', comment_id)
    .single()

  if (!comment) {
    return new Response(
      JSON.stringify({ error: 'Comment not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check ownership
  if (comment.user_id !== jwtPayload.user_id && !(await hasMinRole(supabase, jwtPayload.user_id, 'moderator'))) {
    return new Response(
      JSON.stringify({ error: 'You can only delete your own comments' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Soft delete
  const { data: deletedComment, error } = await supabase
    .from('comments')
    .update({
      deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: jwtPayload.user_id,
    })
    .eq('id', comment_id)
    .select()
    .single()

  if (error) throw error

  // Queue Discord notification in background - NON-BLOCKING
  queueDiscordNotification({
    type: 'comment_deleted',
    comment: {
      id: deletedComment.id,
      username: deletedComment.username,
      user_id: deletedComment.user_id,
      content: comment.content,
      client_type: deletedComment.client_type,
      media_id: deletedComment.media_id,
      media_type: deletedComment.media_type
    },
    moderator: null,
    user: {
      id: jwtPayload.user_id,
      username: jwtPayload.username,
      avatar: null
    },
    media: {
      id: deletedComment.media_id,
      title: deletedComment.media_title,
      type: deletedComment.media_type,
      year: deletedComment.media_year,
      poster: deletedComment.media_poster,
      client_type: deletedComment.client_type
    }
  })

  return new Response(
    JSON.stringify({ success: true, comment: deletedComment }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleModDeleteComment(supabase: any, params: any) {
  const { jwt_token, comment_id, req } = params

  if (!comment_id) {
    return new Response(
      JSON.stringify({ error: 'comment_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify JWT and check moderator role
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
      JSON.stringify({ error: 'Insufficient permissions' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get comment
  const { data: comment } = await supabase
    .from('comments')
    .select('*')
    .eq('id', comment_id)
    .single()

  if (!comment) {
    return new Response(
      JSON.stringify({ error: 'Comment not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Mod delete with moderation info
  const { data: deletedComment, error } = await supabase
    .from('comments')
    .update({
      deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: jwtPayload.user_id,
      moderated: true,
      moderated_at: new Date().toISOString(),
      moderated_by: jwtPayload.user_id,
      moderation_action: 'mod_delete',
    })
    .eq('id', comment_id)
    .select()
    .single()

  if (error) throw error

  // Queue Discord notification in background - NON-BLOCKING
  queueDiscordNotification({
    type: 'comment_deleted',
    comment: {
      id: deletedComment.id,
      username: deletedComment.username,
      user_id: deletedComment.user_id,
      content: comment.content,
      client_type: deletedComment.client_type,
      media_id: deletedComment.media_id,
      media_type: deletedComment.media_type
    },
    moderator: {
      id: jwtPayload.user_id,
      username: jwtPayload.username,
      role: jwtPayload.role
    },
    user: {
      id: deletedComment.user_id,
      username: deletedComment.username,
      avatar: null
    },
    media: {
      id: deletedComment.media_id,
      title: deletedComment.media_title,
      type: deletedComment.media_type,
      year: deletedComment.media_year,
      poster: deletedComment.media_poster,
      client_type: deletedComment.client_type
    },
    reason: 'Moderator deletion'
  })

  return new Response(
    JSON.stringify({
      success: true,
      comment: deletedComment,
      moderator: {
        id: jwtPayload.user_id,
        username: jwtPayload.username,
        role: jwtPayload.role
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
