# FlowMap Memory Index

> **Auto-generated — do not edit by hand.**  
> Generated: 15/05/2026, 02:28:47  
> App version: `0.0.0` · Schema: `1.0.0` · Total nodes: **17**

## Summary

| Type | Icon | Count |
|---|---|---|
| Project | 📦 | 1 |
| Conversations | 💬 | 0 |
| Decisions | 🔑 | 0 |
| Workflows | ⚙️ | 14 |
| Source Items | 📄 | 0 |
| Preferences | 🎛️ | 2 |
| Insights | 💡 | 0 |

## 📦 Project

_Storage keys: `package.json (static)`_

| ID | Label | Tags | Updated |
|---|---|---|---|
| `project:flowmap` | FlowMap — topic intelligence platform | react, vite, typescript, tailwindcss, ollama, local-first | 15 May 2026 |

## 💬 Conversations

_Storage keys: `flowmap.v1/conversations`, `flowmap.v1/chatMessages`_

_none_

## 🔑 Decisions

_Storage keys: `flowmap.v1/memoryEntries`_

_none_

## ⚙️ Workflows

_Storage keys: `fm_mcp_integrations`, `fm_mcp_executions`, `flowmap.mcp.taskPlans`_

| ID | Label | Tags | Updated |
|---|---|---|---|
| `mcp:integration:integ_telegram` | MCP: Telegram (telegram) | telegram, disconnected | 14 May 2026 |
| `mcp:integration:integ_figma` | MCP: Figma (figma) | figma, disconnected | 14 May 2026 |
| `mcp:integration:integ_google_drive` | MCP: Google Drive (google-drive) | google-drive, disconnected | 14 May 2026 |
| `mcp:integration:integ_gmail` | MCP: Gmail (gmail) | gmail, disconnected | 14 May 2026 |
| `mcp:integration:integ_google_calendar` | MCP: Google Calendar (google-calendar) | google-calendar, disconnected | 14 May 2026 |
| `mcp:integration:integ_google_slides` | MCP: Google Slides (google-slides) | google-slides, disconnected | 14 May 2026 |
| `mcp:integration:integ_youtube` | MCP: YouTube (youtube) | youtube, disconnected | 14 May 2026 |
| `mcp:integration:integ_google_docs` | MCP: Google Docs (google-docs) | google-docs, disconnected | 14 May 2026 |
| `mcp:integration:integ_higgsfield` | MCP: Higgsfield AI (higgsfield) | higgsfield, disconnected | 14 May 2026 |
| `mcp:integration:integ_instagram` | MCP: Instagram (instagram) | instagram, disconnected | 14 May 2026 |
| `mcp:integration:integ_facebook` | MCP: Facebook (facebook) | facebook, disconnected | 14 May 2026 |
| `mcp:integration:integ_flowmap` | MCP: FlowMap (flowmap) | flowmap, connected | 14 May 2026 |
| `mcp:integration:integ_local` | MCP: Local Operator (local) | local, connected | 14 May 2026 |
| `mcp:integration:integ_docker_mcp` | MCP: Docker MCP Servers (docker-mcp) | docker-mcp, disconnected | 14 May 2026 |

## 📄 Source Items

_Storage keys: `flowmap.v1/documents`, `flowmap.v1/manualContent`, `flowmap.v1/saves`_

_none_

## 🎛️ Preferences

_Storage keys: `flowmap.v1`, `flowmap.ollama.*`, `flowmap.voice.*`, `flowmap.theme`_

| ID | Label | Tags | Updated |
|---|---|---|---|
| `pref:theme` | UI theme: dark | — | — |
| `pref:ollama` | Ollama: enabled — model: phi4-mini | — | — |

## 💡 Insights

_Storage keys: `fm_radar_clusters`, `fm_radar_concepts`, `fm_signals_items`_

_none_

## Storage Key Registry

All localStorage keys the app reads or writes:

- `flowmap.v1`
- `flowmap.theme`
- `flowmap.ollama.enabled`
- `flowmap.ollama.model`
- `flowmap.voice.enabled`
- `flowmap.voice.voiceId`
- `flowmap.voice.modelId`
- `flowmap.searxng.enabled`
- `flowmap.topics.viewMode`
- `flowmap.topic.viewMode`
- `flowmap.signals.viewMode`
- `flowmap.search.cache.*`
- `flowmap_vt_key`
- `fm_radar_signals`
- `fm_radar_clusters`
- `fm_radar_concepts`
- `fm_radar_meta`
- `fm_signals_topics`
- `fm_signals_sources`
- `fm_signals_items`
- `fm_signals_config`
- `fm_mcp_integrations`
- `fm_mcp_tools`
- `fm_mcp_executions`
- `fm_mcp_telegram_messages`
- `fm_telegram_poll_offset`
- `flowmap.mcp.taskPlans`
- `flowmap.mcp.ctxfiles`
- `flowmap.mcp.ctxfile.*`
- `IDB:flowmap-embeddings/embeddings`
