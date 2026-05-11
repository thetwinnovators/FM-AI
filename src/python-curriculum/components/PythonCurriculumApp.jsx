import { useState } from 'react'
import { useStore } from '../../store/useStore'
import LanguagePicker from './LanguagePicker'
import LessonMap from './LessonMap'
import SubLessonView from './SubLessonView'

export default function PythonCurriculumApp() {
  const [stage, setStage]           = useState('language')  // 'language' | 'map' | 'lesson'
  const [selectedLesson, setSelectedLesson] = useState(null) // { groupId, subLessonId }
  const [mapScrollTop, setMapScrollTop]     = useState(0)

  const { pythonProgress } = useStore()
  const progress = pythonProgress ?? {}

  function refreshProgress() {} // store updates trigger re-render automatically

  function navigate(newStage, params) {
    if (newStage === 'lesson' && params) setSelectedLesson(params)
    setStage(newStage)
  }

  if (stage === 'language') {
    return <LanguagePicker onSelectPython={() => navigate('map')} />
  }

  if (stage === 'map') {
    return (
      <LessonMap
        progress={progress}
        initialScrollTop={mapScrollTop}
        onScrollChange={setMapScrollTop}
        onSelectLesson={(groupId, subLessonId) => navigate('lesson', { groupId, subLessonId })}
        onBack={() => navigate('language')}
      />
    )
  }

  const { groupId, subLessonId } = selectedLesson ?? {}
  return (
    <SubLessonView
      groupId={groupId}
      subLessonId={subLessonId}
      progress={progress}
      onBack={() => navigate('map')}
      onProgressChange={refreshProgress}
      onNext={() => navigate('map')}
    />
  )
}
