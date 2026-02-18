// User Management Utilities
// Helper functions for managing users table (simple version - matches 001_initial_schema.sql)

export interface UserRestrictions {
  banned: boolean;
  banned_at: string | null;
  banned_reason: string | null;
  muted: boolean;
  muted_until: string | null;
  muted_reason: string | null;
  shadow_banned: boolean;
  warnings: number;
  last_warning_at: string | null;
  last_warning_reason: string | null;
}

/**
 * Get or create a user in database
 * Updates existing user info if found, creates new user if not found
 */
export async function getOrCreateUser(
  supabase: any,
  clientType: string,
  userId: string,
  username: string,
  userAvatar?: string,
  userRole?: string
): Promise<any> {
  // Try to find existing user and update their info
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .eq('client_type', clientType)
    .single()

  // If user exists, update their info and return
  if (existingUser) {
    const { data: updated } = await supabase
      .from('users')
      .update({
        username: username,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('client_type', clientType)
      .select('*')
      .single()

    return updated || existingUser;
  }

  // Create new user
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      user_id: userId,
      username: username,
      client_type: clientType,
    })
    .select('*')
    .single()

  if (error) throw error
  return newUser;
}

/**
 * Update user comment activity (increment comment count, update timestamps)
 */
export async function updateUserCommentActivity(
  supabase: any,
  clientType: string,
  userId: string,
  commentId?: number
): Promise<void> {
  // Check if user exists first
  const { data: existingUser } = await supabase
    .from('users')
    .select('user_id, client_type')
    .eq('user_id', userId)
    .eq('client_type', clientType)
    .single()

  // Only update if user exists
  if (existingUser) {
    const { error } = await supabase
      .from('users')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('client_type', clientType)

    if (error) {
      console.error('Error updating user comment activity:', error);
      throw error;
    }
  }
}

/**
 * Update user vote activity (increment vote count)
 */
export async function updateUserVoteActivity(
  supabase: any,
  clientType: string,
  userId: string
): Promise<void> {
  // Check if user exists first
  const { data: existingUser } = await supabase
    .from('users')
    .select('user_id, client_type')
    .eq('user_id', userId)
    .eq('client_type', clientType)
    .single()

  // Only update if user exists
  if (existingUser) {
    const { error } = await supabase
      .from('users')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('client_type', clientType)

    if (error) {
      console.error('Error updating user vote activity:', error);
      throw error;
    }
  }
}

/**
 * Add warning to user
 * Returns: { warnings, error }
 */
export async function addUserWarning(
  supabase: any,
  clientType: string,
  userId: string,
  reason: string,
  warnedBy: string
): Promise<{ warnings: number; error?: any }> {
  // Increment user_warnings
  const { data, error } = await supabase
    .from('users')
    .update({
      user_warnings: supabase.raw('user_warnings + 1'),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('client_type', clientType)
    .select('user_warnings')
    .single()

  if (error) {
    return { warnings: 0, error };
  }

  return { warnings: data || 0 };
}

/**
 * Remove warning from user (unwarn)
 * Returns: { warnings, error }
 */
export async function removeUserWarning(
  supabase: any,
  clientType: string,
  userId: string,
  removedBy: string
): Promise<{ warnings: number; error?: any }> {
  // Decrement user_warnings (minimum 0)
  const { data, error } = await supabase
    .from('users')
    .update({
      user_warnings: supabase.raw('GREATEST(user_warnings - 1, 0)'),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('client_type', clientType)
    .select('user_warnings')
    .single()

  if (error) {
    return { warnings: 0, error };
  }

  return { warnings: data || 0 };
}

/**
 * Ban a user (or shadow ban)
 * Returns: { success, error }
 */
export async function banUser(
  supabase: any,
  clientType: string,
  userId: string,
  reason: string,
  bannedBy: string,
  shadowBan: boolean = false
): Promise<{ success: boolean; error?: any }> {
  if (shadowBan) {
    const { error } = await supabase
      .from('users')
      .update({
        user_shadow_banned: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('client_type', clientType)

    if (error) {
      return { success: false, error };
    }

    return { success: true };
  } else {
    const { error } = await supabase
      .from('users')
      .update({
        user_banned: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('client_type', clientType)

    if (error) {
      return { success: false, error };
    }

    return { success: true };
  }
}

/**
 * Unban a user (removes both ban and shadow ban)
 * Returns: { success, error }
 */
export async function unbanUser(
  supabase: any,
  clientType: string,
  userId: string,
  unbannedBy: string
): Promise<{ success: boolean; error?: any }> {
  const { error } = await supabase
    .from('users')
    .update({
      user_banned: false,
      user_shadow_banned: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('client_type', clientType)

  if (error) {
    return { success: false, error };
  }

  return { success: true };
}

/**
 * Mute a user for specified duration
 * Duration is in hours
 * Returns: { success, error }
 */
export async function muteUser(
  supabase: any,
  clientType: string,
  userId: string,
  durationHours: number,
  reason: string,
  mutedBy: string
): Promise<{ success: boolean; error?: any }> {
  const mutedUntil = new Date();
  mutedUntil.setHours(mutedUntil.getHours() + durationHours);

  const { error } = await supabase
    .from('users')
    .update({
      user_muted_until: mutedUntil.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('client_type', clientType)

  if (error) {
    return { success: false, error };
  }

  return { success: true };
}

/**
 * Unmute a user
 * Returns: { success, error }
 */
export async function unmuteUser(
  supabase: any,
  clientType: string,
  userId: string,
  unmutedBy: string
): Promise<{ success: boolean; error?: any }> {
  const { error } = await supabase
    .from('users')
    .update({
      user_muted_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('client_type', clientType)

  if (error) {
    return { success: false, error };
  }

  return { success: true };
}

/**
 * Check user restrictions (bans, mutes, warnings)
 * Returns UserRestrictions object
 */
export async function checkUserRestrictions(
  supabase: any,
  clientType: string,
  userId: string
): Promise<UserRestrictions> {
  const { data, error } = await supabase
    .from('users')
    .select('user_banned, user_muted_until, user_shadow_banned, user_warnings')
    .eq('user_id', userId)
    .eq('client_type', clientType)
    .single()

  if (error) {
    console.error('Error checking user restrictions:', error);
    return {
      banned: false,
      banned_at: null,
      banned_reason: null,
      muted: false,
      muted_until: null,
      muted_reason: null,
      shadow_banned: false,
      warnings: 0,
      last_warning_at: null,
      last_warning_reason: null,
    };
  }

  // Check if muted
  const muted = data?.user_muted_until && new Date(data.user_muted_until) > new Date();

  return {
    banned: data?.user_banned || false,
    banned_at: data?.user_muted_until || null,
    banned_reason: null,
    muted: muted,
    muted_until: data?.user_muted_until || null,
    muted_reason: null,
    shadow_banned: data?.user_shadow_banned || false,
    warnings: data?.user_warnings || 0,
    last_warning_at: null,
    last_warning_reason: null,
  };
}

/**
 * Check if user can post comments (not banned, not muted)
 */
export async function canUserPostComment(
  supabase: any,
  clientType: string,
  userId: string
): Promise<{ canPost: boolean; reason?: string }> {
  const restrictions = await checkUserRestrictions(supabase, clientType, userId);

  if (restrictions.banned) {
    return { canPost: false, reason: 'User is banned' };
  }

  if (restrictions.muted) {
    return { canPost: false, reason: `User is muted until ${restrictions.muted_until}` };
  }

  if (restrictions.shadow_banned) {
    // Shadow banned users can post, but comments will be hidden from others
    return { canPost: true, reason: 'Shadow banned' };
  }

  return { canPost: true };
}
