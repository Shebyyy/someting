# API Reference

Complete API endpoint documentation for Commentum Shelby.

## Table of Contents

1. [Authentication](#authentication)
2. [Comments](#comments)
3. [Votes](#votes)
4. [Reports](#reports)
5. [Moderation](#moderation)
6. [Users](#users)
7. [Media](#media)
8. [Announcements](#announcements)

---

## Authentication

### POST /auth

Authenticate user and get JWT token.

**Request Body**:
```json
{
  "token": "oauth_access_token",
  "client_type": "anilist"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "token": "jwt_token_string",
  "user": {
    "user_id": "12345",
    "username": "TestUser",
    "avatar": "https://...",
    "client_type": "anilist",
    "role": "user"
  }
}
```

**Error Responses**:
- `400`: Invalid request
- `401`: Invalid or expired OAuth token
- `500`: Internal server error

**Supported client_types**:
- `anilist`
- `myanimelist`
- `simkl`

---

## Comments

### POST /comments

Handle comment CRUD operations.

**Actions**: `create`, `edit`, `delete`, `mod_delete`

#### Create Comment

**Request Body**:
```json
{
  "action": "create",
  "jwt_token": "jwt_token",
  "media_id": "6789",
  "content": "Great episode!",
  "parent_id": null,
  "tag": "1"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "comment": {
    "id": 1,
    "user_id": "12345",
    "username": "TestUser",
    "user_role": "user",
    "media_id": "6789",
    "content": "Great episode!",
    "media_type": "anime",
    "media_title": "Attack on Titan",
    "media_year": 2013,
    "media_poster": "https://...",
    "parent_id": null,
    "created_at": "2024-01-01T00:00:00Z",
    "upvotes": 0,
    "downvotes": 0,
    "vote_score": 0,
    "deleted": false,
    "pinned": false,
    "locked": false,
    "edited": false
  }
}
```

**Notes**:
- Media info is fetched in background after comment creation
- Comment is created immediately with temporary media info
- If `parent_id` is provided, it's a reply to another comment
- `tag` is optional and stored as JSON array

#### Edit Comment

**Request Body**:
```json
{
  "action": "edit",
  "jwt_token": "jwt_token",
  "comment_id": 1,
  "content": "Updated content"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "comment": {
    "id": 1,
    "content": "Updated content",
    "edited": true,
    "edited_at": "2024-01-01T01:00:00Z",
    "edit_count": 1,
    "edit_history": "[...]"
  }
}
```

**Permissions**: Owner or moderator

#### Delete Own Comment

**Request Body**:
```json
{
  "action": "delete",
  "jwt_token": "jwt_token",
  "comment_id": 1
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "comment": {
    "id": 1,
    "deleted": true,
    "deleted_at": "2024-01-01T01:00:00Z",
    "deleted_by": "12345"
  }
}
```

**Permissions**: Owner or moderator

#### Moderator Delete

**Request Body**:
```json
{
  "action": "mod_delete",
  "jwt_token": "jwt_token",
  "comment_id": 1
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "comment": {
    "id": 1,
    "deleted": true,
    "moderated": true,
    "moderated_at": "2024-01-01T01:00:00Z",
    "moderated_by": "12345",
    "moderation_action": "mod_delete"
  },
  "moderator": {
    "id": "12345",
    "username": "ModeratorName",
    "role": "moderator"
  }
}
```

**Permissions**: Moderator+

---

## Votes

### POST /votes

Vote on comments (upvote, downvote, remove).

**Request Body**:
```json
{
  "comment_id": 1,
  "jwt_token": "jwt_token",
  "vote_type": "upvote"
}
```

**vote_type options**: `upvote`, `downvote`, `remove`

**Response** (200 OK):
```json
{
  "success": true,
  "voteScore": 5,
  "upvotes": 6,
  "downvotes": 1,
  "userVote": "upvote"
}
```

**Behavior**:
- `upvote`: Add upvote, or change from downvote to upvote, or toggle off if already upvoted
- `downvote`: Add downvote, or change from upvote to downvote, or toggle off if already downvoted
- `remove`: Remove vote regardless of type
- Cannot vote on your own comments

---

## Reports

### POST /reports

Handle comment reporting and moderation queue.

**Actions**: `create`, `resolve`, `get_queue`

#### Create Report

**Request Body**:
```json
{
  "action": "create",
  "comment_id": 1,
  "reporter_info": {
    "user_id": "12345",
    "username": "TestUser"
  },
  "reason": "spam",
  "notes": "Automated spam"
}
```

**reason options**: `spam`, `offensive`, `harassment`, `spoiler`, `nsfw`, `off_topic`, `other`

**Response** (201 Created):
```json
{
  "success": true,
  "comment": {
    "id": 1,
    "reported": true,
    "report_count": 1,
    "report_status": "pending",
    "reports": "[...]"
  },
  "report": {
    "id": "report-1704067200000-12345",
    "reporter_id": "12345",
    "reporter_username": "TestUser",
    "reason": "spam",
    "status": "pending",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "user_status": {
    "user_banned": false,
    "user_warnings": 0
  }
}
```

#### Resolve Report (Moderator+)

**Request Body**:
```json
{
  "action": "resolve",
  "jwt_token": "jwt_token",
  "comment_id": 1,
  "report_id": "report-1704067200000-12345",
  "resolution": "resolved",
  "review_notes": "Confirmed spam, removed"
}
```

**resolution options**: `resolved`, `dismissed`

**Response** (200 OK):
```json
{
  "success": true,
  "comment": {
    "id": 1,
    "report_status": "resolved",
    "moderated": true,
    "moderated_at": "2024-01-01T01:00:00Z"
  },
  "resolved_report": {
    "id": "report-1704067200000-12345",
    "status": "resolved",
    "reviewed_by": "67890",
    "reviewed_at": "2024-01-01T01:00:00Z",
    "review_notes": "Confirmed spam, removed"
  },
  "moderator": {
    "id": "67890",
    "username": "ModeratorName",
    "role": "moderator"
  }
}
```

**Permissions**: Moderator+

#### Get Report Queue (Moderator+)

**Request Body**:
```json
{
  "action": "get_queue",
  "jwt_token": "jwt_token"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "queue": [
    {
      "id": 1,
      "content": "Spam content",
      "user_id": "12345",
      "username": "Spammer",
      "reported": true,
      "report_count": 1,
      "report_status": "pending",
      "reports": "[...]",
      "user_status": {
        "user_banned": false,
        "user_warnings": 0
      }
    }
  ],
  "count": 1
}
```

**Permissions**: Moderator+

---

## Moderation

### POST /moderation

Handle advanced moderation actions.

**Actions**: `pin_comment`, `lock_thread`, `unlock_thread`, `warn_user`, `unwarn_user`, `mute_user`, `unmute_user`, `ban_user`, `unban_user`, `get_queue`

#### Pin Comment (Moderator+)

**Request Body**:
```json
{
  "action": "pin_comment",
  "jwt_token": "jwt_token",
  "comment_id": 1,
  "reason": "Important announcement",
  "pin": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "comment": {
    "id": 1,
    "pinned": true,
    "pinned_at": "2024-01-01T01:00:00Z",
    "pinned_by": "67890",
    "moderated": true,
    "moderated_at": "2024-01-01T01:00:00Z"
  },
  "moderator": {
    "id": "67890",
    "username": "ModeratorName",
    "role": "moderator"
  }
}
```

**Permissions**: Moderator+

#### Lock Thread (Moderator+)

**Request Body**:
```json
{
  "action": "lock_thread",
  "jwt_token": "jwt_token",
  "comment_id": 1,
  "reason": "Off-topic discussion"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "comment": {
    "id": 1,
    "locked": true,
    "locked_at": "2024-01-01T01:00:00Z",
    "locked_by": "67890",
    "moderation_action": "lock_thread"
  },
  "moderator": {
    "id": "67890",
    "username": "ModeratorName",
    "role": "moderator"
  }
}
```

**Permissions**: Moderator+

#### Unlock Thread (Moderator+)

**Request Body**:
```json
{
  "action": "unlock_thread",
  "jwt_token": "jwt_token",
  "comment_id": 1,
  "reason": "Discussion resolved"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "comment": {
    "id": 1,
    "locked": false,
    "locked_at": null,
    "locked_by": null,
    "moderation_action": "unlock_thread"
  }
}
```

**Permissions**: Moderator+

#### Warn User (Moderator+)

**Request Body**:
```json
{
  "action": "warn_user",
  "jwt_token": "jwt_token",
  "target_user_id": "12345",
  "target_client_type": "anilist",
  "reason": "Rule violation"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "target_user_id": "12345",
  "target_client_type": "anilist",
  "warnings": 1,
  "moderator": {
    "id": "67890",
    "username": "ModeratorName",
    "role": "moderator"
  }
}
```

**Permissions**: Moderator+

#### Unwarn User (Moderator+)

**Request Body**:
```json
{
  "action": "unwarn_user",
  "jwt_token": "jwt_token",
  "target_user_id": "12345",
  "target_client_type": "anilist",
  "reason": "Warning removed"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "target_user_id": "12345",
  "target_client_type": "anilist",
  "warnings": 0,
  "moderator": {
    "id": "67890",
    "username": "ModeratorName",
    "role": "moderator"
  }
}
```

**Permissions**: Moderator+

#### Mute User (Moderator+)

**Request Body**:
```json
{
  "action": "mute_user",
  "jwt_token": "jwt_token",
  "target_user_id": "12345",
  "target_client_type": "anilist",
  "reason": "Temporary mute",
  "duration": 24
}
```

`duration` is in hours.

**Response** (200 OK):
```json
{
  "success": true,
  "target_user_id": "12345",
  "target_client_type": "anilist",
  "muted_until": "2024-01-02T01:00:00Z",
  "moderator": {
    "id": "67890",
    "username": "ModeratorName",
    "role": "moderator"
  }
}
```

**Permissions**: Moderator+

#### Unmute User (Moderator+)

**Request Body**:
```json
{
  "action": "unmute_user",
  "jwt_token": "jwt_token",
  "target_user_id": "12345",
  "target_client_type": "anilist",
  "reason": "Mute expired"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "target_user_id": "12345",
  "target_client_type": "anilist",
  "moderator": {
    "id": "67890",
    "username": "ModeratorName",
    "role": "moderator"
  }
}
```

**Permissions**: Moderator+

#### Ban User (Admin+)

**Request Body**:
```json
{
  "action": "ban_user",
  "jwt_token": "jwt_token",
  "target_user_id": "12345",
  "target_client_type": "anilist",
  "reason": "Repeated violations",
  "shadow_ban": false
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "target_user_id": "12345",
  "target_client_type": "anilist",
  "shadow_ban": false,
  "moderator": {
    "id": "67890",
    "username": "AdminName",
    "role": "admin"
  }
}
```

**Permissions**: Admin+

#### Unban User (Admin+)

**Request Body**:
```json
{
  "action": "unban_user",
  "jwt_token": "jwt_token",
  "target_user_id": "12345",
  "target_client_type": "anilist",
  "reason": "Appeal approved"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "target_user_id": "12345",
  "target_client_type": "anilist",
  "moderator": {
    "id": "67890",
    "username": "AdminName",
    "role": "admin"
  }
}
```

**Permissions**: Admin+

#### Get Queue (Moderator+)

**Request Body**:
```json
{
  "action": "get_queue",
  "jwt_token": "jwt_token"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "queue": [
    {
      "id": 1,
      "content": "Reported content",
      "reported": true,
      "report_status": "pending"
    }
  ],
  "count": 1
}
```

**Permissions**: Moderator+

---

## Users

### POST /users

Handle user management and info.

**Actions**: `get_user_info`, `get_user_stats`, `get_user_history`

#### Get User Info

**Request Body**:
```json
{
  "action": "get_user_info",
  "jwt_token": "jwt_token",
  "target_user_id": "12345",
  "target_client_type": "anilist"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "user_id": "12345",
    "username": "TestUser",
    "client_type": "anilist",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "role": "user",
  "is_self": false
}
```

**Permissions**: Self or moderator

#### Get User Stats

**Request Body**:
```json
{
  "action": "get_user_stats",
  "jwt_token": "jwt_token",
  "target_user_id": "12345",
  "target_client_type": "anilist"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "user_id": "12345",
  "client_type": "anilist",
  "stats": {
    "total_comments": 150,
    "active_comments": 145,
    "deleted_comments": 5,
    "total_upvotes": 500,
    "total_downvotes": 50,
    "net_score": 450,
    "warnings": 2,
    "is_banned": false,
    "is_shadow_banned": false,
    "is_muted": false,
    "muted_until": null
  },
  "is_self": false
}
```

**Permissions**: Self or moderator

#### Get User History

**Request Body**:
```json
{
  "action": "get_user_history",
  "jwt_token": "jwt_token",
  "target_user_id": "12345",
  "target_client_type": "anilist"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "user_id": "12345",
  "client_type": "anilist",
  "comments": [
    {
      "id": 1,
      "content": "Great episode!",
      "media_title": "Attack on Titan",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1,
  "is_self": false
}
```

**Permissions**: Self or moderator

---

## Media

### GET /media

Get comments for a specific media.

**Query Parameters**:
- `media_id` (required): Media identifier
- `client_type` (required): Platform identifier
- `page` (default: 1): Page number
- `limit` (default: 50, max: 100): Results per page
- `sort` (default: newest): Sort order (`newest`, `oldest`, `top`, `controversial`)
- `include_deleted` (default: false): Include deleted comments

**Example**:
```
GET /media?media_id=6789&client_type=anilist&page=1&limit=20&sort=top
```

**Response** (200 OK):
```json
{
  "success": true,
  "media": {
    "id": 1,
    "media_id": "6789",
    "client_type": "anilist",
    "media_type": "anime",
    "title": "Attack on Titan",
    "year": 2013,
    "poster": "https://..."
  },
  "comments": [
    {
      "id": 1,
      "content": "Great episode!",
      "username": "TestUser",
      "upvotes": 5,
      "downvotes": 0,
      "vote_score": 5
    }
  ],
  "stats": {
    "commentCount": 150,
    "totalUpvotes": 500,
    "totalDownvotes": 50,
    "netScore": 450
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## Announcements

### GET /announcements

List announcements for an app.

**Query Parameters**:
- `app_id` (required): App ID (anymex, shonenx, animestream)
- `status` (default: published): Filter by status
- `category` (optional): Filter by category
- `page` (default: 1): Page number
- `limit` (default: 20, max 50): Results per page
- `user_id` (optional): For read status
- `include_read` (default: false): Include read status in response

**Example**:
```
GET /announcements?app_id=anymex&status=published&page=1&limit=20
```

**Response** (200 OK):
```json
{
  "success": true,
  "announcements": [
    {
      "id": 1,
      "title": "New Feature Release",
      "short_description": "We've added a new feature...",
      "category": "feature",
      "pinned": true,
      "featured": true,
      "priority": 10,
      "published_at": "2024-01-01T00:00:00Z",
      "view_count": 1000,
      "is_read": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "unread_count": 5
}
```

### GET /announcements/:id

Get single announcement.

**Query Parameters**:
- `user_id` (optional): For read status

**Example**:
```
GET /announcements/1?user_id=12345&app_id=anymex
```

**Response** (200 OK):
```json
{
  "success": true,
  "announcement": {
    "id": 1,
    "app_id": "anymex",
    "title": "New Feature Release",
    "short_description": "We've added a new feature...",
    "full_content": "# Full markdown content here...",
    "category": "feature",
    "priority": 10,
    "pinned": true,
    "featured": true,
    "status": "published",
    "published_at": "2024-01-01T00:00:00Z",
    "author_name": "Dev Team",
    "view_count": 1001,
    "is_read": false
  }
}
```

### POST /announcements/:id/view

Mark as viewed.

**Request Body**:
```json
{
  "user_id": "12345",
  "app_id": "anymex"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "View recorded"
}
```

### POST /announcements/:id/read

Mark as read.

**Request Body**:
```json
{
  "user_id": "12345",
  "app_id": "anymex"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Marked as read"
}
```

### POST /announcements

Create announcement (Super Admin only).

**Request Body**:
```json
{
  "client_type": "anilist",
  "access_token": "admin_oauth_token",
  "app_id": "anymex",
  "title": "New Feature Release",
  "short_description": "We've added a new feature...",
  "full_content": "# Full markdown content here...",
  "category": "feature",
  "priority": 10,
  "pinned": false,
  "featured": false,
  "publish": true
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "announcement": {
    "id": 1,
    "app_id": "anymex",
    "title": "New Feature Release",
    "status": "published",
    "published_at": "2024-01-01T00:00:00Z"
  },
  "message": "Announcement published successfully"
}
```

**Permissions**: Super Admin only

### PATCH /announcements/:id

Update announcement (Super Admin only).

**Request Body**:
```json
{
  "client_type": "anilist",
  "access_token": "admin_oauth_token",
  "title": "Updated Title",
  "priority": 20
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "announcement": {
    "id": 1,
    "title": "Updated Title",
    "priority": 20
  }
}
```

**Permissions**: Super Admin only

### DELETE /announcements/:id

Delete announcement (Super Admin only).

**Request Body**:
```json
{
  "client_type": "anilist",
  "access_token": "admin_oauth_token"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Announcement deleted"
}
```

**Permissions**: Super Admin only

### POST /announcements/:id/publish

Publish draft (Super Admin only).

**Request Body**:
```json
{
  "client_type": "anilist",
  "access_token": "admin_oauth_token"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "announcement": {
    "id": 1,
    "status": "published",
    "published_at": "2024-01-01T00:00:00Z"
  },
  "message": "Announcement published"
}
```

**Permissions**: Super Admin only

### POST /announcements/:id/archive

Archive announcement (Super Admin only).

**Request Body**:
```json
{
  "client_type": "anilist",
  "access_token": "admin_oauth_token"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "announcement": {
    "id": 1,
    "status": "archived",
    "pinned": false,
    "featured": false
  },
  "message": "Announcement archived"
}
```

**Permissions**: Super Admin only

### GET /announcements/unread-count

Get unread count.

**Query Parameters**:
- `user_id` (required): User ID
- `app_id` (required): App ID

**Example**:
```
GET /announcements/unread-count?user_id=12345&app_id=anymex
```

**Response** (200 OK):
```json
{
  "success": true,
  "total_published": 45,
  "read_count": 40,
  "unread_count": 5
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Invalid request"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid or expired JWT token"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

### 503 Service Unavailable
```json
{
  "error": "Feature disabled"
}
```
