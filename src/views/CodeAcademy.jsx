import { useState } from 'react'
import { GraduationCap, BookOpen, Sparkles } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { useCodeAcademy } from '../code-academy/useCodeAcademy.js'
import CodeAcademyHome from '../code-academy/components/CodeAcademyHome.jsx'
import CodeAcademyPage from '../code-academy/components/CodeAcademyPage.jsx'
import PythonCurriculumApp from '../python-curriculum/components/PythonCurriculumApp.jsx'

const TABS = [
  { id: 'learn',    label: 'Learn',    Icon: BookOpen  },
  { id: 'generate', label: 'Generate', Icon: Sparkles  },
]

export default function CodeAcademy() {
  const [mode, setMode] = useState('learn')

  const { allCodeProgress, deleteCodeLesson } = useStore()
  const academy = useCodeAcademy()
  const progressList = allCodeProgress()

  const showTabs = mode === 'learn' || academy.stage === 'home'

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-shrink-0 px-6 pt-5 pb-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between">

          {/* ── Page identity ── */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: 36, height: 36,
                background: 'linear-gradient(135deg, rgba(13,148,136,0.35) 0%, rgba(6,182,212,0.12) 100%)',
                border: '1px solid rgba(45,212,191,0.22)',
                boxShadow: '0 0 16px rgba(13,148,136,0.12)',
              }}
            >
              <GraduationCap size={17} style={{ color: '#2dd4bf' }} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                  color: 'rgba(255,255,255,0.92)',
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                }}
              >
                Code Academy
              </h1>
              <p
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.13em',
                  color: 'rgba(45,212,191,0.45)',
                  marginTop: 1,
                }}
              >
                Python · AI-Powered
              </p>
            </div>
          </div>

          {/* ── Segmented tab control ── */}
          {showTabs && (
            <div
              className="flex items-center p-[3px] rounded-xl gap-0.5"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {TABS.map(({ id, label, Icon }) => {
                const active = mode === id
                return (
                  <button
                    key={id}
                    onClick={() => setMode(id)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-[9px] text-[12px] font-semibold"
                    style={{
                      background:  active ? 'rgba(13,148,136,0.22)' : 'transparent',
                      color:       active ? '#2dd4bf'               : 'rgba(255,255,255,0.32)',
                      border:      active ? '1px solid rgba(45,212,191,0.3)' : '1px solid transparent',
                      boxShadow:   active ? '0 1px 12px rgba(13,148,136,0.18), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
                      transition:  'all 160ms ease',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={12} strokeWidth={active ? 2.5 : 2} />
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {mode === 'learn' ? (
          <PythonCurriculumApp />
        ) : academy.stage === 'home' ? (
          <CodeAcademyHome
            onStart={academy.startLesson}
            onDelete={deleteCodeLesson}
            isLoading={academy.stage === 'loading'}
            error={academy.error}
            progressList={progressList}
          />
        ) : (
          <CodeAcademyPage academy={academy} />
        )}
      </div>
    </div>
  )
}
