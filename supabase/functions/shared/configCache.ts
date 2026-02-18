// Config cache to reduce database queries
// Uses stale-while-revalidate pattern for optimal performance
// Cache is stored globally and persists within same Edge Function instance

interface ConfigCache {
  data: Record<string, any>
  lastFetch: number
  ttl: number // Time to live in ms
  fetching: boolean // Prevent duplicate fetches
}

const configCache: ConfigCache = {
  data: {},
  lastFetch: 0,
  ttl: 60000, // 1 minute cache
  fetching: false
}

// Store fetched configs for instant access on stale-while-revalidate
let cachedConfigs: Record<string, any> = {}
let cacheTimestamp = 0
let isRefreshing = false

// Commonly accessed configs with defaults
const DEFAULT_CONFIGS: Record<string, any> = {
  system_enabled: true,
  voting_enabled: true,
  reporting_enabled: true,
  max_comment_length: 10000,
  max_nesting_level: 10,
  banned_keywords: [],
  rate_limit_comments_per_hour: 30,
  rate_limit_votes_per_hour: 100,
  rate_limit_reports_per_hour: 10,
  auto_warn_threshold: 3,
  auto_mute_threshold: 5,
  auto_ban_threshold: 10,
}

// Get a single config value (uses stale-while-revalidate)
// Returns cached data immediately, triggers background refresh if stale
export async function getConfig(supabase: any, key: string): Promise<any> {
  const now = Date.now()
  const isStale = now - cacheTimestamp > configCache.tlt

  // Trigger background refresh if stale (non-blocking)
  if (isStale && !isRefreshing) {
    triggerBackgroundRefresh(supabase)
  }

  // Return cached value immediately (stale data is OK)
  if (cachedConfigs[key] !== undefined) {
    return cachedConfigs[key]
  }

  // If no cached data at all, fetch synchronously once
  if (Object.keys(cachedConfigs).length === 0) {
    await refreshCacheSync(supabase)
  }

  return cachedConfigs[key] ?? DEFAULT_CONFIGS[key] ?? null
}

// Get multiple config values at once (single query, stale-while-revalidate)
// FAST: Returns cached data immediately, never blocks on DB
export async function getConfigs(supabase: any, keys: string[]): Promise<Record<string, any>> {
  const now = Date.now()
  const isStale = now - cacheTimestamp > configCache.tlt

  // Trigger background refresh if stale (non-blocking)
  if (isStale && !isRefreshing) {
    triggerBackgroundRefresh(supabase)
  }

  // Check if we have NO cache at all (first request ever)
  if (Object.keys(cachedConfigs).length === 0) {
    // Fetch synchronously on first call only
    await refreshCacheSync(supabase)
  }

  // Build result from cache (instant)
  const result: Record<string, any> = {}
  for (const key of keys) {
    result[key] = cachedConfigs[key] ?? DEFAULT_CONFIGS[key] ?? null
  }

  return result
}

// Background refresh - non-blocking, fire and forget
function triggerBackgroundRefresh(supabase: any) {
  if (isRefreshing) return
  isRefreshing = true

  // Fire and forget - don't await
  refreshCacheSync(supabase).finally(() => {
    isRefreshing = false
  })
}

// Synchronous refresh - actually awaits DB call
async function refreshCacheSync(supabase: any): Promise<void> {
  try {
    // Get configs from environment variables (since we're using env vars now)
    const newCache: Record<string, any> = {
      system_enabled: getEnvBool('SYSTEM_ENABLED', true),
      max_comment_length: getEnvNumber('MAX_COMMENT_LENGTH', 10000),
      max_nesting_level: getEnvNumber('MAX_NESTING_LEVEL', 10),
      rate_limit_comments_per_hour: getEnvNumber('RATE_LIMIT_COMMENTS_PER_HOUR', 30),
      rate_limit_votes_per_hour: getEnvNumber('RATE_LIMIT_VOTES_PER_HOUR', 100),
      rate_limit_reports_per_hour: getEnvNumber('RATE_LIMIT_REPORTS_PER_HOUR', 10),
      auto_warn_threshold: getEnvNumber('AUTO_WARN_THRESHOLD', 3),
      auto_mute_threshold: getEnvNumber('AUTO_MUTE_THRESHOLD', 5),
      auto_ban_threshold: getEnvNumber('AUTO_BAN_THRESHOLD', 10),
      banned_keywords: getEnvArray('BANNED_KEYWORDS', []),
      voting_enabled: getEnvBool('VOTING_ENABLED', true),
      reporting_enabled: getEnvBool('REPORTING_ENABLED', true),
    }

    // Atomic update
    cachedConfigs = newCache
    cacheTimestamp = Date.now()
  } catch (error) {
    console.error('Failed to refresh config cache:', error)
  }
}

// Force refresh cache (call after config updates)
export async function forceRefreshCache(supabase: any): Promise<void> {
  cacheTimestamp = 0
  await refreshCacheSync(supabase)
}

// Get boolean environment variable
function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = Deno.env.get(key)
  if (value === undefined) {
    return defaultValue
  }
  return value.toLowerCase() === 'true'
}

// Get number environment variable
function getEnvNumber(key: string, defaultValue: number): number {
  const value = Deno.env.get(key)
  if (value === undefined) {
    return defaultValue
  }
  const num = parseInt(value, 10)
  return isNaN(num) ? defaultValue : num
}

// Get array environment variable (comma-separated)
function getEnvArray(key: string, defaultValue: string[]): string[] {
  const value = Deno.env.get(key)
  if (value === undefined || value.trim() === '') {
    return defaultValue
  }
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0)
}
