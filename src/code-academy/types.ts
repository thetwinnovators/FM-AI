export interface TermDefinition {
  term: string
  plainMeaning: string
  example: string
  whyItMatters: string
}

export interface WorkedExample {
  code: string
  language: Language
  explanationSteps: string[]
  expectedOutput?: string
}

export interface CodeExercise {
  id: string
  prompt: string
  starterCode?: string
  successCriteria: string[]
  expectedOutput?: string
  validatorType: 'output' | 'structure' | 'logic' | 'llm'
  hints: string[]
}

export type Language = 'html' | 'css' | 'python'
export type Difficulty = 'beginner' | 'beginner_plus' | 'intermediate'
export type MasteryState = 'not_started' | 'in_progress' | 'passed' | 'review' | 'mastered'

export interface CodeLesson {
  id: string
  language: Language
  concept: string
  title: string
  summary: string
  difficulty: Difficulty
  objectives: string[]
  prerequisites: string[]
  terminology: TermDefinition[]
  workedExample: WorkedExample
  exercises: CodeExercise[]
  commonMistakes: string[]
  generatedAt: string
}

export interface CodeLessonProgress {
  lessonKey: string
  language?: Language
  concept?: string
  attempts: number
  hintsUsed: number
  exercisesCompleted: number
  exercisesTotal: number
  masteryState: MasteryState
  lastAttemptedAt?: string
  completedAt?: string
}
