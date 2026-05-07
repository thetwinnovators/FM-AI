import { useMemo, useState } from 'react'
import { Clock, GraduationCap, Trash2, Share2 } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { useSeed } from '../../store/useSeed.js'
import TopicPicker from './TopicPicker.jsx'
import SyllabusView from './SyllabusView.jsx'
import LessonView from './LessonView.jsx'
import QuizView from './QuizView.jsx'
import QuizResults from './QuizResults.jsx'
import { computePercentComplete } from '../quizEngine.js'
import ShareCourseModal from '../../flow-academy-sharing/components/ShareCourseModal.jsx'
import ImportCourseModal from '../../flow-academy-sharing/components/ImportCourseModal.jsx'

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
  const passedLessons = course.lessons.filter((l) => l.status === 'passed')
  const passedCount = passedLessons.length
  const [confirming, setConfirming] = useState(false)

  // Average quiz score across lessons that have been scored
  const scoredLessons = passedLessons.filter((l) => l.bestScore != null)
  const avgScore = scoredLessons.length > 0
    ? Math.round(scoredLessons.reduce((sum, l) => sum + l.bestScore, 0) / scoredLessons.length)
    : null

  const isCompleted = course.status === 'completed'

  function handleDelete(e) { e.stopPropagation(); setConfirming(true) }
  function handleConfirmDelete(e) { e.stopPropagation(); deleteCourse(course.id) }
  function handleCancelDelete(e) { e.stopPropagation(); setConfirming(false) }

  return (
    <div
      className="relative group w-full text-left rounded-xl border overflow-hidden cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg"
      style={{
        background: 'linear-gradient(160deg, rgba(15,17,28,0.75) 0%, rgba(8,10,18,0.85) 100%)',
        borderColor: isCompleted ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)',
        boxShadow: isCompleted ? '0 0 0 1px rgba(52,211,153,0.1) inset' : 'none',
      }}
      onClick={() => !confirming && onOpen(course.id)}
    >
      <div className="p-5">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-semibold text-white/90 leading-snug mb-1"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {course.title}
            </p>
            <p className="text-[11px] text-white/35 truncate tracking-wide uppercase">{course.topic}</p>
          </div>

          {/* Status pill + delete */}
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            {!confirming && (
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border ${
                isCompleted
                  ? 'text-emerald-400 bg-emerald-500/15 border-emerald-400/25'
                  : 'text-teal-400/80 bg-teal-500/10 border-teal-400/15'
              }`}>
                {isCompleted ? 'Completed' : 'In Progress'}
              </span>
            )}

            {confirming ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-white/40 mr-0.5">Delete?</span>
                <button onClick={handleConfirmDelete} className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/35 transition-colors">Yes</button>
                <button onClick={handleCancelDelete} className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white/[0.06] text-white/50 hover:bg-white/[0.12] transition-colors">No</button>
              </div>
            ) : (
              <button
                onClick={handleDelete}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-all"
                title="Delete course"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* ── Course summary ── */}
        {course.summary && (
          <p
            className="text-[12px] text-white/40 leading-relaxed mb-4"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {course.summary}
          </p>
        )}

        {/* ── Meta row: time · lessons ── */}
        <div className="flex items-center gap-4 mb-4">
          {course.estimatedDurationMinutes > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-white/30 flex-shrink-0" />
              <span className="text-xs font-medium text-white/50">
                {course.estimatedDurationMinutes >= 60
                  ? `${Math.floor(course.estimatedDurationMinutes / 60)}h${course.estimatedDurationMinutes % 60 > 0 ? ` ${course.estimatedDurationMinutes % 60}m` : ''}`
                  : `${course.estimatedDurationMinutes}m`}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-white/50">
              {course.lessons.length} lessons
            </span>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-white/30 font-medium">Progress</span>
            <span className="text-[11px] font-bold text-white/60">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: isCompleted
                  ? 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)'
                  : 'linear-gradient(90deg, #0d9488 0%, #6366f1 100%)',
              }}
            />
          </div>
        </div>

        {/* ── Lesson dots + score ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* One dot per lesson — filled=passed, ring=unlocked, dark=locked */}
            {course.lessons.map((l) => (
              <div
                key={l.id}
                title={l.title}
                className="rounded-full flex-shrink-0 transition-all"
                style={{
                  width:  l.status === 'passed' ? 8 : 6,
                  height: l.status === 'passed' ? 8 : 6,
                  background:
                    l.status === 'passed'   ? '#2dd4bf' :
                    l.status === 'unlocked' ? 'transparent' :
                    'rgba(255,255,255,0.08)',
                  border:
                    l.status === 'unlocked' ? '1.5px solid rgba(45,212,191,0.45)' : 'none',
                }}
              />
            ))}
            <span className="text-[11px] text-white/35 ml-0.5">
              {passedCount} / {course.lessons.length} done
            </span>
          </div>

          {/* Avg score badge */}
          {avgScore != null && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
              avgScore >= 80 ? 'text-emerald-400 bg-emerald-500/10' :
              avgScore >= 60 ? 'text-amber-400 bg-amber-500/10' :
                               'text-red-400 bg-red-500/10'
            }`}>
              Avg {avgScore}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Light-mode frame for course reading experience ────────────────────────────
// All course views (syllabus, lesson, quiz, results) render inside this white
// card so they feel like a focused document, distinct from the dark app chrome.

function CourseFrame({ children, onHome, actions }) {
  return (
    <div className="p-5 pb-10">
      {/* Page-level header — stays in the dark app chrome above the card */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <GraduationCap size={16} className="text-teal-400" />
        <button
          onClick={onHome}
          className="text-sm font-semibold tracking-wide text-[color:var(--color-text-secondary)] hover:text-teal-400 transition-colors"
        >
          Flow Academy
        </button>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
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

  // Sharing modals
  const [shareId, setShareId]     = useState(null)   // courseId being shared, or null
  const [importOpen, setImport]   = useState(false)

  // Always scroll the main content panel to the top before switching views.
  function navigate(navState) {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' })
    setNav(navState)
  }

  function openCourse(courseId) {
    navigate({ view: 'syllabus', courseId })
  }

  function openLesson(courseId, lessonId) {
    navigate({ view: 'lesson', courseId, lessonId })
  }

  function openQuiz(courseId, lessonId) {
    navigate({ view: 'quiz', courseId, lessonId })
  }

  function showResults(courseId, lessonId, quizResult) {
    navigate({ view: 'results', courseId, lessonId, quizResult })
  }

  // ── Inner view rendering ──────────────────────────────────────────────────────

  if (nav) {
    const course = courseById(nav.courseId)
    if (!course) { navigate(null); return null }

    if (nav.view === 'syllabus') {
      return (
        <>
          <CourseFrame
            onHome={() => navigate(null)}
            actions={
              <button
                onClick={() => setShareId(course.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: 'rgba(13,148,136,0.15)',
                  border: '1px solid rgba(45,212,191,0.25)',
                  color: '#2dd4bf',
                }}
              >
                <Share2 size={12} /> Share
              </button>
            }
          >
            <BackButton onBack={() => navigate(null)} label="Flow Academy" />
            <SyllabusView course={course} onOpenLesson={openLesson} />
          </CourseFrame>
          <ShareCourseModal
            open={shareId === course.id}
            course={course}
            onClose={() => setShareId(null)}
          />
        </>
      )
    }

    const lesson = course.lessons.find((l) => l.id === nav.lessonId)
    if (!lesson) { navigate({ view: 'syllabus', courseId: nav.courseId }); return null }

    if (nav.view === 'lesson') {
      return (
        <CourseFrame onHome={() => navigate(null)}>
          <BackButton
            onBack={() => navigate({ view: 'syllabus', courseId: nav.courseId })}
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
        <CourseFrame onHome={() => navigate(null)}>
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
        <CourseFrame onHome={() => navigate(null)}>
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
                navigate({ view: 'syllabus', courseId: nav.courseId })
              }
            }}
            onBackToSyllabus={() => navigate({ view: 'syllabus', courseId: nav.courseId })}
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
    <div className="flex flex-col min-h-full">
      {/* Tabs bar — always visible at top */}
      <div className="flex gap-1 px-6 pt-4 border-b border-white/[0.08] flex-shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' }); setTab(t.id) }}
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
        <div
          className="flex-1 flex flex-col items-center px-6 pt-10 pb-10 overflow-auto"
          style={{ background: 'radial-gradient(ellipse 40% 25% at 50% 0%, rgba(20,184,166,0.07) 0%, transparent 70%)' }}
        >
          {/* Hero heading */}
          <div className="flex flex-col items-center gap-2 mb-8">
            <h1 className="text-4xl font-light tracking-tight">What would you like to learn?</h1>
            <p className="text-sm text-[color:var(--color-text-tertiary)] text-center max-w-lg">
              Generate an AI course on any topic — step by step lessons with quizzes included.
            </p>
          </div>

          <div className="w-full max-w-2xl">
            <TopicPicker
              suggestedTopics={suggestedTopics}
              isPersonalised={hasPersonalData}
              onCourseCreated={(courseId) => openCourse(courseId)}
              onImportClick={() => setImport(true)}
            />
          </div>
        </div>
      )}

      {tab === 'in_progress' && (
        inProgress.length === 0 ? (
          <div className="py-16 text-center text-sm text-[color:var(--color-text-tertiary)]">
            <GraduationCap size={28} className="mx-auto mb-3 opacity-40" />
            <p>
              No courses in progress.{' '}
              <button className="underline text-white" onClick={() => { document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' }); setTab('discover') }}>
                Discover
              </button>{' '}
              a topic to start one.
            </p>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-3 gap-3">
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
          <div className="p-6 grid grid-cols-3 gap-3">
            {completed.map((c) => <CourseCard key={c.id} course={c} onOpen={openCourse} />)}
          </div>
        )
      )}

      <ImportCourseModal
        open={importOpen}
        onClose={() => setImport(false)}
        onImport={(courseId) => { setTab('in_progress'); openCourse(courseId) }}
      />
    </div>
  )
}
