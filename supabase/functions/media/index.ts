// Media Edge Function - Get comments for a specific media
// Public endpoint - no authentication required

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7/denonext/supabase-js.mjs'
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
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const media_id = url.searchParams.get('media_id')
    const client_type = url.searchParams.get('client_type')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)
    const sort = url.searchParams.get('sort') || 'newest'
    const include_deleted = url.searchParams.get('include_deleted') === 'true'

    // Validate required fields
    if (!media_id || !client_type) {
      return new Response(
        JSON.stringify({ error: 'media_id and client_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Build query
    let query = supabase
      .from('comments')
      .select('*')

    // Filter by media_id and client_type
    query = query.eq('media_id', media_id).eq('client_type', client_type.toLowerCase())

    // Filter deleted comments unless requested
    if (!include_deleted) {
      query = query.eq('deleted', false)
    }

    // Apply sorting
    switch (sort) {
      case 'newest':
        query = query.order('created_at', { ascending: false })
        break
      case 'oldest':
        query = query.order('created_at', { ascending: true })
        break
      case 'top':
        query = query.order('vote_score', { ascending: false })
        break
      case 'controversial':
        query = query.order('upvotes', { ascending: true })
        break
      default:
        query = query.order('created_at', { ascending: false })
    }

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    // Get comments
    const { data: comments, error, count } = await query

    if (error) {
      console.error('Error fetching comments:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch comments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get media info from database
    let mediaInfo = await supabase
      .from('media')
      .select('*')
      .eq('media_id', media_id)
      .eq('client_type', client_type.toLowerCase())
      .single()
      .then(({ data, error }) => ({ data, error }))

    // If media not found in database, try to fetch from client API and cache it
    if (!mediaInfo.data && !mediaInfo.error) {
      console.log(`Media ${media_id} not found in database, fetching from ${client_type} API...`)

      const mediaData = await fetchMediaFromClientAPI(client_type, media_id, 'anime')

      if (mediaData) {
        // Cache in database for future use
        const { data: inserted, error: insertError } = await supabase
          .from('media')
          .insert({
            media_id: mediaData.media_id,
            client_type: client_type,
            media_type: mediaData.type,
            title: mediaData.title,
            year: mediaData.year,
            poster: mediaData.poster,
          })
          .select('*')
          .single()

        if (insertError) {
          console.error('Error inserting media:', insertError)
        } else {
          console.log('Media cached in database:', inserted)
          mediaInfo = { data: inserted, error: null }
        }
      }
    }

    // Calculate stats
    const stats = {
      commentCount: count || 0,
      totalUpvotes: comments?.reduce((sum: number, c: any) => sum + (c.upvotes || 0), 0) || 0,
      totalDownvotes: comments?.reduce((sum: number, c: any) => sum + (c.downvotes || 0), 0) || 0,
      netScore: comments?.reduce((sum: number, c: any) => sum + (c.vote_score || 0), 0) || 0,
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return new Response(
      JSON.stringify({
        success: true,
        media: mediaInfo.data || null,
        comments: comments || [],
        stats,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Media API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
