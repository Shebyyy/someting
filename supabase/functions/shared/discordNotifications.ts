// Discord notifications - queue notifications for Discord bot
// Non-blocking notification system

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7/denonext/supabase-js.mjs'

interface NotificationData {
  type: string;
  comment?: any;
  user?: any;
  media?: any;
  moderator?: any;
  reason?: string;
}

/**
 * Queue a Discord notification (non-blocking, fire and forget)
 */
export async function queueDiscordNotification(data: NotificationData) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Log and queue - don't await
  sendDiscordNotification(supabase, data).catch(error => {
    console.error('Discord notification failed:', error)
  })
}

/**
 * Send Discord notification and log it
 * Blocking version for when you need to wait
 */
export async function sendDiscordNotificationBlocking(
  supabase: any,
  data: NotificationData
): Promise<void> {
  try {
    // Check if Discord notifications are enabled
    const discordEnabled = Deno.env.get('DISCORD_NOTIFICATIONS_ENABLED') === 'true'
    
    if (!discordEnabled) {
      return // Skip if disabled
    }

    // Log the notification
    const { error } = await supabase
      .from('discord_notifications')
      .insert({
        notification_type: data.type,
        target_id: data.comment?.id?.toString(),
        target_type: 'comment',
        comment_data: JSON.stringify(data.comment || {}),
        user_data: JSON.stringify(data.user || {}),
        media_data: JSON.stringify(data.media || {}),
        delivery_status: 'pending',
      })

    if (error) {
      console.error('Failed to log discord notification:', error)
      return
    }

    // Send to Discord webhook if configured
    const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL')
    
    if (webhookUrl) {
      await sendToWebhook(webhookUrl, data)
    }

  } catch (error) {
    console.error('Discord notification error:', error)
  }
}

/**
 * Send notification to Discord webhook
 */
async function sendToWebhook(webhookUrl: string, data: NotificationData) {
  const embed: any = {
    title: '',
    description: '',
    color: 0,
    timestamp: new Date().toISOString(),
    fields: []
  }

  // Build embed based on notification type
  switch (data.type) {
    case 'comment_created':
      embed.title = '💬 New Comment'
      embed.color = 0x00ff00 // Green
      embed.description = `**${data.user?.username}** commented on **${data.media?.title}**`
      embed.fields = [
        { name: 'User', value: data.user?.username || 'Unknown', inline: true },
        { name: 'Content', value: data.comment?.content?.substring(0, 100) || 'N/A', inline: false },
      ]
      break

    case 'comment_updated':
      embed.title = '✏️ Comment Edited'
      embed.color = 0xffff00 // Yellow
      embed.description = `**${data.user?.username}** edited a comment on **${data.media?.title}**`
      embed.fields = [
        { name: 'User', value: data.user?.username || 'Unknown', inline: true },
        { name: 'New Content', value: data.comment?.content?.substring(0, 100) || 'N/A', inline: false },
      ]
      break

    case 'comment_deleted':
      embed.title = '🗑️ Comment Deleted'
      embed.color = 0xff0000 // Red
      if (data.moderator) {
        embed.description = `**${data.moderator?.username}** deleted a comment by **${data.user?.username}**`
        embed.fields = [
          { name: 'Moderator', value: `${data.moderator?.username} (${data.moderator?.role})`, inline: true },
          { name: 'Original Author', value: data.user?.username || 'Unknown', inline: true },
          { name: 'Reason', value: data.reason || 'Not specified', inline: false },
        ]
      } else {
        embed.description = `**${data.user?.username}** deleted their comment on **${data.media?.title}**`
      }
      break

    case 'comment_reported':
      embed.title = '🚨 Comment Reported'
      embed.color = 0xffaa00 // Orange
      embed.description = `A comment was reported`
      embed.fields = [
        { name: 'Reporter', value: data.user?.username || 'Unknown', inline: true },
        { name: 'Reason', value: data.reason || 'Not specified', inline: true },
        { name: 'Comment', value: data.comment?.content?.substring(0, 100) || 'N/A', inline: false },
      ]
      break

    case 'user_banned':
      embed.title = '🔨 User Banned'
      embed.color = 0xff0000 // Red
      embed.description = `User **${data.user?.username}** has been banned`
      embed.fields = [
        { name: 'Moderator', value: data.moderator?.username || 'Unknown', inline: true },
        { name: 'Reason', value: data.reason || 'Repeated violations', inline: false },
      ]
      break

    case 'user_warned':
      embed.title = '⚠️ User Warned'
      embed.color = 0xffff00 // Yellow
      embed.description = `User **${data.user?.username}** has been warned`
      embed.fields = [
        { name: 'Moderator', value: data.moderator?.username || 'Unknown', inline: true },
        { name: 'Reason', value: data.reason || 'Rule violation', inline: false },
        { name: 'Warning Count', value: 'User now has more warnings', inline: false },
      ]
      break

    case 'announcement_published':
      embed.title = '📢 New Announcement'
      embed.color = 0x00bfff // Blue
      embed.description = data.reason || 'A new announcement has been published'
      embed.fields = [
        { name: 'Author', value: data.moderator?.username || 'Dev Team', inline: true },
        { name: 'Title', value: data.reason || 'New Announcement', inline: false },
      ]
      break

    default:
      embed.title = '📬 Notification'
      embed.color = 0x808080 // Gray
      embed.description = 'A new notification'
  }

  const payload = {
    embeds: [embed]
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    console.error('Discord webhook failed:', await response.text())
  }
}

/**
 * Fire and forget helper (non-blocking)
 */
function sendDiscordNotification(supabase: any, data: NotificationData): Promise<void> {
  return sendDiscordNotificationBlocking(supabase, data)
}
