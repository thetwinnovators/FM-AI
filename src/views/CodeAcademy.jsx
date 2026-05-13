import { useState } from 'react'
import { CodeXml } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { useCodeAcademy } from '../code-academy/useCodeAcademy.js'
import CodeAcademyHome from '../code-academy/components/CodeAcademyHome.jsx'
import CodeAcademyPage from '../code-academy/components/CodeAcademyPage.jsx'
import PythonCurriculumApp from '../python-curriculum/components/PythonCurriculumApp.jsx'

const TABS = [
  { id: 'learn',    label: 'Learn'    },
  { id: 'generate', label: 'Generate' },
]

export default function CodeAcademy() {
  const [mode, setMode] = useState('learn')

  const { allCodeProgress, deleteCodeLesson } = useStore()
  const academy = useCodeAcademy()
  const progressList = allCodeProgress()

  const showTabs = mode === 'learn' || academy.stage === 'home'

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-1 flex-shrink-0">
        <h1 className="text-[15px] font-semibold text-white/85 leading-none inline-flex items-center gap-2">
          <CodeXml size={15} className="text-teal-400" /> Code Academy
        </h1>
      </div>

      {showTabs && (
        <div className="flex gap-1 px-6 pt-4 border-b border-white/[0.08] flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors relative -mb-px ${
                mode === t.id
                  ? 'text-white border-b-2 border-teal-400'
                  : 'text-[color:var(--color-text-secondary)] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

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
