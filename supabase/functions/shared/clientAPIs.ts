// Client API types and validation utilities
// Includes functions to fetch media info from client APIs

export interface UserInfo {
  user_id: string;
  username: string;
  avatar?: string;
}

export interface MediaInfo {
  media_id: string;
  type: string; // 'anime', 'manga', 'movie', 'tv', 'other'
  title: string;
  year?: number;
  poster?: string;
}

export interface CommentInfo {
  id: number;
  user_id: string;
  username: string;
  user_role: string;
  content: string;
  media_id: string;
  media_type: string;
  media_title: string;
  media_year?: number;
  media_poster?: string;
  parent_id?: number;
  created_at: string;
  updated_at: string;
  upvotes: number;
  downvotes: number;
  vote_score: number;
  deleted: boolean;
  pinned: boolean;
  locked: boolean;
  edited: boolean;
}

// ========================
// Client API Functions
// ========================

/**
 * Fetch media info from AniList
 */
async function fetchFromAniList(mediaId: string, mediaType: string): Promise<MediaInfo | null> {
  try {
    const query = `
      query {
        ${mediaType}(id: ${mediaId}) {
          id
          title { romaji }
          coverImage { large }
          seasonYear
        }
      }
    `;

    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();

    if (data.errors) {
      console.error('AniList API error:', data.errors);
      return null;
    }

    const media = data.data?.[mediaType];
    if (!media) return null;

    return {
      media_id: String(media.id),
      type: mediaType === 'manga' ? 'manga' : 'anime',
      title: media.title.romaji,
      year: media.seasonYear,
      poster: media.coverImage?.large,
    };
  } catch (error) {
    console.error('Error fetching from AniList:', error);
    return null;
  }
}

/**
 * Fetch media info from MyAnimeList
 */
async function fetchFromMAL(mediaId: string, mediaType: string): Promise<MediaInfo | null> {
  try {
    const endpoint = mediaType === 'manga'
      ? `https://api.myanimelist.net/v2/manga/${mediaId}`
      : `https://api.myanimelist.net/v2/anime/${mediaId}`;

    const MAL_CLIENT_ID = Deno.env.get('MAL_CLIENT_ID');
    if (!MAL_CLIENT_ID) {
      console.error('MAL_CLIENT_ID not configured');
      return null;
    }

    const response = await fetch(endpoint, {
      headers: { 'X-MAL-CLIENT-ID': MAL_CLIENT_ID },
    });

    if (!response.ok) {
      console.error('MAL API error:', response.status);
      return null;
    }

    const data = await response.json();

    return {
      media_id: String(data.id),
      type: mediaType === 'manga' ? 'manga' : 'anime',
      title: data.title,
      year: data.start_date?.substring(0, 4) ? parseInt(data.start_date.substring(0, 4)) : undefined,
      poster: data.main_picture?.large,
    };
  } catch (error) {
    console.error('Error fetching from MAL:', error);
    return null;
  }
}

/**
 * Fetch media info from SIMKL
 */
async function fetchFromSIMKL(mediaId: string, mediaType: string): Promise<MediaInfo | null> {
  try {
    const SIMKL_CLIENT_ID = Deno.env.get('SIMKL_CLIENT_ID');
    if (!SIMKL_CLIENT_ID) {
      console.error('SIMKL_CLIENT_ID not configured');
      return null;
    }

    const endpoint = mediaType === 'manga'
      ? `https://api.simkl.com/manga/manga?id=${mediaId}&extended=full`
      : `https://api.simkl.com/anime/anime?id=${mediaId}&extended=full`;

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${SIMKL_CLIENT_ID}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('SIMKL API error:', response.status);
      return null;
    }

    const data = await response.json();

    return {
      media_id: String(data.id),
      type: mediaType === 'manga' ? 'manga' : 'anime',
      title: data.title,
      year: data.year,
      poster: data.poster ? `https://simkl.in/posters/${data.poster}_m.jpg` : undefined,
    };
  } catch (error) {
    console.error('Error fetching from SIMKL:', error);
    return null;
  }
}

/**
 * Fetch media info from appropriate client API based on client_type
 * Falls back through APIs in order
 */
export async function fetchMediaFromClientAPI(
  clientType: string,
  mediaId: string,
  mediaType: string
): Promise<MediaInfo | null> {
  // Try to fetch from configured client type first
  switch (clientType.toLowerCase()) {
    case 'anilist':
      return await fetchFromAniList(mediaId, mediaType);
    case 'myanimelist':
      return await fetchFromMAL(mediaId, mediaType);
    case 'simkl':
      return await fetchFromSIMKL(mediaId, mediaType);
    case 'other':
      // Try all APIs in order
      let media = await fetchFromAniList(mediaId, mediaType);
      if (media) return media;
      media = await fetchFromMAL(mediaId, mediaType);
      if (media) return media;
      return await fetchFromSIMKL(mediaId, mediaType);
    default:
      console.error('Unknown client type:', clientType);
      return null;
  }
}

/**
 * Validate user info object
 */
export function validateUserInfo(userInfo: any): userInfo is UserInfo {
  if (!userInfo || typeof userInfo !== 'object') {
    return false;
  }

  const { user_id, username, avatar } = userInfo;

  // Check required fields
  if (typeof user_id !== 'string' || user_id.trim().length === 0) {
    return false;
  }

  if (typeof username !== 'string' || username.length < 1 || username.length > 50) {
    return false;
  }

  // Check optional avatar
  if (avatar !== undefined && typeof avatar !== 'string') {
    return false;
  }

  return true;
}

/**
 * Validate media info object
 */
export function validateMediaInfo(mediaInfo: any): mediaInfo is MediaInfo {
  if (!mediaInfo || typeof mediaInfo !== 'object') {
    return false;
  }

  const { media_id, type, title, year, poster } = mediaInfo;

  // Check required fields
  if (typeof media_id !== 'string' || media_id.trim().length === 0) {
    return false;
  }

  const validTypes = ['anime', 'manga', 'movie', 'tv', 'other'];
  if (typeof type !== 'string' || !validTypes.includes(type.toLowerCase())) {
    return false;
  }

  if (typeof title !== 'string' || title.length < 1 || title.length > 200) {
    return false;
  }

  // Check optional year
  if (year !== undefined) {
    if (typeof year !== 'number' || year < 1900 || year > 2100) {
      return false;
    }
  }

  // Check optional poster
  if (poster !== undefined && typeof poster !== 'string') {
    return false;
  }

  return true;
}

/**
 * Validate client type
 */
export function validateClientType(clientType: string): boolean {
  const validTypes = ['anilist', 'myanimelist', 'simkl', 'other'];
  return validTypes.includes(clientType.toLowerCase());
}

/**
 * Validate vote type
 */
export function validateVoteType(voteType: string): boolean {
  const validTypes = ['upvote', 'downvote', 'remove'];
  return validTypes.includes(voteType.toLowerCase());
}

/**
 * Validate report reason
 */
export function validateReportReason(reason: string): boolean {
  const validReasons = ['spam', 'offensive', 'harassment', 'spoiler', 'nsfw', 'off_topic', 'other'];
  return validReasons.includes(reason.toLowerCase());
}
