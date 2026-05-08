import { useStore } from '../store/useStore.js'
import { useCodeAcademy } from '../code-academy/useCodeAcademy.js'
import CodeAcademyHome from '../code-academy/components/CodeAcademyHome.jsx'
import CodeAcademyPage from '../code-academy/components/CodeAcademyPage.jsx'

export default function CodeAcademy() {
  const { allCodeProgress } = useStore()
  const academy = useCodeAcademy()
  const progressList = allCodeProgress()

  if (academy.stage === 'home') {
    return (
      <CodeAcademyHome
        onStart={academy.startLesson}
        isLoading={academy.stage === 'loading'}
        error={academy.error}
        progressList={progressList}
      />
    )
  }

  return <CodeAcademyPage academy={academy} />
}
