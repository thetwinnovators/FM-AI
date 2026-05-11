import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useCodeAcademy } from '../code-academy/useCodeAcademy.js'
import CodeAcademyHome from '../code-academy/components/CodeAcademyHome.jsx'
import CodeAcademyPage from '../code-academy/components/CodeAcademyPage.jsx'
import PythonCurriculumApp from '../python-curriculum/components/PythonCurriculumApp.jsx'

const TABS = [
  { id: 'learn',    label: 'Learn' },
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
      {showTabs && (
        <div className="flex gap-1 px-6 pt-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className="px-5 py-2 rounded-t-xl text-sm font-semibold transition-colors"
              style={{
                background:   mode === tab.id ? 'rgba(13,148,136,0.15)' : 'transparent',
                color:        mode === tab.id ? '#2dd4bf'               : 'rgba(255,255,255,0.35)',
                borderBottom: mode === tab.id ? '2px solid #0d9488'     : '2px solid transparent',
              }}
            >
              {tab.label}
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
