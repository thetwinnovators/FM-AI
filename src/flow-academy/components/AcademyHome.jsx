import { useMemo, useState } from 'react'
import { GraduationCap, Trash2 } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { useSeed } from '../../store/useSeed.js'
import TopicPicker from './TopicPicker.jsx'
import SyllabusView from './SyllabusView.jsx'
import LessonView from './LessonView.jsx'
import QuizView from './QuizView.jsx'
import QuizResults from './QuizResults.jsx'
import { computePercentComplete } from '../quizEngine.js'

// ── Static fallback topics (shown when the user has no saved interests yet) ───

const FALLBACK_TOPICS = [
  'How the internet works',
  'The basics of electricity',
  'DNA and genetics',
  'How black holes form',
  'The water cycle',
  'How computers process information',
  'The history of money',
  'How vaccines work',
  'Climate and weather patterns',
  "Newton's laws of motion",
  'How the stock market works',
  'The basics of machine learning',
]

// Build a personalised suggestion list from the user's FlowMap interests.
// Priority: followed topics → recent searches → seed topics → static fallback.
function usePersonalisedTopics() {
  const { userTopics, recentSearches } = useStore()
  const { topics: seedTopics } = useSeed()

  return useMemo(() => {
    const seen = new Set()
    const result = []

    function add(label) {
      const key = label.trim().toLowerCase()
      if (!key || key.length < 3 || seen.has(key)) return
      seen.add(key)
      result.push(label.trim())
    }

    // 1. User's followed topics (highest relevance)
    Object.values(userTopics).forEach((t) => {
      if (t.name) add(t.name)
    })

    // 2. Recent search queries (user expressed direct intent)
    recentSearches(8).forEach((r) => {
      if (r.query) add(r.query)
    })

    // 3. Seed topics — pad if the user has few interests yet
    if (result.length < 6) {
      ;(seedTopics || []).slice(0, 16).forEach((t) => {
        if (t.name) add(t.name)
      })
    }

    // 4. Static fallback if still empty
    if (result.length === 0) return FALLBACK_TOPICS

    return result.slice(0, 16)
  }, [userTopics, recentSearches, seedTopics])
}

// ── Course card (In Progress / Completed tabs) ────────────────────────────────

function CourseCard({ course, onOpen }) {
  const { deleteCourse } = useStore()
  const pct = computePercentComplete(course)
  const passedCount = course.lessons.filter((l) => l.status === 'passed').length
  const [confirming, setConfirming] = useState(false)

  function handleDelete(e) {
    e.stopPropagation()
    setConfirming(true)
  }

  function handleConfirmDelete(e) {
    e.stopPropagation()
    deleteCourse(course.id)
  }

  function handleCancelDelete(e) {
    e.stopPropagation()
    setConfirming(false)
  }

  return (
    <div
      className="relative group w-full text-left p-4 rounded-xl border border-white/[0.08] hover:border-white/20 transition-colors cursor-pointer"
      style={{ background: 'linear-gradient(160deg, rgba(15,17,28,0.6) 0%, rgba(8,10,18,0.7) 100%)' }}
      onClick={() => !confirming && onOpen(course.id)}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/90 truncate">{course.title}</p>
          <p className="text-xs text-[color:var(--color-text-tertiary)] mt-0.5 truncate">{course.topic}</p>
        </div>

        {/* Right side: status badge + delete controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {course.status === 'completed' && !confirming && (
            <span className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded border text-emerald-300 border-emerald-400/40 bg-emerald-500/10">
              Done
            </span>
          )}

          {confirming ? (
            /* Confirmation row */
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-white/50 mr-0.5">Delete?</span>
              <button
                onClick={handleConfirmDelete}
                className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/35 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={handleCancelDelete}
                className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white/[0.06] text-white/50 hover:bg-white/[0.12] transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            /* Trash icon — visible on hover */
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
              title="Delete course"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 h-1 rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-[color:var(--color-text-tertiary)] mt-1.5">
        {pct}% complete · {passedCount} of {course.lessons.length} lessons passed
      </p>
    </div>
  )
}

// ── Light-mode frame for course reading experience ────────────────────────────
// All course views (syllabus, lesson, quiz, results) render inside this white
// card so they feel like a focused document, distinct from the dark app chrome.

function CourseFrame({ children }) {
  return (
    <div className="p-5 pb-10">
      {/* Page-level header — stays in the dark app chrome above the card */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <GraduationCap size={16} className="text-teal-400" />
        <span className="text-sm font-semibold text-[color:var(--color-text-secondary)] tracking-wide">
          Flow Academy
        </span>
      </div>

      <div
        className="rounded-2xl border border-slate-300/60 shadow-sm overflow-hidden"
        style={{ background: '#eef0f4', color: '#0f172a' }}
      >
        <div className="px-10 pt-8 pb-12">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Back button — dark text for light-mode frame ───────────────────────────────

function BackButton({ onBack, label }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-900 mb-7 transition-colors"
    >
      ← <span>{label}</span>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AcademyHome() {
  const { courseById, allCoursesSorted, userTopics, recentSearches } = useStore()
  const suggestedTopics = usePersonalisedTopics()
  const hasPersonalData = Object.keys(userTopics || {}).length > 0 || recentSearches(1).length > 0

  // Tab state: 'discover' | 'in_progress' | 'completed'
  const [tab, setTab] = useState('discover')

  // Internal nav stack — null = showing tab home
  // { view: 'syllabus' | 'lesson' | 'quiz' | 'results', courseId, lessonId?, quizResult? }
  const [nav, setNav] = useState(null)

  function openCourse(courseId) {
    setNav({ view: 'syllabus', courseId })
  }

  function openLesson(courseId, lessonId) {
    setNav({ view: 'lesson', courseId, lessonId })
  }

  function openQuiz(courseId, lessonId) {
    setNav({ view: 'quiz', courseId, lessonId })
  }

  function showResults(courseId, lessonId, quizResult) {
    setNav({ view: 'results', courseId, lessonId, quizResult })
  }

  // ── Inner view rendering ──────────────────────────────────────────────────────

  if (nav) {
    const course = courseById(nav.courseId)
    if (!course) { setNav(null); return null }

    if (nav.view === 'syllabus') {
      return (
        <CourseFrame>
          <BackButton onBack={() => setNav(null)} label="Flow Academy" />
          <SyllabusView course={course} onOpenLesson={openLesson} />
        </CourseFrame>
      )
    }

    const lesson = course.lessons.find((l) => l.id === nav.lessonId)
    if (!lesson) { setNav({ view: 'syllabus', courseId: nav.courseId }); return null }

    if (nav.view === 'lesson') {
      return (
        <CourseFrame>
          <BackButton
            onBack={() => setNav({ view: 'syllabus', courseId: nav.courseId })}
            label={course.title}
          />
          <LessonView
            course={course}
            lesson={lesson}
            onTakeQuiz={() => openQuiz(nav.courseId, nav.lessonId)}
          />
        </CourseFrame>
      )
    }

    if (nav.view === 'quiz') {
      return (
        <CourseFrame>
          <BackButton
            onBack={() => openLesson(nav.courseId, nav.lessonId)}
            label={lesson.title}
          />
          <QuizView
            lesson={lesson}
            onSubmit={(result) => showResults(nav.courseId, nav.lessonId, result)}
          />
        </CourseFrame>
      )
    }

    if (nav.view === 'results') {
      return (
        <CourseFrame>
          <QuizResults
            course={course}
            lesson={lesson}
            result={nav.quizResult}
            onRetry={() => openQuiz(nav.courseId, nav.lessonId)}
            onContinue={() => {
              const nextLesson = course.lessons.find(
                (l) => l.order > lesson.order && (l.status === 'unlocked' || l.status === 'passed'),
              )
              if (nextLesson) {
                openLesson(nav.courseId, nextLesson.id)
              } else {
                setNav({ view: 'syllabus', courseId: nav.courseId })
              }
            }}
            onBackToSyllabus={() => setNav({ view: 'syllabus', courseId: nav.courseId })}
          />
        </CourseFrame>
      )
    }
  }

  // ── Tab home ─────────────────────────────────────────────────────────────────

  const allCourses = allCoursesSorted()
  const inProgress = allCourses.filter((c) => c.status === 'in_progress' || c.status === 'draft')
  const completed  = allCourses.filter((c) => c.status === 'completed')

  const TABS = [
    { id: 'discover',    label: 'Discover' },
    { id: 'in_progress', label: 'In Progress', count: inProgress.length },
    { id: 'completed',   label: 'Completed',   count: completed.length  },
  ]

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2.5">
          <GraduationCap size={22} className="text-teal-400" /> Flow Academy
        </h1>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
          AI-generated beginner courses on any topic. Learn step by step and prove your understanding.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.08]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative -mb-px ${
              tab === t.id
                ? 'text-white border-b-2 border-teal-400'
                : 'text-[color:var(--color-text-secondary)] hover:text-white'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-white/[0.08] text-[color:var(--color-text-tertiary)]">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'discover' && (
        <TopicPicker
          suggestedTopics={suggestedTopics}
          isPersonalised={hasPersonalData}
          onCourseCreated={(courseId) => openCourse(courseId)}
        />
      )}

      {tab === 'in_progress' && (
        inProgress.length === 0 ? (
          <div className="py-16 text-center text-sm text-[color:var(--color-text-tertiary)]">
            <GraduationCap size={28} className="mx-auto mb-3 opacity-40" />
            <p>
              No courses in progress.{' '}
              <button className="underline text-white" onClick={() => setTab('discover')}>
                Discover
              </button>{' '}
              a topic to start one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {inProgress.map((c) => <CourseCard key={c.id} course={c} onOpen={openCourse} />)}
          </div>
        )
      )}

      {tab === 'completed' && (
        completed.length === 0 ? (
          <div className="py-16 text-center text-sm text-[color:var(--color-text-tertiary)]">
            <p>No completed courses yet. Keep learning!</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {completed.map((c) => <CourseCard key={c.id} course={c} onOpen={openCourse} />)}
          </div>
        )
      )}
    </div>
  )
}
