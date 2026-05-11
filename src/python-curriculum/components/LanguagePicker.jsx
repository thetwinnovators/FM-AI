import { useState } from 'react'
import { Lock } from 'lucide-react'
import PlaceholderModal from './PlaceholderModal'

const ACTIVE_LANGUAGE = {
  id: 'python', label: 'Python', emoji: '🐍',
  desc: 'Automate tasks, analyse data, build apps',
}

const COMING_SOON = [
  { id: 'javascript', label: 'JavaScript', emoji: '🟨', desc: 'Add interactivity to websites' },
  { id: 'html',       label: 'HTML',       emoji: '🟧', desc: 'Structure web pages' },
  { id: 'css',        label: 'CSS',        emoji: '🎨', desc: 'Style web pages' },
  { id: 'sql',        label: 'SQL',        emoji: '🗄️',  desc: 'Query databases' },
  { id: 'typescript', label: 'TypeScript', emoji: '🔷', desc: 'JavaScript with types' },
  { id: 'react',      label: 'React',      emoji: '⚛️',  desc: 'Build UI components' },
  { id: 'nodejs',     label: 'Node.js',    emoji: '🟩', desc: 'Server-side JavaScript' },
]

function LanguageCard({ lang, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col gap-2 p-5 rounded-2xl text-left transition-all hover:brightness-105"
      style={{
        background: active ? 'rgba(53,114,165,0.15)'         : 'rgba(255,255,255,0.02)',
        border:     active ? '1px solid rgba(53,114,165,0.5)' : '1px solid rgba(255,255,255,0.07)',
        opacity:    active ? 1 : 0.5,
      }}
    >
      {!active && (
        <span
          className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}
        >
          <Lock size={9} /> Coming soon
        </span>
      )}
      <span className="text-2xl">{lang.emoji}</span>
      <div>
        <div className="text-[14px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
          {lang.label}
        </div>
        <div className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {lang.desc}
        </div>
      </div>
      {active && (
        <span
          className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full self-start"
          style={{ background: 'rgba(13,148,136,0.2)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)' }}
        >
          Available now
        </span>
      )}
    </button>
  )
}

export default function LanguagePicker({ onSelectPython }) {
  const [placeholder, setPlaceholder] = useState(null)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
          Choose a language
        </h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Python is the first available track. More are coming.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <LanguageCard lang={ACTIVE_LANGUAGE} active onClick={onSelectPython} />
        {COMING_SOON.map((lang) => (
          <LanguageCard
            key={lang.id}
            lang={lang}
            active={false}
            onClick={() => setPlaceholder(lang.label)}
          />
        ))}
      </div>

      <PlaceholderModal
        language={placeholder}
        onClose={() => setPlaceholder(null)}
        onContinueWithPython={() => { setPlaceholder(null); onSelectPython() }}
      />
    </div>
  )
}
