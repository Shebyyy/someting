// Configuration utilities - using environment variables for system settings and mod_plus table for roles

export interface Config {
  // System settings
  system_enabled: boolean;
  max_comment_length: number;
  max_nesting_level: number;

  // Rate limiting
  rate_limit_comments_per_hour: number;
  rate_limit_votes_per_hour: number;
  rate_limit_reports_per_hour: number;

  // Feature toggles
  voting_enabled: boolean;
  reporting_enabled: boolean;

  // Auto-moderation thresholds
  auto_warn_threshold: number;
  auto_mute_threshold: number;
  auto_ban_threshold: number;

  // Banned content
  banned_keywords: string[];

  // Moderation bot IDs (for Discord bot)
  discord_bot_ids: string[];
}

/**
 * Get configuration from environment variables
 * Falls back to default values if not set
 */
export function getConfig(): Config {
  return {
    // System settings
    system_enabled: getEnvBool('SYSTEM_ENABLED', true),
    max_comment_length: getEnvNumber('MAX_COMMENT_LENGTH', 10000),
    max_nesting_level: getEnvNumber('MAX_NESTING_LEVEL', 10),

    // Rate limiting
    rate_limit_comments_per_hour: getEnvNumber('RATE_LIMIT_COMMENTS_PER_HOUR', 30),
    rate_limit_votes_per_hour: getEnvNumber('RATE_LIMIT_VOTES_PER_HOUR', 100),
    rate_limit_reports_per_hour: getEnvNumber('RATE_LIMIT_REPORTS_PER_HOUR', 10),

    // Feature toggles
    voting_enabled: getEnvBool('VOTING_ENABLED', true),
    reporting_enabled: getEnvBool('REPORTING_ENABLED', true),

    // Auto-moderation thresholds
    auto_warn_threshold: getEnvNumber('AUTO_WARN_THRESHOLD', 3),
    auto_mute_threshold: getEnvNumber('AUTO_MUTE_THRESHOLD', 5),
    auto_ban_threshold: getEnvNumber('AUTO_BAN_THRESHOLD', 10),

    // Banned content
    banned_keywords: getEnvArray('BANNED_KEYWORDS', []),

    // Moderation bot IDs
    discord_bot_ids: getEnvArray('DISCORD_BOT_IDS', []),
  };
}

/**
 * Get user role from mod_plus table (NOT from environment variables)
 * Requires Supabase client to query database
 */
export async function getUserRole(supabase: any, userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('mod_plus')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (error) {
      // If no record found, return 'user'
      if (error.code === 'PGRST116') {
        return 'user';
      }
      console.error('Error fetching user role:', error);
      return 'user';
    }

    return data?.role || 'user';
  } catch (error) {
    console.error('Error in getUserRole:', error);
    return 'user';
  }
}

/**
 * Check if user has at least the specified role level
 */
export async function hasMinRole(supabase: any, userId: string, minRole: string): Promise<boolean> {
  const userRole = await getUserRole(supabase, userId);
  const roleHierarchy: { [key: string]: number } = {
    'user': 0,
    'moderator': 1,
    'admin': 2,
    'super_admin': 3,
  };

  return roleHierarchy[userRole] >= roleHierarchy[minRole];
}

/**
 * Get boolean environment variable
 */
function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = Deno.env.get(key);
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

/**
 * Get number environment variable
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = Deno.env.get(key);
  if (value === undefined) {
    return defaultValue;
  }
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Get array environment variable (comma-separated)
 */
function getEnvArray(key: string, defaultValue: string[]): string[] {
  const value = Deno.env.get(key);
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

/**
 * Check if a user ID is a moderator bot
 */
export function isModeratorBot(userId: string): boolean {
  const botIds = getEnvArray('DISCORD_BOT_IDS', []);
  return botIds.includes(userId);
}
