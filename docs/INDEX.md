# Commentum Shelby Documentation Index

Welcome to the Commentum Shelby documentation. This comprehensive guide covers all aspects of the comment system, from setup to advanced configuration.

## Documentation Structure

### Getting Started

- **[README.md](./README.md)** - Overview and quick start guide
  - Key improvements over v2
  - Quick start instructions
  - Architecture overview
  - Basic deployment steps

### Core Documentation

- **[API Reference](./api-reference.md)** - Complete API endpoint documentation
  - Authentication endpoints
  - Comments API
  - Votes API
  - Reports API
  - Moderation API
  - Users API
  - Media API
  - Announcements API
  - Error responses

- **[Configuration Guide](./configuration.md)** - Environment variables and settings
  - Required environment variables
  - Optional system settings
  - Role management
  - Platform integration
  - Discord integration
  - Configuration examples

- **[Deployment Guide](./deployment.md)** - Step-by-step deployment instructions
  - Prerequisites and setup
  - Local development
  - Supabase project setup
  - Deploying edge functions
  - Discord bot deployment
  - Production checklist
  - Monitoring and maintenance

### Advanced Topics

- **[Discord Bot Guide](./discord-bot.md)** - Discord integration details
  - Bot setup and configuration
  - All slash commands
  - Webhook notifications
  - Multi-server support
  - Custom commands
  - Troubleshooting

- **[Database Schema](./database-schema.md)** - Complete database structure
  - Core tables (mod_plus, users, media, comments)
  - Discord integration tables
  - Announcement tables
  - Indexes and triggers
  - Database functions
  - Relationships and constraints

## Quick Navigation

### For New Users

1. Start with [README.md](./README.md) for an overview
2. Follow the [Deployment Guide](./deployment.md) to set up your project
3. Configure using [Configuration Guide](./configuration.md)
4. Integrate Discord using [Discord Bot Guide](./discord-bot.md)

### For Developers

1. Review the [API Reference](./api-reference.md) for endpoint details
2. Study the [Database Schema](./database-schema.md) for data structure
3. Check [Configuration Guide](./configuration.md) for environment setup

### For Administrators

1. Set up Discord integration with [Discord Bot Guide](./discord-bot.md)
2. Configure roles in [Configuration Guide](./configuration.md)
3. Monitor system using [Deployment Guide](./deployment.md) monitoring section

### For Moderators

1. Learn moderation commands in [Discord Bot Guide](./discord-bot.md)
2. Understand moderation API in [API Reference](./api-reference.md)
3. Review user status tracking in [Database Schema](./database-schema.md)

## Key Concepts

### JWT Authentication

- Single token for all requests after initial login
- Never-expiring tokens (user re-authenticates to refresh role)
- Role stored in token but refreshed from database on each request
- See [README.md](./README.md) and [API Reference](./api-reference.md)

### Database Role Management

- Roles stored in `mod_plus` table
- Not stored in environment variables
- Dynamic role updates without token regeneration
- See [Database Schema](./database-schema.md) and [Configuration Guide](./configuration.md)

### Media Caching

- Automatic media info caching from external APIs
- Supports AniList, MyAnimeList, SIMKL
- Background fetching to avoid blocking comments
- See [Database Schema](./database-schema.md) and [API Reference](./api-reference.md)

### Discord Integration

- Webhook notifications for all important events
- Slash commands for moderation
- User account linking
- Multi-server support
- See [Discord Bot Guide](./discord-bot.md)

## Common Tasks

### Adding a Moderator

```sql
INSERT INTO mod_plus (user_id, username, role)
VALUES ('12345', 'ModeratorName', 'moderator');
```

See [Configuration Guide](./configuration.md) for more details.

### Banning a User

Via API:
```bash
POST /moderation
{
  "action": "ban_user",
  "jwt_token": "your_jwt_token",
  "target_user_id": "12345",
  "target_client_type": "anilist",
  "reason": "Repeated violations"
}
```

Via Discord:
```
/ban platform:anilist username:TestUser reason:Repeated violations
```

See [API Reference](./api-reference.md) and [Discord Bot Guide](./discord-bot.md).

### Creating a Comment

```bash
POST /comments
{
  "action": "create",
  "jwt_token": "your_jwt_token",
  "media_id": "12345",
  "content": "Great episode!"
}
```

See [API Reference](./api-reference.md).

### Deploying to Production

1. Create Supabase project
2. Apply database migrations
3. Configure environment variables
4. Deploy edge functions
5. Test all endpoints

See [Deployment Guide](./deployment.md).

## Troubleshooting

### Common Issues

1. **JWT Secret Not Set**
   - Solution: Add JWT_SECRET to environment variables
   - See [Configuration Guide](./configuration.md)

2. **Function Deployment Failed**
   - Solution: Check Supabase status and logs
   - See [Deployment Guide](./deployment.md)

3. **Discord Bot Not Responding**
   - Solution: Verify bot token and permissions
   - See [Discord Bot Guide](./discord-bot.md)

4. **Database Migration Failed**
   - Solution: Reset database or apply migration manually
   - See [Deployment Guide](./deployment.md)

## Support

### Documentation

- This documentation set should answer most questions
- Check code comments for implementation details
- Review database schema for data structure

### Community

- GitHub Issues for bug reports
- Discord for community support
- Stack Overflow for technical questions

### Getting Help

1. Search existing documentation
2. Check common issues above
3. Review relevant guide for your issue
4. Open an issue if problem persists

## Version History

### Current Version: Shelby

- JWT-based authentication
- Database role management
- Media caching
- Discord integration
- Complete feature parity with v2

### Previous Version: v2

- Per-request token validation
- Environment variable roles
- No media caching
- Limited Discord integration

---

**Last Updated**: 2024
**Version**: 1.0.0
**Maintainer**: Commentum Team
