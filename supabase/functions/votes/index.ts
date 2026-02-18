/ Votes Edge Function - Handle comment voting
// Uses JWT for authentication

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7/denonext/supabase-js.mjs'
import { verifyJWT } from '../shared/jwt.ts'
import { getConfig } from '../shared/config.ts'
import { updateUserVoteActivity } from '../shared/userManagement.ts'

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

    const { comment_id, jwt_token, vote_type } = await req.json()

    // Validate required fields
    if (!comment_id || !vote_type || !jwt_token) {
      return new Response(
        JSON.stringify({ error: 'comment_id, vote_type, and jwt_token are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate vote type
    const validVoteTypes = ['upvote', 'downvote', 'remove']
    if (!validVoteTypes.includes(vote_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid vote_type. Must be upvote, downvote, or remove' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get configuration
    const config = getConfig()

    if (!config.voting_enabled) {
      return new Response(
        JSON.stringify({ error: 'Voting is disabled' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify JWT
    const jwtPayload = await verifyJWT(jwt_token)
    if (!jwtPayload) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = jwtPayload.uid

    // Get comment
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, user_id, user_votes, upvotes, downvotes, vote_score, client_type')
      .eq('id', comment_id)
      .single()

    if (commentError || !comment) {
      return new Response(
        JSON.stringify({ error: 'Comment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const clientType = comment.client_type

    // NOTE: Users can vote on their own comments
    // This allows self-voting for engagement

    // Parse existing votes
    const userVotes = comment.user_votes ? JSON.parse(comment.user_votes) : {}

    // Handle vote type
    let upvotes = comment.upvotes
    let downvotes = comment.downvotes
    let newVoteType: string | null = null

    switch (vote_type) {
      case 'upvote':
        if (userVotes[userId] === 'upvote') {
          // Remove upvote (toggle off)
          upvotes--
          delete userVotes[userId]
          newVoteType = null
        } else if (userVotes[userId] === 'downvote') {
          // Change from downvote to upvote
          downvotes--
          upvotes++
          userVotes[userId] = 'upvote'
          newVoteType = 'upvote'
        } else {
          // New upvote
          upvotes++
          userVotes[userId] = 'upvote'
          newVoteType = 'upvote'
        }
        break

      case 'downvote':
        if (userVotes[userId] === 'downvote') {
          // Remove downvote (toggle off)
          downvotes--
          delete userVotes[userId]
          newVoteType = null
        } else if (userVotes[userId] === 'upvote') {
          // Change from upvote to downvote
          upvotes--
          downvotes++
          userVotes[userId] = 'downvote'
          newVoteType = 'downvote'
        } else {
          // New downvote
          downvotes++
          userVotes[userId] = 'downvote'
          newVoteType = 'downvote'
        }
        break

      case 'remove':
        // Remove vote regardless of type
        if (userVotes[userId] === 'upvote') {
          upvotes--
        } else if (userVotes[userId] === 'downvote') {
          downvotes--
        }
        delete userVotes[userId]
        newVoteType = null
        break
    }

    // Calculate new vote score
    const voteScore = upvotes - downvotes

    // Update comment
    const { data: updatedComment, error: updateError } = await supabase
      .from('comments')
      .update({
        upvotes,
        downvotes,
        vote_score: voteScore,
        user_votes: JSON.stringify(userVotes),
      })
      .eq('id', comment_id)
      .select('upvotes, downvotes, vote_score')
      .single()

    if (updateError) {
      console.error('Error updating vote:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update vote' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update user vote activity tracking (non-blocking) - only if vote was cast, not removed
    if (newVoteType !== null) {
      updateUserVoteActivity(supabase, clientType, userId).catch(err => {
        console.error('Failed to update user vote activity:', err)
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        voteScore: voteScore,
        upvotes: updatedComment.upvotes,
        downvotes: updatedComment.downvotes,
        userVote: newVoteType,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Votes API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
