# Configuration Guide

Complete configuration guide for Commentum Shelby.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Required Variables](#required-variables)
3. [Optional Variables](#optional-variables)
4. [Role Management](#role-management)
5. [Platform Integration](#platform-integration)
6. [Discord Integration](#discord-integration)

---

## Environment Variables

Commentum Shelby uses environment variables for configuration. These should be set in your Supabase project's Edge Functions settings.

### Setting Environment Variables

1. Go to Supabase Dashboard
2. Navigate to **Settings → Edge Functions**
3. Add environment variables in the **Environment Variables** section
4. Click **Save**

---

## Required Variables

### SUPABASE_URL

Your Supabase project URL.

**Example**:
```
https://your-project.supabase.co
```

**How to find**:
- Go to Supabase Dashboard
- Navigate to **Settings → API**
- Copy the **Project URL**

### SUPABASE_SERVICE_ROLE_KEY

Your Supabase service role key (full database access).

**Example**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**How to find**:
- Go to Supabase Dashboard
- Navigate to **Settings → API**
- Copy the **service_role** secret
- ⚠️ **Keep this secret!** This key has full database access.

### JWT_SECRET

Secret key for JWT signing/verification.

**Example**:
```
aF9hR7xM3kP5lQ8sT2vW6yZ1bN4cD7eJ0gH3iK6mO9pR2uS5vV8yX1bA4dG7fI0jL3
```

**How to generate**:
```bash
# Generate a random JWT secret
openssl rand -base64 32
```

**Important**:
- This secret is used to sign and verify JWT tokens
- If leaked, users can forge tokens
- Keep secure and never commit to version control
- Store in environment variables only

---

## Optional Variables

### System Settings

#### SYSTEM_ENABLED

Master system toggle. When disabled, all comment operations are blocked.

**Default**: `true`

**Example**:
```
SYSTEM_ENABLED=true
```

**Use case**: Temporarily disable comments system during maintenance.

#### MAX_COMMENT_LENGTH

Maximum number of characters allowed in a comment.

**Default**: `10000`

**Example**:
```
MAX_COMMENT_LENGTH=5000
```

**Use case**: Limit comment length to prevent spam.

#### MAX_NESTING_LEVEL

Maximum reply depth for nested comments.

**Default**: `10`

**Example**:
```
MAX_NESTING_LEVEL=5
```

**Use case**: Limit comment nesting to improve readability.

---

### Rate Limiting

#### RATE_LIMIT_COMMENTS_PER_HOUR

Maximum comments a user can post per hour.

**Default**: `30`

**Example**:
```
RATE_LIMIT_COMMENTS_PER_HOUR=10
```

**Use case**: Prevent spam comments.

#### RATE_LIMIT_VOTES_PER_HOUR

Maximum votes a user can cast per hour.

**Default**: `100`

**Example**:
```
RATE_LIMIT_VOTES_PER_HOUR=50
```

**Use case**: Prevent vote manipulation.

#### RATE_LIMIT_REPORTS_PER_HOUR

Maximum reports a user can submit per hour.

**Default**: `10`

**Example**:
```
RATE_LIMIT_REPORTS_PER_HOUR=5
```

**Use case**: Prevent report spam.

---

### Feature Toggles

#### VOTING_ENABLED

Enable or disable voting system.

**Default**: `true`

**Example**:
```
VOTING_ENABLED=false
```

**Use case**: Temporarily disable voting during investigation.

#### REPORTING_ENABLED

Enable or disable reporting system.

**Default**: `true`

**Example**:
```
REPORTING_ENABLED=false
```

**Use case**: Disable reporting if you have a different moderation system.

---

### Auto-Moderation Thresholds

These thresholds control automatic moderation based on warning count.

#### AUTO_WARN_THRESHOLD

Number of warnings before auto-warning is triggered (informational only).

**Default**: `3`

**Example**:
```
AUTO_WARN_THRESHOLD=2
```

#### AUTO_MUTE_THRESHOLD

Number of warnings before auto-mute is suggested (informational only).

**Default**: `5`

**Example**:
```
AUTO_MUTE_THRESHOLD=4
```

#### AUTO_BAN_THRESHOLD

Number of warnings before auto-ban is suggested (informational only).

**Default**: `10`

**Example**:
```
AUTO_BAN_THRESHOLD=8
```

**Note**: These are thresholds for display/information purposes. Actual auto-moderation actions are handled by moderators/admins.

---

### Banned Content

#### BANNED_KEYWORDS

Comma-separated list of prohibited keywords in comments.

**Default**: `[]` (empty)

**Example**:
```
BANNED_KEYWORDS=spam,scam,clickbait,nsfw
```

**Use case**: Automatically block comments containing specific keywords.

**Behavior**:
- Keywords are case-insensitive
- Comments containing any keyword will be rejected
- User-friendly error message shown

---

### Discord Integration

#### DISCORD_NOTIFICATIONS_ENABLED

Enable or disable Discord notifications.

**Default**: `true`

**Example**:
```
DISCORD_NOTIFICATIONS_ENABLED=false
```

#### DISCORD_WEBHOOK_URL

Discord webhook URL for notifications.

**Example**:
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234567890/abcdefg...
```

**How to create webhook**:
1. Go to Discord server settings
2. Navigate to **Integrations → Webhooks**
3. Create new webhook
4. Copy webhook URL

#### DISCORD_BOT_TOKEN

Discord bot token for API access (for Discord bot integration).

**Example**:
```
DISCORD_BOT_TOKEN=MTIzNDU2Nzg5MA.GhIjKl.MnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYz
```

**How to get**:
1. Go to Discord Developer Portal
2. Create bot application
3. Add bot to server
4. Copy bot token from bot settings

#### DISCORD_CLIENT_ID

Discord client ID for bot.

**Example**:
```
DISCORD_CLIENT_ID=123456789012345678
```

#### DISCORD_GUILD_ID

Discord guild (server) ID for bot.

**Example**:
```
DISCORD_GUILD_ID=123456789012345678
```

#### DISCORD_BOT_IDS

Comma-separated list of Discord bot user IDs (for special permissions).

**Example**:
```
DISCORD_BOT_IDS=123456789012345678,987654321098765432
```

---

### Platform API Keys

#### SIMKL_CLIENT_ID

SIMKL API client ID for fetching media info.

**Example**:
```
SIMKL_CLIENT_ID=your-simkl-client-id
```

**How to get**:
1. Go to [SIMKL API](https://simkl.com/api/)
2. Register your application
3. Copy your client ID

#### MAL_CLIENT_ID

MyAnimeList API client ID for fetching media info.

**Example**:
```
MAL_CLIENT_ID=your-mal-client-id
```

**How to get**:
1. Go to [MAL API](https://myanimelist.net/apiconfig)
2. Register your application
3. Copy your client ID

**Note**: AniList does not require an API key (uses public GraphQL API).

---

## Role Management

Roles are stored in the `mod_plus` table, NOT in environment variables.

### Role Hierarchy

1. **user**: Basic user access (default)
2. **moderator**: Can pin, lock, warn, mute, resolve reports
3. **admin**: All moderator permissions + ban/unban users
4. **super_admin**: All admin permissions + announcements CRUD

### Adding Roles

#### Add Moderator

```sql
INSERT INTO mod_plus (user_id, username, role)
VALUES ('12345', 'ModeratorName', 'moderator');
```

#### Add Admin

```sql
INSERT INTO mod_plus (user_id, username, role)
VALUES ('67890', 'AdminName', 'admin');
```

#### Add Super Admin

```sql
INSERT INTO mod_plus (user_id, username, role)
VALUES ('11111', 'SuperAdminName', 'super_admin');
```

### Updating Roles

#### Promote to Admin

```sql
UPDATE mod_plus
SET role = 'admin', updated_at = NOW()
WHERE user_id = '12345';
```

#### Demote to User

```sql
UPDATE mod_plus
SET role = 'user', updated_at = NOW()
WHERE user_id = '12345';
```

#### Remove Role

```sql
DELETE FROM mod_plus WHERE user_id = '12345';
```

### Viewing Roles

#### View All Moderators/Admins

```sql
SELECT * FROM mod_plus ORDER BY role, created_at;
```

#### View Specific Role

```sql
SELECT * FROM mod_plus WHERE role = 'moderator';
```

#### Check User's Role

```sql
SELECT role FROM mod_plus WHERE user_id = '12345';
```

---

## Platform Integration

Commentum Shelby integrates with multiple platforms for user authentication and media information.

### Supported Platforms

1. **AniList**: GraphQL API, no authentication required for media info
2. **MyAnimeList**: REST API, requires `MAL_CLIENT_ID`
3. **SIMKL**: REST API, requires `SIMKL_CLIENT_ID`

### AniList Integration

**OAuth Flow**:
1. User authenticates with AniList OAuth
2. Frontend receives access token
3. Frontend sends token to `/auth` endpoint
4. Backend verifies token with AniList API
5. Backend generates JWT and returns to frontend

**Media Info**:
- Fetches from public AniList GraphQL API
- No API key required
- Supports anime and manga

### MyAnimeList Integration

**OAuth Flow**:
1. User authenticates with MAL OAuth
2. Frontend receives access token
3. Frontend sends token to `/auth` endpoint
4. Backend verifies token with MAL API
5. Backend generates JWT and returns to frontend

**Media Info**:
- Requires `MAL_CLIENT_ID`
- Supports anime and manga

**Setup**:
1. Go to [MAL API](https://myanimelist.net/apiconfig)
2. Register your application
3. Set `MAL_CLIENT_ID` environment variable

### SIMKL Integration

**OAuth Flow**:
1. User authenticates with SIMKL OAuth
2. Frontend receives access token
3. Frontend sends token to `/auth` endpoint
4. Backend verifies token with SIMKL API
5. Backend generates JWT and returns to frontend

**Media Info**:
- Requires `SIMKL_CLIENT_ID`
- Supports anime and manga

**Setup**:
1. Go to [SIMKL API](https://simkl.com/api/)
2. Register your application
3. Set `SIMKL_CLIENT_ID` environment variable

---

## Discord Integration

### Webhook Notifications

Discord webhook notifications are sent for various events:

**Notification Types**:
- `comment_created`: New comment posted
- `comment_updated`: Comment edited
- `comment_deleted`: Comment deleted (by user or moderator)
- `comment_reported`: Comment reported by user
- `user_banned`: User banned
- `user_warned`: User warned/muted/unmuted
- `announcement_published`: New announcement published

**Setup**:
1. Create Discord webhook
2. Set `DISCORD_WEBHOOK_URL` environment variable
3. Enable with `DISCORD_NOTIFICATIONS_ENABLED=true`

**Notification Format**:
```
💬 New Comment
TestUser commented on Attack on Titan

User: TestUser
Content: Great episode!
```

### Discord Bot

The Discord bot provides slash commands for moderation and user management.

**Setup**:
1. Create Discord bot application
2. Enable bot intents
3. Add bot to server
4. Set environment variables:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID`
5. Deploy Discord bot function
6. Register slash commands

**Available Commands**:
- `/register` - Register platform account
- `/report` - Report a comment
- `/user` - Get user information
- `/comment` - Get comment details
- `/stats` - View system statistics
- `/warn` - Warn a user (Moderator+)
- `/unwarn` - Remove warning (Moderator+)
- `/mute` - Mute a user (Moderator+)
- `/unmute` - Remove mute (Moderator+)
- `/delete` - Delete a comment (Moderator+)
- `/ban` - Ban a user (Admin+)
- `/unban` - Unban a user (Admin+)
- `/shadowban` - Shadow ban a user (Admin+)
- `/unshadowban` - Remove shadow ban (Admin+)
- `/promote` - Promote user to higher role (Super Admin)
- `/demote` - Demote user to lower role (Super Admin)
- `/config` - View/update system configuration (Super Admin)
- `/add` - Add server configuration (Super Admin)

See [Discord Bot Guide](./discord-bot.md) for detailed setup instructions.

---

## Best Practices

### Security

1. **Never commit secrets**: Keep all secret keys out of version control
2. **Use strong secrets**: Generate long, random strings for sensitive variables
3. **Rotate regularly**: Change secrets periodically for security
4. **Limit access**: Only grant necessary permissions to each variable

### Performance

1. **Set reasonable limits**: Adjust rate limits based on your traffic
2. **Monitor usage**: Track API usage and adjust limits as needed
3. **Cache appropriately**: Media caching reduces external API calls

### Monitoring

1. **Enable notifications**: Set up Discord notifications for important events
2. **Review logs**: Regularly check Supabase function logs
3. **Track metrics**: Monitor comment volume, reports, and moderation actions

---

## Testing Configuration

### Verify Environment Variables

1. Go to Supabase Dashboard
2. Navigate to **Settings → Edge Functions**
3. Check that all required variables are set
4. Test authentication endpoint:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/auth \
     -H "Content-Type: application/json" \
     -d '{"token":"test","client_type":"anilist"}'
   ```

### Test Platform Integration

Test each platform's authentication:

```bash
# AniList
curl -X POST https://your-project.supabase.co/functions/v1/auth \
  -H "Content-Type: application/json" \
  -d '{"token":"anilist_token","client_type":"anilist"}'

# MAL
curl -X POST https://your-project.supabase.co/functions/v1/auth \
  -H "Content-Type: application/json" \
  -d '{"token":"mal_token","client_type":"myanimelist"}'

# SIMKL
curl -X POST https://your-project.supabase.co/functions/v1/auth \
  -H "Content-Type: application/json" \
  -d '{"token":"simkl_token","client_type":"simkl"}'
```

### Test Discord Notifications

Trigger a test event:

```bash
# Create a comment and check Discord webhook
curl -X POST https://your-project.supabase.co/functions/v1/comments \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "jwt_token": "your_jwt_token",
    "media_id": "12345",
    "content": "Test comment for Discord notifications"
  }'
```

---

## Troubleshooting

### JWT Issues

**Problem**: "JWT_SECRET environment variable is not set"

**Solution**:
1. Check Supabase Dashboard → Settings → Edge Functions
2. Ensure `JWT_SECRET` is set
3. Regenerate and redeploy if needed

### Platform API Issues

**Problem**: "Failed to fetch media from API"

**Solution**:
1. Verify API client IDs are set correctly
2. Check API rate limits
3. Review Supabase function logs for detailed errors

### Discord Notification Issues

**Problem**: Discord webhook not receiving notifications

**Solution**:
1. Verify `DISCORD_WEBHOOK_URL` is correct
2. Check `DISCORD_NOTIFICATIONS_ENABLED=true`
3. Test webhook URL manually:
   ```bash
   curl -X POST $DISCORD_WEBHOOK_URL \
     -H "Content-Type: application/json" \
     -d '{"content": "Test webhook"}'
   ```

---

## Configuration Examples

### Development Environment

```bash
# Required
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
JWT_SECRET=dev-secret-change-in-production

# System Settings
SYSTEM_ENABLED=true
MAX_COMMENT_LENGTH=10000
MAX_NESTING_LEVEL=10

# Rate Limiting (relaxed for dev)
RATE_LIMIT_COMMENTS_PER_HOUR=100
RATE_LIMIT_VOTES_PER_HOUR=500
RATE_LIMIT_REPORTS_PER_HOUR=50

# Feature Toggles
VOTING_ENABLED=true
REPORTING_ENABLED=true

# Discord (optional for dev)
DISCORD_NOTIFICATIONS_ENABLED=false
```

### Production Environment

```bash
# Required
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
JWT_SECRET=strong-random-secret-here

# System Settings
SYSTEM_ENABLED=true
MAX_COMMENT_LENGTH=5000
MAX_NESTING_LEVEL=5

# Rate Limiting (stricter for prod)
RATE_LIMIT_COMMENTS_PER_HOUR=30
RATE_LIMIT_VOTES_PER_HOUR=100
RATE_LIMIT_REPORTS_PER_HOUR=10

# Feature Toggles
VOTING_ENABLED=true
REPORTING_ENABLED=true

# Auto-Moderation
AUTO_WARN_THRESHOLD=3
AUTO_MUTE_THRESHOLD=5
AUTO_BAN_THRESHOLD=10

# Banned Content
BANNED_KEYWORDS=spam,scam,clickbait,nsfw

# Discord (enabled for prod)
DISCORD_NOTIFICATIONS_ENABLED=true
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_BOT_TOKEN=MTIzNDU2...
DISCORD_CLIENT_ID=123456789012345678
DISCORD_GUILD_ID=123456789012345678

# Platform APIs
MAL_CLIENT_ID=your-mal-client-id
SIMKL_CLIENT_ID=your-simkl-client-id
```

---

## Additional Resources

- [API Reference](./api-reference.md) - Complete API documentation
- [Database Schema](./database-schema.md) - Database structure details
- [Deployment Guide](./deployment.md) - Deployment instructions
- [Discord Bot Guide](./discord-bot.md) - Discord integration details
