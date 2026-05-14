# Flow AI — What Can It Do For You Right Now?

> This document covers **currently working** capabilities and **coming soon** ones.
> Each use case lists the integration it depends on and whether it needs your approval before acting.

---

## ✅ Working Today

### 🤖 Reasoning & Research (No integrations required)

These work out of the box — just chat with Flow AI.

| Use Case | Example Prompt |
|---|---|
| Explain a signal or strategy | *"What does VWAP Reclaim mean and when is it reliable?"* |
| Summarise a topic or concept | *"Summarise what I should know about options flow before market open"* |
| Break down news impact | *"How does a Fed rate hold affect tech stocks short-term?"* |
| Compare two tickers | *"Compare NVDA vs AMD momentum setups right now"* |
| Draft a trading plan | *"Help me build a rules-based plan for ORB breakouts"* |
| Explain a pending order | *"Why is my QQQ bracket order still pending?"* |
| Debug a signal | *"My AMZN signal fired but the order didn't fill — what happened?"* |

---

### 📬 Telegram (Fully Connected)

Flow AI can send messages and reports directly to your Telegram.

| Use Case | Example Prompt | Approval Required |
|---|---|---|
| Send yourself a daily summary | *"Send me a Telegram with today's open positions and P&L"* | ✅ Yes |
| Alert on a trade outcome | *"Message me on Telegram when this trade closes"* | ✅ Yes |
| Push a research digest | *"Summarise my AI topic signals and send to Telegram"* | ✅ Yes |
| Send a document link | *"Forward this article to my Telegram"* | ✅ Yes |

---

### 🖥️ Local Daemon Tools (Dynamic — discovers at runtime)

Flow AI connects to your running FlowMap daemon and can use any tool it exposes.

| Use Case | Example Prompt | Approval Required |
|---|---|---|
| Check open positions | *"What positions do I have open right now?"* | ❌ Read only |
| Check daily P&L | *"How am I doing today? Show my P&L"* | ❌ Read only |
| View pending orders | *"What orders are still pending?"* | ❌ Read only |
| Cancel a pending order | *"Cancel my QQQ bracket order"* | ✅ Yes |
| Trigger a research sweep | *"Run a fresh scan on my AI topic"* | ✅ Yes |
| Check watchlist | *"What's on my watchlist?"* | ❌ Read only |

---

### 🐳 Docker MCP Servers (Dynamic — discovers at runtime)

If you have Docker MCP servers running, Flow AI discovers and uses their tools automatically.
What's available depends on which servers you have connected. Common setups include web search, code execution, database queries, and file I/O.

---

## 🧠 Memory — Works Across All Sessions

Flow AI remembers things you tell it and uses that context in every future conversation.

| Use Case | Example Prompt |
|---|---|
| Set a research preference | *"Always prioritise AI/automation signals over other topics"* |
| Define a personal rule | *"Never suggest trades with more than 2% account risk"* |
| Save a personal fact | *"My paper account balance is $100,000"* |
| Store a stack preference | *"I prefer React + TypeScript for any code you write"* |
| Save a trading rule | *"I only trade during the first 90 minutes of market open"* |

Memory is categorised automatically (`research_focus`, `personal_rule`, `behavior`, etc.) and injected into every AI response.

---

## 🔜 Coming Soon (Phase 3 — OAuth required)

These integrations are built and ready — they just need OAuth credentials to be connected.

### 📧 Gmail
- Search your inbox by topic or sender
- Draft and send emails (with your approval)
- Summarise email threads

### 📅 Google Calendar
- List upcoming events
- Create new events from AI suggestions
- Cancel events

### 📄 Google Docs
- Read a document
- Append notes or summaries to an existing doc
- Create a new doc from AI output

### 💾 Google Drive
- List files in a folder
- Upload a file or AI-generated content
- Organise into folders

### 🎨 Figma
- Inspect layers, frames, and file structure
- Read comments on a file
- Extract design tokens (colours, type, spacing)

---

## How Approval Works

Flow AI uses a **3-tier permission model** before taking any action:

| Risk Level | Examples | Behaviour |
|---|---|---|
| **Read** | Checking positions, searching content, reading docs | Runs automatically |
| **Write** | Creating events, saving articles, editing docs | Asks for your approval |
| **Publish** | Sending messages, cancelling orders, triggering research | Asks for your approval |

You see a confirmation prompt before anything is written or sent. You can always say no.

---

## Agent Limits (Current)

- Maximum **15 reasoning steps** per conversation turn
- If Flow AI can't complete a task it will tell you what it would have done
- All tool calls are logged in the MCP execution history

---

*Last updated: May 2026*
