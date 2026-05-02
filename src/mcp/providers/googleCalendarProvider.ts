import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'gcal_list_events',
    toolName: 'list_events',
    displayName: 'List Calendar Events',
    description: 'List upcoming events from a Google Calendar.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      calendarId: { type: 'string', description: 'Calendar ID to read (defaults to primary)' },
      timeMin: { type: 'string', description: 'ISO 8601 start time filter (optional)' },
      maxResults: { type: 'number', description: 'Maximum events to return (default 10)' },
    },
    tags: ['google-calendar', 'list', 'read'],
  },
  {
    id: 'gcal_create_event',
    toolName: 'create_event',
    displayName: 'Create Calendar Event',
    description: 'Create a new event in Google Calendar.',
    riskLevel: 'publish',
    permissionMode: 'approval_required',
    inputSchema: {
      title: { type: 'string', description: 'Event title' },
      startTime: { type: 'string', description: 'ISO 8601 start datetime (e.g. 2026-05-10T14:00:00)' },
      endTime: { type: 'string', description: 'ISO 8601 end datetime' },
      description: { type: 'string', description: 'Event description (optional)' },
      calendarId: { type: 'string', description: 'Calendar ID (defaults to primary)' },
    },
    tags: ['google-calendar', 'create', 'publish'],
  },
  {
    id: 'gcal_cancel_event',
    toolName: 'cancel_event',
    displayName: 'Cancel Calendar Event',
    description: 'Cancel (delete) an existing Google Calendar event.',
    riskLevel: 'publish',
    permissionMode: 'approval_required',
    inputSchema: {
      eventId: { type: 'string', description: 'Google Calendar event ID to cancel' },
      calendarId: { type: 'string', description: 'Calendar ID (defaults to primary)' },
    },
    tags: ['google-calendar', 'cancel', 'publish'],
  },
]

export const googleCalendarProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },

  async executeTool({ integration, tool }) {
    if (integration.status !== 'connected') {
      return {
        success: false,
        error: `Google Calendar is not connected. Open Connections → Google Calendar to set it up.`,
      }
    }
    return {
      success: false,
      error: `Google Calendar tool "${tool.displayName}" requires OAuth — coming in Phase 3.`,
    }
  },

  async testConnection(integration) {
    if (integration.status !== 'connected') {
      return { success: false, error: 'Not connected' }
    }
    return { success: true }
  },
}
