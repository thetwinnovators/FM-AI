import { CodeXml } from 'lucide-react'
import PythonCurriculumApp from '../python-curriculum/components/PythonCurriculumApp.jsx'

export default function CodeAcademy() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-1 flex-shrink-0">
        <h1 className="text-[15px] font-semibold text-white/85 leading-none inline-flex items-center gap-2">
          <CodeXml size={15} className="text-teal-400" /> Code Academy
        </h1>
      </div>

      <div className="flex-1 overflow-auto">
        <PythonCurriculumApp />
      </div>
    </div>
  )
}
