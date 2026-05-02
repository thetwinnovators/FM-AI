import { Plug } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MCPIntegration, IntegrationType } from '../types.js'
import { IntegrationStatusBadge } from './IntegrationStatusBadge.js'

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#2CA5E0" />
      <path
        fill="#fff"
        d="M5.491 11.74l11.57-4.461c.537-.194.954.131.787.943l-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.062 14.6l-2.948-.924c-.64-.204-.655-.64.377-.936z"
      />
    </svg>
  )
}

function GoogleDriveIcon() {
  return (
    <svg viewBox="0 0 87.3 78" width="22" height="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L28 51H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="M43.65 25L29.4 0c-1.35.8-2.5 1.9-3.3 3.3L1.2 46.5c-.8 1.4-1.2 2.95-1.2 4.5h28z" fill="#00ac47"/>
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.3l5.95 10.45z" fill="#ea4335"/>
      <path d="M43.65 25L57.9 0H29.4z" fill="#00832d"/>
      <path d="M59.3 51h28c0-1.55-.4-3.1-1.2-4.5L61.8 3.3c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25z" fill="#2684fc"/>
      <path d="M28 51l14.25 24.8 1.4 1.2 14.25-24.8z" fill="#ffba00"/>
    </svg>
  )
}

function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
    </svg>
  )
}

function GoogleCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 2h-1V0h-2v2H9V0H7v2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V8h12v12z" fill="#4285F4"/>
      <path d="M6 8h12v2H6z" fill="#1A73E8"/>
      <path d="M11 11h2v2h-2zm3 0h2v2h-2zm-6 3h2v2H8zm3 0h2v2h-2zm3 0h2v2h-2zM8 17h2v2H8zm3 0h2v2h-2z" fill="#EA4335"/>
    </svg>
  )
}

function GoogleSlidesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.93 2H7.08C5.93 2 5 2.93 5 4.08v15.84C5 21.07 5.93 22 7.08 22h12.85c1.15 0 2.08-.93 2.08-2.08V4.08C22.01 2.93 21.08 2 19.93 2z" fill="#F4B400"/>
      <path d="M2 6.14v11.72C2 19.03 2.97 20 4.14 20V5.99a1.98 1.98 0 00-1.42.59A1.98 1.98 0 002 6.14z" fill="#DB9500"/>
      <path d="M9 8h8v2H9zm0 3h8v2H9zm0 3h5v2H9z" fill="#fff" opacity=".9"/>
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" fill="#FF0000"/>
      <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#fff"/>
    </svg>
  )
}

function GoogleDocsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0H4C2.9 0 2 .9 2 2v20c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6l-8-6z" fill="#4285F4"/>
      <path d="M14 0v6h6L14 0z" fill="#1A73E8"/>
      <path d="M6 11h12v1.5H6zm0 3h12v1.5H6zm0 3h8v1.5H6z" fill="#fff" opacity=".9"/>
    </svg>
  )
}

function HiggsfieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hf" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED"/>
          <stop offset="100%" stopColor="#EC4899"/>
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#hf)"/>
      <path d="M7 17V7l10 5-10 5z" fill="#fff"/>
      <circle cx="18" cy="7" r="2.5" fill="#fff" opacity=".85"/>
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F58529"/>
          <stop offset="35%" stopColor="#DD2A7B"/>
          <stop offset="70%" stopColor="#8134AF"/>
          <stop offset="100%" stopColor="#515BD4"/>
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig)"/>
      <circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="1.8"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="#fff"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#1877F2"/>
      <path d="M16.5 12H14V10c0-.828.172-1 1-1h1.5V7H14c-2 0-3 1.5-3 3v2h-2v2h2v5h2.5v-5H16l.5-2z" fill="#fff"/>
    </svg>
  )
}

function FigmaIcon() {
  return (
    <svg width="18" height="27" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 28.5C19 25.98 20 23.56 21.78 21.78C23.56 20 25.98 19 28.5 19C31.02 19 33.44 20 35.22 21.78C36.99 23.56 38 25.98 38 28.5C38 31.02 36.99 33.44 35.22 35.22C33.44 36.99 31.02 38 28.5 38C25.98 38 23.56 36.99 21.78 35.22C20 33.44 19 31.02 19 28.5Z" fill="#1ABCFE"/>
      <path d="M0 47.5C0 44.98 1 42.56 2.78 40.78C4.56 39 6.98 38 9.5 38H19V47.5C19 50.02 17.99 52.44 16.22 54.22C14.44 55.99 12.02 57 9.5 57C6.98 57 4.56 55.99 2.78 54.22C1 52.44 0 50.02 0 47.5Z" fill="#0ACF83"/>
      <path d="M19 0V19H28.5C31.02 19 33.44 17.99 35.22 16.22C36.99 14.44 38 12.02 38 9.5C38 6.98 36.99 4.56 35.22 2.78C33.44 1 31.02 0 28.5 0H19Z" fill="#FF7262"/>
      <path d="M0 9.5C0 12.02 1 14.44 2.78 16.22C4.56 17.99 6.98 19 9.5 19H19V0H9.5C6.98 0 4.56 1 2.78 2.78C1 4.56 0 6.98 0 9.5Z" fill="#F24E1E"/>
      <path d="M0 28.5C0 31.02 1 33.44 2.78 35.22C4.56 36.99 6.98 38 9.5 38H19V19H9.5C6.98 19 4.56 20 2.78 21.78C1 23.56 0 25.98 0 28.5Z" fill="#A259FF"/>
    </svg>
  )
}

const TYPE_EMOJI: Record<string, string> = {}

function IntegrationIcon({ type }: { type: IntegrationType }) {
  if (type === 'telegram')        return <TelegramIcon />
  if (type === 'figma')           return <FigmaIcon />
  if (type === 'google-drive')    return <GoogleDriveIcon />
  if (type === 'gmail')           return <GmailIcon />
  if (type === 'google-calendar') return <GoogleCalendarIcon />
  if (type === 'google-slides')   return <GoogleSlidesIcon />
  if (type === 'youtube')         return <YouTubeIcon />
  if (type === 'google-docs')     return <GoogleDocsIcon />
  if (type === 'higgsfield')      return <HiggsfieldIcon />
  if (type === 'instagram')       return <InstagramIcon />
  if (type === 'facebook')        return <FacebookIcon />
  const emoji = TYPE_EMOJI[type]
  if (emoji) return <span>{emoji}</span>
  return <Plug size={16} className="text-white/50" />
}

interface Props {
  integration: MCPIntegration
  toolCount?: number
  comingSoon?: boolean
}

export function IntegrationCard({ integration, toolCount, comingSoon }: Props) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-white/[0.06] flex items-center justify-center text-base overflow-hidden">
            <IntegrationIcon type={integration.type} />
          </div>
          <div>
            <div className="text-sm font-medium text-white/90">{integration.name}</div>
            {integration.description ? (
              <div className="text-[11px] text-white/45 mt-0.5 line-clamp-1">
                {integration.description}
              </div>
            ) : null}
          </div>
        </div>
        {comingSoon ? (
          <span className="inline-flex items-center text-[10px] font-semibold tracking-wide text-white/40 bg-white/[0.06] border border-white/10 px-2 py-0.5 rounded-full uppercase">
            Soon
          </span>
        ) : (
          <IntegrationStatusBadge status={integration.status} />
        )}
      </div>
      {toolCount !== undefined && toolCount > 0 ? (
        <div className="mt-3 text-[11px] text-white/35">
          {toolCount} tool{toolCount !== 1 ? 's' : ''} available
        </div>
      ) : null}
    </>
  )

  if (comingSoon) {
    return (
      <div
        className="block glass-panel p-4 rounded-xl opacity-50 cursor-default select-none"
        style={{ boxShadow: 'none' }}
      >
        {inner}
      </div>
    )
  }

  return (
    <Link
      to={`/connections/${integration.id}`}
      className="block glass-panel p-4 rounded-xl hover:brightness-110 transition-all"
    >
      {inner}
    </Link>
  )
}
