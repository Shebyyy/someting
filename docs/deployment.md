# Deployment Guide

Complete deployment guide for Commentum Shelby.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Supabase Setup](#supabase-setup)
4. [Deploying Edge Functions](#deploying-edge-functions)
5. [Discord Bot Deployment](#discord-bot-deployment)
6. [Production Checklist](#production-checklist)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)

---

## Prerequisites

### Required Software

- **Node.js** 18+ or **Bun** for local development
- **Supabase CLI** for database management
- **Git** for version control
- **OAuth Applications** for at least one platform:
  - AniList: [https://anilist.co/settings/developer](https://anilist.co/settings/developer)
  - MyAnimeList: [https://myanimelist.net/apiconfig](https://myanimelist.net/apiconfig)
  - SIMKL: [https://simkl.com/api/](https://simkl.com/api/)

### Required Accounts

- **Supabase Account**: Create at [https://supabase.com](https://supabase.com)
- **Platform OAuth Apps**: Register applications on desired platforms
- **Discord Server** (optional): For Discord bot integration

---

## Local Development

### 1. Clone the Repository

```bash
git clone <repository-url>
cd commentum-shelby
```

### 2. Install Dependencies

If using Node.js:
```bash
npm install
```

If using Bun:
```bash
bun install
```

### 3. Configure Local Environment

Create a `.env.local` file:
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret

# Platform APIs (optional for testing)
MAL_CLIENT_ID=your-mal-client-id
SIMKL_CLIENT_ID=your-simkl-client-id

# Discord (optional)
DISCORD_WEBHOOK_URL=your-webhook-url
```

### 4. Start Supabase Local

```bash
# Start local Supabase
supabase start

# View local logs
supabase status
```

### 5. Run Database Migrations

```bash
supabase db push
```

### 6. Test Locally

Test authentication:
```bash
curl -X POST http://localhost:54321/functions/v1/auth \
  -H "Content-Type: application/json" \
  -d '{"token":"test","client_type":"anilist"}'
```

---

## Supabase Setup

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click **New Project**
3. Enter project details:
   - **Name**: Commentum Shelby
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose region closest to your users
4. Click **Create new project**
5. Wait for project to be ready (~2 minutes)

### 2. Get Project Credentials

1. Go to **Settings → API**
2. Copy the following:
   - **Project URL**
   - **anon public** key
   - **service_role** secret (keep this secure!)

### 3. Apply Database Schema

From your project directory:

```bash
# Login to Supabase (first time only)
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push database migrations
supabase db push
```

Or manually:
1. Go to **SQL Editor** in Supabase Dashboard
2. Copy contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and run the SQL

### 4. Configure Environment Variables

1. Go to **Settings → Edge Functions**
2. Add the following variables:

#### Required Variables
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
JWT_SECRET=your-jwt-secret-here
```

#### Generate JWT Secret
```bash
# Generate a random JWT secret
openssl rand -base64 32
```

#### Optional System Settings
```
SYSTEM_ENABLED=true
MAX_COMMENT_LENGTH=5000
MAX_NESTING_LEVEL=5
VOTING_ENABLED=true
REPORTING_ENABLED=true
```

#### Optional Rate Limiting
```
RATE_LIMIT_COMMENTS_PER_HOUR=30
RATE_LIMIT_VOTES_PER_HOUR=100
RATE_LIMIT_REPORTS_PER_HOUR=10
```

#### Optional Platform APIs
```
MAL_CLIENT_ID=your-mal-client-id
SIMKL_CLIENT_ID=your-simkl-client-id
```

#### Optional Discord Integration
```
DISCORD_NOTIFICATIONS_ENABLED=true
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-bot-client-id
DISCORD_GUILD_ID=your-server-id
```

3. Click **Save**

### 5. Configure CORS

1. Go to **Settings → API**
2. Scroll to **CORS allowlist**
3. Add your frontend URLs:
   ```
   https://your-frontend.com
   https://www.your-frontend.com
   http://localhost:3000 (for development)
   ```
4. Click **Save**

---

## Deploying Edge Functions

### 1. Deploy All Functions

From your project directory:

```bash
# Deploy all edge functions
supabase functions deploy .
```

### 2. Deploy Specific Function

```bash
# Deploy specific function
supabase functions deploy auth
supabase functions deploy comments
supabase functions deploy votes
```

### 3. Verify Deployment

Check deployed functions:

```bash
supabase functions list
```

Test authentication endpoint:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/auth \
  -H "Content-Type: application/json" \
  -d '{"token":"test","client_type":"anilist"}'
```

### 4. Test All Endpoints

Create a test script `test-deployment.sh`:

```bash
#!/bin/bash

BASE_URL="https://your-project.supabase.co/functions/v1"

echo "Testing authentication..."
curl -X POST $BASE_URL/auth \
  -H "Content-Type: application/json" \
  -d '{"token":"test","client_type":"anilist"}'

echo -e "\n\nTesting media endpoint..."
curl -X GET "$BASE_URL/media?media_id=1&client_type=anilist"

echo -e "\n\nDeployment test complete!"
```

Run the test:
```bash
chmod +x test-deployment.sh
./test-deployment.sh
```

---

## Discord Bot Deployment

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
4. Copy **Token** (set as `DISCORD_BOT_TOKEN`)
5. Copy **Application ID** (set as `DISCORD_CLIENT_ID`)

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
4. Copy generated URL
5. Open in browser and invite bot to server

### 4. Get Server ID

1. Open Discord
2. Enable Developer Mode (User Settings → Advanced)
3. Right-click on server → Copy Server ID
4. Set as `DISCORD_GUILD_ID`

### 5. Configure Environment Variables

Add to Supabase Edge Functions settings:

```
DISCORD_NOTIFICATIONS_ENABLED=true
DISCORD_WEBHOOK_URL=your-webhook-url
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-bot-client-id
DISCORD_GUILD_ID=your-server-id
```

### 6. Deploy Discord Function

```bash
supabase functions deploy discord
```

### 7. Register Slash Commands

**Register Global Commands**:

```bash
# Get bot token
DISCORD_TOKEN="your-bot-token"
CLIENT_ID="your-bot-client-id"

# Register all commands
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
      "name": "stats",
      "description": "View system statistics"
    }
  ]
]'
```

See [Discord Bot Guide](./discord-bot.md) for all commands.

### 8. Test Discord Bot

1. Go to your Discord server
2. Type `/stats` to test
3. Bot should respond with system statistics

---

## Production Checklist

### Security

- [ ] JWT_SECRET is strong and random
- [ ] SUPABASE_SERVICE_ROLE_KEY is never exposed
- [ ] HTTPS is enforced for all API calls
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Banned keywords are configured
- [ ] Discord bot token is secure

### Configuration

- [ ] All required environment variables are set
- [ ] Platform API keys are configured
- [ ] System settings are appropriate for production
- [ ] Discord webhook is working
- [ ] Email notifications are configured (if needed)

### Database

- [ ] Database migrations are applied
- [ ] Indexes are created
- [ ] Triggers are working
- [ ] Row Level Security is configured (if needed)
- [ ] Database backups are enabled

### Testing

- [ ] Authentication flow works
- [ ] Comment creation/editing/deletion works
- [ ] Voting system works
- [ ] Reporting system works
- [ ] Moderation actions work
- [ ] Discord notifications work
- [ ] Discord bot commands work

### Monitoring

- [ ] Supabase function logs are accessible
- [ ] Error tracking is set up
- [ ] Performance monitoring is enabled
- [ ] Alert notifications are configured

### Documentation

- [ ] API documentation is updated
- [ ] Configuration guide is available
- [ ] Troubleshooting guide is created
- [ ] Team training is completed

---

## Monitoring and Maintenance

### Supabase Dashboard

Monitor key metrics:

1. **Edge Functions**:
   - Request count
   - Average response time
   - Error rate
   - CPU usage
   - Memory usage

2. **Database**:
   - Active connections
   - Query performance
   - Storage usage
   - Backup status

3. **Logs**:
   - Function logs
   - Database logs
   - Error logs

### Custom Monitoring

Set up monitoring for:

1. **Comment Volume**: Track comments per day/week/month
2. **Moderation Queue**: Monitor pending reports
3. **User Growth**: Track new user registrations
4. **API Health**: Monitor endpoint response times
5. **Error Rate**: Track failed requests

### Regular Maintenance Tasks

#### Daily
- Review moderation queue
- Check error logs
- Monitor system performance

#### Weekly
- Review user reports
- Check database storage
- Update banned keywords if needed
- Review Discord notifications

#### Monthly
- Review security logs
- Update dependencies
- Clean up old data (if configured)
- Review and update documentation

#### Quarterly
- Security audit
- Performance review
- Disaster recovery test
- Backup verification

### Backup Strategy

1. **Database Backups**:
   - Supabase provides automatic daily backups
   - Enable point-in-time recovery
   - Test restore process quarterly

2. **Configuration Backups**:
   - Export environment variables regularly
   - Store in secure location
   - Document any changes

3. **Code Backups**:
   - Use version control (Git)
   - Tag releases
   - Maintain changelog

### Scaling Considerations

#### When to Scale

- **CPU usage > 80%** for extended periods
- **Memory usage > 80%** for extended periods
- **Response time > 2s** for most requests
- **Error rate > 1%** for extended periods

#### Scaling Options

1. **Optimize Code**:
   - Reduce external API calls
   - Implement caching
   - Optimize database queries

2. **Scale Up**:
   - Increase compute resources in Supabase
   - Add more database connections

3. **Scale Out**:
   - Use CDN for static assets
   - Implement read replicas
   - Consider microservices architecture

---

## Troubleshooting

### Common Issues

#### 1. Function Deployment Fails

**Error**: "Failed to deploy function"

**Solution**:
```bash
# Check Supabase status
supabase status

# Check function logs
supabase functions logs <function-name>

# Redeploy with verbose output
supabase functions deploy <function-name> --debug
```

#### 2. Database Migration Fails

**Error**: "Migration failed"

**Solution**:
```bash
# Check current migrations
supabase migration list

# Reset database (WARNING: deletes all data)
supabase db reset

# Manually apply migration
supabase db execute --file supabase/migrations/001_initial_schema.sql
```

#### 3. Environment Variables Not Working

**Error**: "Environment variable not set"

**Solution**:
1. Check Supabase Dashboard → Settings → Edge Functions
2. Verify variable name and value
3. Save and redeploy functions
4. Check function logs for errors

#### 4. Discord Bot Not Responding

**Error**: Bot not responding to commands

**Solution**:
1. Verify bot token is correct
2. Check bot has proper permissions
3. Verify gateway intents are enabled
4. Check bot is online in Discord
5. Review function logs for errors

#### 5. High Error Rate

**Error**: Many requests failing

**Solution**:
1. Check function logs for common errors
2. Verify environment variables
3. Check external API status
4. Review rate limiting configuration
5. Monitor database performance

### Getting Help

1. **Check Logs**:
   - Supabase function logs
   - Database logs
   - Discord bot logs

2. **Review Documentation**:
   - API Reference
   - Configuration Guide
   - Troubleshooting section

3. **Community Support**:
   - GitHub Issues
   - Discord Community
   - Stack Overflow

---

## Additional Resources

- [Configuration Guide](./configuration.md) - Environment variables and settings
- [API Reference](./api-reference.md) - Complete API documentation
- [Database Schema](./database-schema.md) - Database structure details
- [Discord Bot Guide](./discord-bot.md) - Discord integration details

---

## Next Steps

After deployment:

1. **Add Moderators**:
   ```sql
   INSERT INTO mod_plus (user_id, username, role)
   VALUES ('moderator_id', 'ModeratorName', 'moderator');
   ```

2. **Configure Discord**:
   - Set up webhook
   - Register bot commands
   - Test notifications

3. **Monitor System**:
   - Set up monitoring
   - Review logs regularly
   - Adjust settings as needed

4. **Gather Feedback**:
   - Collect user feedback
   - Monitor comment quality
   - Iterate on features
