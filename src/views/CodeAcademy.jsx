import { CodeXml } from 'lucide-react'
import PythonCurriculumApp from '../python-curriculum/components/PythonCurriculumApp.jsx'

export default function CodeAcademy() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-1 flex-shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2.5">
          <CodeXml size={20} className="text-[color:var(--color-topic)]" /> Flow Code
        </h1>
      </div>

      <div className="flex-1 overflow-auto">
        <PythonCurriculumApp />
      </div>
    </div>
  )
}
