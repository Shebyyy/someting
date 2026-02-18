# Discord Bot Guide

Complete guide for Discord bot integration with Commentum Shelby.

## Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [Bot Commands](#bot-commands)
4. [Slash Commands](#slash-commands)
5. [Webhook Notifications](#webhook-notifications)
6. [Advanced Configuration](#advanced-configuration)

---

## Overview

The Commentum Shelby Discord bot provides:

- **Slash commands** for moderation and user management
- **Webhook notifications** for important events
- **User registration** system linking Discord accounts to platform accounts
- **Real-time statistics** and monitoring
- **Multi-server support** with different configurations per server

### Features

- User registration (AniList, MAL, SIMKL)
- Comment reporting and management
- User warnings, mutes, and bans
- Moderation tools for moderators/admins
- System statistics and monitoring
- Announcement management
- Server-specific configuration

---

## Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Enter application name: `Commentum Shelby Bot`
4. Click **Create**

### 2. Configure Bot

1. Go to **Bot** tab
2. Click **Add Bot**
3. Enable these Privileged Gateway Intents:
   - ✅ Message Content Intent
   - ✅ Server Members Intent
   - ✅ Presence Intent
4. Copy **Token** (save as `DISCORD_BOT_TOKEN`)
5. Copy **Application ID** (save as `DISCORD_CLIENT_ID`)

### 3. Invite Bot to Server

1. Go to **OAuth2 → URL Generator**
2. Select scopes:
   - ✅ bot
   - ✅ applications.commands
3. Select bot permissions:
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Manage Messages
   - ✅ Read Message History
   - ✅ Kick Members
   - ✅ Ban Members
4. Copy generated URL
5. Open in browser and invite bot to server

### 4. Get Server ID

1. Open Discord
2. Enable Developer Mode (User Settings → Advanced)
3. Right-click on server → Copy Server ID
4. Save as `DISCORD_GUILD_ID`

### 5. Configure Webhook (Optional)

For webhook notifications:

1. Go to server settings → Integrations → Webhooks
2. Create new webhook
3. Copy webhook URL (save as `DISCORD_WEBHOOK_URL`)

### 6. Set Environment Variables

Add to Supabase Edge Functions settings:

```
DISCORD_NOTIFICATIONS_ENABLED=true
DISCORD_WEBHOOK_URL=your-webhook-url
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-bot-client-id
DISCORD_GUILD_ID=your-server-id
```

### 7. Deploy Discord Function

```bash
supabase functions deploy discord
```

### 8. Register Slash Commands

Register commands with Discord API:

```bash
# Set variables
DISCORD_TOKEN="your-bot-token"
CLIENT_ID="your-bot-client-id"

# Register all commands (see commands below)
curl -X POST https://discord.com/api/v10/applications/$CLIENT_ID/commands \
  -H "Authorization: Bot $DISCORD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "name": "register",
      "description": "Register your platform account",
      "options": [
        {
          "name": "platform",
          "description": "Platform type",
          "type": 3,
          "required": true,
          "choices": [
            {"name": "anilist", "value": "anilist"},
            {"name": "mal", "value": "myanimelist"},
            {"name": "simkl", "value": "simkl"}
          ]
        },
        {
          "name": "username",
          "description": "Your username on the platform",
          "type": 3,
          "required": true
        }
      ]
    },
    {
      "name": "report",
      "description": "Report a comment",
      "options": [
        {
          "name": "comment_id",
          "description": "Comment ID to report",
          "type": 4,
          "required": true
        },
        {
          "name": "reason",
          "description": "Reason for reporting",
          "type": 3,
          "required": true,
          "choices": [
            {"name": "spam", "value": "spam"},
            {"name": "offensive", "value": "offensive"},
            {"name": "harassment", "value": "harassment"},
            {"name": "spoiler", "value": "spoiler"},
            {"name": "nsfw", "value": "nsfw"},
            {"name": "off_topic", "value": "off_topic"},
            {"name": "other", "value": "other"}
          ]
        }
      ]
    },
    {
      "name": "user",
      "description": "Get user information",
      "options": [
        {
          "name": "platform",
          "description": "Platform type",
          "type": 3,
          "required": true,
          "choices": [
            {"name": "anilist", "value": "anilist"},
            {"name": "mal", "value": "myanimelist"},
            {"name": "simkl", "value": "simkl"}
          ]
        },
        {
          "name": "username",
          "description": "Username to look up",
          "type": 3,
          "required": true
        }
      ]
    },
    {
      "name": "comment",
      "description": "Get comment details",
      "options": [
        {
          "name": "comment_id",
          "description": "Comment ID",
          "type": 4,
          "required": true
        }
      ]
    },
    {
      "name": "stats",
      "description": "View system statistics"
    },
    {
      "name": "help",
      "description": "Show help information",
      "options": [
        {
          "name": "category",
          "description": "Help category",
          "type": 3,
          "required": false,
          "choices": [
            {"name": "general", "value": "general"},
            {"name": "moderation", "value": "moderation"},
            {"name": "admin", "value": "admin"}
          ]
        }
      ]
    }
  ]'
```

---

## Bot Commands

### Role-Based Permissions

Commands are organized by required role:

- **All Users**: `register`, `report`, `user`, `comment`, `stats`, `help`
- **Moderator+**: `warn`, `unwarn`, `mute`, `unmute`, `delete`
- **Admin+**: `ban`, `unban`, `shadowban`, `unshadowban`
- **Super Admin**: `promote`, `demote`, `config`, `add`

---

## Slash Commands

### All Users Commands

#### `/register`

Register your platform account to Discord.

**Usage**:
```
/register platform:anilist username:YourUsername
```

**Parameters**:
- `platform`: Platform type (anilist, mal, simkl)
- `username`: Your username on the platform

**Example**:
```
/register platform:anilist username:TestUser
```

**Response**:
```
✅ Successfully registered!
Discord: TestUser#1234
AniList: TestUser
```

**Notes**:
- Links Discord account to platform account
- Enables platform-specific features
- Required for some moderation actions

---

#### `/report`

Report a comment for moderation.

**Usage**:
```
/report comment_id:12345 reason:spam
```

**Parameters**:
- `comment_id`: Comment ID to report
- `reason`: Reason (spam, offensive, harassment, spoiler, nsfw, off_topic, other)

**Example**:
```
/report comment_id:12345 reason:spam
```

**Response**:
```
🚨 Report Submitted!
Comment ID: 12345
Reason: spam
Status: pending
```

**Notes**:
- Creates a report in the moderation queue
- Moderators will review the report
- You can track report status

---

#### `/user`

Get information about a user.

**Usage**:
```
/user platform:anilist username:TestUser
```

**Parameters**:
- `platform`: Platform type (anilist, mal, simkl)
- `username`: Username to look up

**Example**:
```
/user platform:anilist username:TestUser
```

**Response**:
```
👤 User Information
AniList: TestUser
Status: Active
Comments: 150
Warnings: 0
Banned: No
```

**Notes**:
- Shows user statistics
- Displays moderation status
- Shows registration date

---

#### `/comment`

Get details about a specific comment.

**Usage**:
```
/comment comment_id:12345
```

**Parameters**:
- `comment_id`: Comment ID

**Example**:
```
/comment comment_id:12345
```

**Response**:
```
💬 Comment Details
ID: 12345
Author: TestUser
Content: Great episode!
Media: Attack on Titan
Upvotes: 10
Downvotes: 0
Status: Active
```

**Notes**:
- Shows comment content and metadata
- Displays vote score
- Shows moderation status

---

#### `/stats`

View system statistics.

**Usage**:
```
/stats
```

**Response**:
```
📊 System Statistics
Total Comments: 10,000
Active Users: 500
Pending Reports: 15
Moderators: 5
Average Response Time: 200ms
Uptime: 99.9%
```

**Notes**:
- Shows overall system health
- Displays recent activity
- Updates in real-time

---

#### `/help`

Show help information.

**Usage**:
```
/help
/help category:moderation
```

**Parameters**:
- `category`: Help category (general, moderation, admin) - optional

**Example**:
```
/help category:moderation
```

**Response**:
```
📚 Moderation Commands
/warn - Warn a user
/unwarn - Remove warning
/mute - Mute a user for specified duration
/unmute - Remove mute
/delete - Delete a comment
```

---

### Moderator Commands

#### `/warn`

Warn a user.

**Usage**:
```
/warn platform:anilist username:TestUser reason:Rule violation
```

**Parameters**:
- `platform`: Platform type
- `username`: Username to warn
- `reason`: Reason for warning

**Response**:
```
⚠️ User Warned
User: TestUser (AniList)
Reason: Rule violation
Warnings: 1/5
```

**Permissions**: Moderator+

---

#### `/unwarn`

Remove a warning from a user.

**Usage**:
```
/unwarn platform:anilist username:TestUser
```

**Parameters**:
- `platform`: Platform type
- `username`: Username to unwarn

**Response**:
```
✅ Warning Removed
User: TestUser (AniList)
Warnings: 0
```

**Permissions**: Moderator+

---

#### `/mute`

Mute a user for specified duration.

**Usage**:
```
/mute platform:anilist username:TestUser duration:24 reason:Spam
```

**Parameters**:
- `platform`: Platform type
- `username`: Username to mute
- `duration`: Duration in hours
- `reason`: Reason for mute

**Response**:
```
🔇 User Muted
User: TestUser (AniList)
Duration: 24 hours
Until: 2024-01-02 12:00:00
Reason: Spam
```

**Permissions**: Moderator+

---

#### `/unmute`

Remove mute from a user.

**Usage**:
```
/unmute platform:anilist username:TestUser
```

**Parameters**:
- `platform`: Platform type
- `username`: Username to unmute

**Response**:
```
🔊 User Unmuted
User: TestUser (AniList)
Status: Can now comment
```

**Permissions**: Moderator+

---

#### `/delete`

Delete a comment.

**Usage**:
```
/delete comment_id:12345 reason:Rule violation
```

**Parameters**:
- `comment_id`: Comment ID to delete
- `reason`: Reason for deletion

**Response**:
```
🗑️ Comment Deleted
ID: 12345
Author: TestUser
Reason: Rule violation
Deleted by: ModeratorName
```

**Permissions**: Moderator+

---

### Admin Commands

#### `/ban`

Ban a user.

**Usage**:
```
/ban platform:anilist username:TestUser reason:Repeated violations
```

**Parameters**:
- `platform`: Platform type
- `username`: Username to ban
- `reason`: Reason for ban

**Response**:
```
🔨 User Banned
User: TestUser (AniList)
Reason: Repeated violations
Banned by: AdminName
```

**Permissions**: Admin+

---

#### `/unban`

Unban a user.

**Usage**:
```
/unban platform:anilist username:TestUser
```

**Parameters**:
- `platform`: Platform type
- `username`: Username to unban

**Response**:
```
✅ User Unbanned
User: TestUser (AniList)
Status: Can now comment
```

**Permissions**: Admin+

---

#### `/shadowban`

Shadow ban a user (user can post, but comments are hidden).

**Usage**:
```
/shadowban platform:anilist username:TestUser reason:Spam
```

**Parameters**:
- `platform`: Platform type
- `username`: Username to shadow ban
- `reason`: Reason for shadow ban

**Response**:
```
👻 User Shadow Banned
User: TestUser (AniList)
Reason: Spam
Banned by: AdminName
```

**Permissions**: Admin+

---

#### `/unshadowban`

Remove shadow ban from a user.

**Usage**:
```
/unshadowban platform:anilist username:TestUser
```

**Parameters**:
- `platform`: Platform type
- `username`: Username to unshadow ban

**Response**:
```
✅ Shadow Ban Removed
User: TestUser (AniList)
Status: Comments now visible
```

**Permissions**: Admin+

---

### Super Admin Commands

#### `/promote`

Promote a user to higher role.

**Usage**:
```
/promote platform:anilist username:TestUser role:moderator
```

**Parameters**:
- `platform`: Platform type
- `username`: Username to promote
- `role`: New role (moderator, admin)

**Response**:
```
⬆️ User Promoted
User: TestUser (AniList)
New Role: Moderator
Promoted by: SuperAdmin
```

**Permissions**: Super Admin

---

#### `/demote`

Demote a user to lower role.

**Usage**:
```
/demote platform:anilist username:TestUser role:user
```

**Parameters**:
- `platform`: Platform type
- `username`: Username to demote
- `role`: New role (user, moderator)

**Response**:
```
⬇️ User Demoted
User: TestUser (AniList)
New Role: User
Demoted by: SuperAdmin
```

**Permissions**: Super Admin

---

#### `/config`

View or update system configuration.

**Usage**:
```
/config
/config action:set key:MAX_COMMENT_LENGTH value:5000
```

**Parameters**:
- `action`: Action (view, set)
- `key`: Configuration key (optional)
- `value`: Configuration value (optional)

**Response**:
```
⚙️ Configuration
MAX_COMMENT_LENGTH: 5000
VOTING_ENABLED: true
RATE_LIMIT_COMMENTS_PER_HOUR: 30
```

**Permissions**: Super Admin

---

#### `/add`

Add server configuration.

**Usage**:
```
/add server_id:1234567890
```

**Parameters**:
- `server_id`: Discord server ID

**Response**:
```
➕ Server Added
Server ID: 1234567890
Status: Configured
```

**Permissions**: Super Admin

---

## Webhook Notifications

### Notification Types

#### comment_created

Sent when a new comment is posted.

**Embed**:
```
💬 New Comment
TestUser commented on Attack on Titan

User: TestUser
Content: Great episode!
```

---

#### comment_updated

Sent when a comment is edited.

**Embed**:
```
✏️ Comment Edited
TestUser edited a comment on Attack on Titan

User: TestUser
New Content: Updated content here
```

---

#### comment_deleted

Sent when a comment is deleted (by user or moderator).

**Embed** (User deletion):
```
🗑️ Comment Deleted
TestUser deleted their comment on Attack on Titan
```

**Embed** (Moderator deletion):
```
🗑️ Comment Deleted
ModeratorName deleted a comment by TestUser

Moderator: ModeratorName (moderator)
Original Author: TestUser
Reason: Rule violation
```

---

#### comment_reported

Sent when a comment is reported.

**Embed**:
```
🚨 Comment Reported
A comment was reported

Reporter: TestUser
Reason: spam
Comment: Spam content here...
```

---

#### user_banned

Sent when a user is banned.

**Embed**:
```
🔨 User Banned
User TestUser has been banned

Moderator: AdminName
Reason: Repeated violations
```

---

#### user_warned

Sent when a user is warned, muted, or unmuted.

**Embed**:
```
⚠️ User Warned
User TestUser has been warned

Moderator: ModeratorName
Reason: Rule violation
Warning Count: User now has more warnings
```

---

#### announcement_published

Sent when a new announcement is published.

**Embed**:
```
📢 New Announcement
A new announcement has been published

Author: Dev Team
Title: New Feature Release
```

---

## Advanced Configuration

### Multi-Server Support

The bot can support multiple Discord servers with different configurations.

**Configuration**:
- Each server has its own configuration in the database
- Server-specific moderators and admins
- Custom notification channels per server

### Custom Commands

Create custom commands by adding to the Discord function:

```typescript
// Example: Custom command
case 'custom':
  return await handleCustomCommand(interaction);
```

### Role Mapping

Map Discord roles to Commentum roles:

```sql
INSERT INTO discord_users (discord_user_id, platform_user_id, user_role)
VALUES (
  '123456789012345678',
  '9876543210',
  'moderator'
);
```

### Notification Channels

Configure different channels for different notification types:

```typescript
const notificationChannels = {
  comment_created: 'general',
  moderation: 'moderation-log',
  system: 'admin-only'
};
```

---

## Troubleshooting

### Bot Not Responding

1. Check bot is online
2. Verify gateway intents
3. Check function logs
4. Verify bot token

### Commands Not Registering

1. Check bot permissions
2. Verify client ID
3. Check API rate limits
4. Try global commands instead

### Webhook Not Sending

1. Verify webhook URL
2. Check Discord API status
3. Review function logs
4. Test webhook manually

---

## Additional Resources

- [API Reference](./api-reference.md) - API documentation
- [Configuration Guide](./configuration.md) - Environment variables
- [Deployment Guide](./deployment.md) - Deployment instructions
