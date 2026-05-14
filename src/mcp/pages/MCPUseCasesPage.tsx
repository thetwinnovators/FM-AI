/**
 * MCPUseCasesPage — Flow AI use cases reference page.
 *
 * Shows what Flow AI can do right now (no integration, Telegram, Daemon, Docker),
 * what Memory enables, what's coming in Phase 3, and how the approval model works.
 */

import { ConnectionsSubNav } from '../components/ConnectionsSubNav.js'
import {
  Sparkles,
  MessageCircle,
  Monitor,
  Container,
  Brain,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Lock,
  Eye,
  Send,
  Pencil,
} from 'lucide-react'

// ─── data ─────────────────────────────────────────────────────────────────────

const WORKING_SECTIONS = [
  {
    id: 'reasoning',
    icon: Sparkles,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    label: 'Reasoning & Research',
    sublabel: 'No integrations required — just chat',
    badge: null,
    items: [
      { use: 'Explain a signal or strategy',    prompt: 'What does VWAP Reclaim mean and when is it reliable?', approval: null },
      { use: 'Summarise a topic or concept',    prompt: 'Summarise what I should know about options flow before market open', approval: null },
      { use: 'Break down news impact',           prompt: 'How does a Fed rate hold affect tech stocks short-term?', approval: null },
      { use: 'Compare two tickers',              prompt: 'Compare NVDA vs AMD momentum setups right now', approval: null },
      { use: 'Draft a trading plan',             prompt: 'Help me build a rules-based plan for ORB breakouts', approval: null },
      { use: 'Explain a pending order',          prompt: 'Why is my QQQ bracket order still pending?', approval: null },
      { use: 'Debug a signal',                   prompt: 'My AMZN signal fired but the order didn\'t fill — what happened?', approval: null },
    ],
  },
  {
    id: 'telegram',
    icon: MessageCircle,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    label: 'Telegram',
    sublabel: 'Send messages and reports to your Telegram',
    badge: 'Connected',
    items: [
      { use: 'Send yourself a daily summary',   prompt: 'Send me a Telegram with today\'s open positions and P&L', approval: true },
      { use: 'Alert on a trade outcome',        prompt: 'Message me on Telegram when this trade closes', approval: true },
      { use: 'Push a research digest',          prompt: 'Summarise my AI topic signals and send to Telegram', approval: true },
      { use: 'Send a document link',            prompt: 'Forward this article to my Telegram', approval: true },
    ],
  },
  {
    id: 'daemon',
    icon: Monitor,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    label: 'Local Daemon',
    sublabel: 'Live trading data from your FlowMap daemon',
    badge: 'Connected',
    items: [
      { use: 'Check open positions',     prompt: 'What positions do I have open right now?', approval: false },
      { use: 'Check daily P&L',          prompt: 'How am I doing today? Show my P&L', approval: false },
      { use: 'View pending orders',      prompt: 'What orders are still pending?', approval: false },
      { use: 'Cancel a pending order',   prompt: 'Cancel my QQQ bracket order', approval: true },
      { use: 'Trigger a research sweep', prompt: 'Run a fresh scan on my AI topic', approval: true },
      { use: 'Check watchlist',          prompt: 'What\'s on my watchlist?', approval: false },
    ],
  },
  {
    id: 'docker',
    icon: Container,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    label: 'Docker MCP Servers',
    sublabel: 'Dynamic — discovers tools at runtime',
    badge: 'Connected',
    items: [
      { use: 'Web search',        prompt: 'Search the web for the latest news on AI infrastructure stocks', approval: false },
      { use: 'Code execution',    prompt: 'Run this Python snippet and show me the output', approval: true },
      { use: 'Database queries',  prompt: 'Query the local DB for signals from the last 7 days', approval: false },
      { use: 'File I/O',          prompt: 'Read my exported trades CSV and calculate net P&L', approval: false },
    ],
    note: 'Available tools depend on which Docker MCP servers you have running. Flow AI discovers them automatically.',
  },
]

const MEMORY_ITEMS = [
  { use: 'Set a research preference', prompt: 'Always prioritise AI/automation signals over other topics' },
  { use: 'Define a personal rule',    prompt: 'Never suggest trades with more than 2% account risk' },
  { use: 'Save a personal fact',      prompt: 'My paper account balance is $100,000' },
  { use: 'Store a stack preference',  prompt: 'I prefer React + TypeScript for any code you write' },
  { use: 'Save a trading rule',       prompt: 'I only trade during the first 90 minutes of market open' },
]

const COMING_SOON = [
  {
    icon: '📧',
    label: 'Gmail',
    items: ['Search your inbox by topic or sender', 'Draft and send emails (with your approval)', 'Summarise email threads'],
  },
  {
    icon: '📅',
    label: 'Google Calendar',
    items: ['List upcoming events', 'Create new events from AI suggestions', 'Cancel events'],
  },
  {
    icon: '📄',
    label: 'Google Docs',
    items: ['Read a document', 'Append notes or summaries to an existing doc', 'Create a new doc from AI output'],
  },
  {
    icon: '💾',
    label: 'Google Drive',
    items: ['List files in a folder', 'Upload a file or AI-generated content', 'Organise into folders'],
  },
  {
    icon: '🎨',
    label: 'Figma',
    items: ['Inspect layers, frames, and file structure', 'Read comments on a file', 'Extract design tokens'],
  },
]

const APPROVAL_TIERS = [
  {
    Icon: Eye,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    level: 'Read',
    examples: 'Checking positions, searching content, reading docs',
    behaviour: 'Runs automatically',
  },
  {
    Icon: Pencil,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    level: 'Write',
    examples: 'Creating events, saving articles, editing docs',
    behaviour: 'Asks for your approval',
  },
  {
    Icon: Send,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    level: 'Publish',
    examples: 'Sending messages, cancelling orders, triggering research',
    behaviour: 'Asks for your approval',
  },
]

// ─── sub-components ───────────────────────────────────────────────────────────

function ApprovalPill({ approval }: { approval: boolean | null }) {
  if (approval === null) return null
  if (approval) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400/80 whitespace-nowrap">
        <AlertCircle size={10} />
        Approval
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400/80 whitespace-nowrap">
      <CheckCircle2 size={10} />
      Auto
    </span>
  )
}

function UseCaseRow({ use, prompt, approval }: { use: string; prompt: string; approval: boolean | null }) {
  return (
    <div className="group flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <ChevronRight size={12} className="mt-[3px] text-white/20 flex-shrink-0 group-hover:text-white/40 transition-colors" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-white/80 font-medium leading-snug">{use}</div>
        <div className="mt-0.5 text-[11px] text-white/35 italic truncate">"{prompt}"</div>
      </div>
      <ApprovalPill approval={approval} />
    </div>
  )
}

function SectionCard({
  icon: Icon, color, bg, border, label, sublabel, badge, items, note,
}: typeof WORKING_SECTIONS[0]) {
  return (
    <div className={`rounded-xl border ${border} ${bg} overflow-hidden`}>
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <div className={`p-1.5 rounded-lg ${bg} border ${border}`}>
          <Icon size={15} className={color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-white">{label}</span>
            {badge && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {badge}
              </span>
            )}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">{sublabel}</div>
        </div>
      </div>

      {/* rows */}
      <div className="px-4 py-1">
        {items.map((item) => (
          <UseCaseRow key={item.use} {...item} />
        ))}
      </div>

      {/* note */}
      {note && (
        <div className="px-4 pb-3">
          <p className="text-[11px] text-white/35 italic">{note}</p>
        </div>
      )}
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function MCPUseCasesPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <ConnectionsSubNav />

      {/* hero */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1.5">
          <Sparkles size={18} className="text-purple-400" />
          <h1 className="text-[18px] font-semibold text-white">Flow AI — What Can It Do For You?</h1>
        </div>
        <p className="text-[13px] text-white/45 leading-relaxed max-w-2xl">
          A complete reference of every task Flow AI can handle today, what integrations each one needs,
          and whether it will ask for your approval before acting.
        </p>
      </div>

      {/* ── WORKING TODAY ── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <h2 className="text-[13px] font-semibold text-white uppercase tracking-wider">Working Today</h2>
        </div>
        <div className="grid gap-4">
          {WORKING_SECTIONS.map((s) => (
            <SectionCard key={s.id} {...s} />
          ))}
        </div>
      </section>

      {/* ── MEMORY ── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Brain size={14} className="text-violet-400" />
          <h2 className="text-[13px] font-semibold text-white uppercase tracking-wider">Memory</h2>
          <span className="text-[11px] text-white/35">— persists across every conversation</span>
        </div>
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
            <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <Brain size={15} className="text-violet-400" />
            </div>
            <div>
              <span className="text-[13px] font-semibold text-white">Persistent Context</span>
              <p className="text-[11px] text-white/40 mt-0.5">Tell Flow AI something once — it remembers forever</p>
            </div>
          </div>
          <div className="px-4 py-1">
            {MEMORY_ITEMS.map((item) => (
              <UseCaseRow key={item.use} use={item.use} prompt={item.prompt} approval={null} />
            ))}
          </div>
          <div className="px-4 pb-3">
            <p className="text-[11px] text-white/35 italic">
              Memory is categorised automatically (research_focus, personal_rule, behavior…) and injected into every AI response.
            </p>
          </div>
        </div>
      </section>

      {/* ── COMING SOON ── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={14} className="text-white/40" />
          <h2 className="text-[13px] font-semibold text-white uppercase tracking-wider">Coming Soon</h2>
          <span className="text-[11px] text-white/35">— Phase 3, needs OAuth</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COMING_SOON.map((cs) => (
            <div
              key={cs.label}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[18px]">{cs.icon}</span>
                <div>
                  <div className="text-[12px] font-semibold text-white/70">{cs.label}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Lock size={9} className="text-white/25" />
                    <span className="text-[10px] text-white/25">OAuth required</span>
                  </div>
                </div>
              </div>
              <ul className="space-y-1.5">
                {cs.items.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <span className="mt-[5px] w-1 h-1 rounded-full bg-white/20 flex-shrink-0" />
                    <span className="text-[11px] text-white/40 leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── APPROVAL MODEL ── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={14} className="text-white/40" />
          <h2 className="text-[13px] font-semibold text-white uppercase tracking-wider">How Approval Works</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {APPROVAL_TIERS.map(({ Icon, color, bg, border, level, examples, behaviour }) => (
            <div key={level} className={`rounded-xl border ${border} ${bg} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={color} />
                <span className={`text-[13px] font-semibold ${color}`}>{level}</span>
              </div>
              <p className="text-[11px] text-white/50 leading-snug mb-2">{examples}</p>
              <div className="text-[11px] font-medium text-white/70">{behaviour}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-white/35 leading-relaxed">
          You see a confirmation prompt before anything is written or sent. You can always say no.
          All tool calls are logged in the MCP execution history. Maximum 15 reasoning steps per turn.
        </p>
      </section>
    </div>
  )
}
