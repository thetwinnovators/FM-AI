/**
 * Central state machine for Code Academy lesson flow.
 *
 * Stages:
 *   'home'       — showing language/concept picker
 *   'loading'    — generating lesson via Ollama
 *   'lesson'     — reading lesson intro + worked example
 *   'exercising' — user working on current exercise
 *   'feedback'   — fetching AI error explanation
 *   'complete'   — all exercises done
 *
 * Usage:
 *   const academy = useCodeAcademy()
 *   academy.startLesson('python', 'Variables')
 */

import { useCallback, useReducer } from 'react'
import { useStore } from '../store/useStore.js'
import { generateCodeLesson } from './lessonGenerator.js'
import { validateCode } from './validatorEngine.js'
import { explainError } from './feedbackEngine.js'
import { OLLAMA_CONFIG } from '../lib/llm/ollamaConfig.js'

const INITIAL = {
  stage: 'home',
  language: '',
  concept: '',
  lesson: null,
  exerciseIndex: 0,
  userCode: '',
  validationResult: null,
  aiFeedback: null,
  hintsUsed: 0,
  attempts: 0,
  isRunning: false,
  isFetchingFeedback: false,
  error: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'START_LOADING':
      return { ...INITIAL, stage: 'loading', language: action.language, concept: action.concept }
    case 'LESSON_LOADED':
      return {
        ...state,
        stage: 'lesson',
        lesson: action.lesson,
        userCode: action.lesson.exercises[0]?.starterCode || '',
        error: null,
      }
    case 'LOAD_FAILED':
      return { ...state, stage: 'home', error: action.error }
    case 'BEGIN_EXERCISES':
      return { ...state, stage: 'exercising', exerciseIndex: 0, validationResult: null, aiFeedback: null }
    case 'SET_CODE':
      return { ...state, userCode: action.code }
    case 'RUN_START':
      return { ...state, isRunning: true, validationResult: null, aiFeedback: null }
    case 'RUN_DONE':
      return {
        ...state,
        isRunning: false,
        validationResult: action.result,
        attempts: state.attempts + 1,
      }
    case 'FETCH_FEEDBACK_START':
      return { ...state, stage: 'feedback', isFetchingFeedback: true }
    case 'FETCH_FEEDBACK_DONE':
      return { ...state, stage: 'exercising', isFetchingFeedback: false, aiFeedback: action.feedback }
    case 'USE_HINT':
      return { ...state, hintsUsed: state.hintsUsed + 1 }
    case 'RESET_CODE': {
      const starter = state.lesson?.exercises[state.exerciseIndex]?.starterCode || ''
      return { ...state, userCode: starter, validationResult: null, aiFeedback: null }
    }
    case 'NEXT_EXERCISE': {
      const nextIdx = state.exerciseIndex + 1
      const exercises = state.lesson?.exercises || []
      if (nextIdx >= exercises.length) {
        return { ...state, stage: 'complete', validationResult: null, aiFeedback: null }
      }
      return {
        ...state,
        exerciseIndex: nextIdx,
        userCode: exercises[nextIdx]?.starterCode || '',
        validationResult: null,
        aiFeedback: null,
        attempts: 0,
      }
    }
    case 'BACK_TO_HOME':
      return INITIAL
    default:
      return state
  }
}

export function useCodeAcademy() {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  const { addCodeLesson, getCodeLesson, saveCodeProgress } = useStore()

  const startLesson = useCallback(async (language, concept) => {
    if (!language || !concept) return
    if (!OLLAMA_CONFIG.enabled) {
      dispatch({ type: 'LOAD_FAILED', error: 'Ollama is not enabled. Turn it on in Settings to use Code Academy.' })
      return
    }

    dispatch({ type: 'START_LOADING', language, concept })

    const lessonKey = `${language}_${concept.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`

    // Check cache first
    let lesson = getCodeLesson(lessonKey)
    if (!lesson) {
      lesson = await generateCodeLesson(language, concept)
      if (!lesson) {
        dispatch({ type: 'LOAD_FAILED', error: 'Could not generate lesson. Make sure Ollama is running and a model is pulled.' })
        return
      }
      addCodeLesson(lessonKey, lesson)
    }

    // Init progress if not started
    saveCodeProgress(lessonKey, {
      language,
      concept,
      exercisesTotal: lesson.exercises.length,
      masteryState: 'in_progress',
      lastAttemptedAt: new Date().toISOString(),
    })

    dispatch({ type: 'LESSON_LOADED', lesson })
  }, [addCodeLesson, getCodeLesson, saveCodeProgress])

  const beginExercises = useCallback(() => {
    dispatch({ type: 'BEGIN_EXERCISES' })
  }, [])

  const setUserCode = useCallback((code) => {
    dispatch({ type: 'SET_CODE', code })
  }, [])

  const runCode = useCallback(async () => {
    const { lesson, exerciseIndex, userCode, language } = state
    if (!lesson) return
    const exercise = lesson.exercises[exerciseIndex]
    if (!exercise) return

    dispatch({ type: 'RUN_START' })
    const result = await validateCode(userCode, exercise, language)
    dispatch({ type: 'RUN_DONE', result })

    // If failed, fetch AI explanation
    if (!result.passed) {
      dispatch({ type: 'FETCH_FEEDBACK_START' })
      const feedback = await explainError(userCode, exercise, language, result.reason)
      dispatch({ type: 'FETCH_FEEDBACK_DONE', feedback })
    }
  }, [state])

  const useHint = useCallback(() => {
    dispatch({ type: 'USE_HINT' })
  }, [])

  const resetCode = useCallback(() => {
    dispatch({ type: 'RESET_CODE' })
  }, [])

  const nextExercise = useCallback(() => {
    const { lesson, exerciseIndex } = state
    if (!lesson) return
    const lessonKey = lesson.id
    const nextIdx = exerciseIndex + 1
    const isLastExercise = nextIdx >= lesson.exercises.length

    saveCodeProgress(lessonKey, {
      exercisesCompleted: nextIdx,
      masteryState: isLastExercise ? 'passed' : 'in_progress',
      ...(isLastExercise ? { completedAt: new Date().toISOString() } : {}),
    })

    dispatch({ type: 'NEXT_EXERCISE' })
  }, [state, saveCodeProgress])

  const backToHome = useCallback(() => {
    dispatch({ type: 'BACK_TO_HOME' })
  }, [])

  const currentExercise = state.lesson?.exercises[state.exerciseIndex] || null
  const currentHints = currentExercise?.hints || []
  const visibleHints = currentHints.slice(0, state.hintsUsed)
  const hasMoreHints = state.hintsUsed < currentHints.length

  return {
    ...state,
    currentExercise,
    visibleHints,
    hasMoreHints,
    startLesson,
    beginExercises,
    setUserCode,
    runCode,
    useHint,
    resetCode,
    nextExercise,
    backToHome,
  }
}
