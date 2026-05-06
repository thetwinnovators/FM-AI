# Flow Academy Feature Spec

## Objective

Build a new FlowMap section called **Flow Academy** where Flow AI can generate step-by-step learning modules on any topic the user wants to learn. The goal is not to create shallow crash courses, but beginner-friendly learning paths that build real understanding through scaffolded lessons, simple explanations, mastery quizzes, and progress tracking.[cite:642][cite:855][cite:1093][cite:1530][cite:1536]

The feature should teach as if the learner is in middle school and is encountering the subject for the first time. Lessons should use plain language, define unfamiliar terms, introduce ideas in small chunks, and include examples that make abstract ideas easier to understand.[cite:1530][cite:1533][cite:1536]

## Product concept

Flow Academy should feel like a patient AI teacher inside FlowMap rather than a one-off content generator. The system should turn a topic into a structured learning journey with a syllabus, lessons, quizzes, retry support, and completed-course tracking.[cite:642][cite:1534][cite:1537]

The feature should support:

- topic selection from suggested learning topics
- manual topic entry
- AI-generated syllabus with summary
- lesson-by-lesson progression
- optional supporting video links when helpful
- end-of-lesson multiple choice quizzes
- a 70 percent mastery threshold before unlocking the next lesson
- retry flow for failed quizzes
- completed-course saving and tracking [cite:1534][cite:1525][cite:1527]

## Core principle

This should be built as a **mastery-based learning system**, not just a content screen. Mastery-based learning models recommend breaking learning into clear objectives, checking understanding frequently, and only moving learners forward after they demonstrate understanding.[cite:1525][cite:1527][cite:1534][cite:1537]

That means each lesson must have:

- clear learning objectives
- a simple explanation
- examples and recap
- a quiz tied directly to the lesson goals
- feedback on missed answers
- a retry loop if the learner does not meet the passing threshold [cite:1525][cite:1537]

## User flow

### Entry flow

1. User opens **Flow Academy**.
2. User sees suggested topics and a field to enter any topic manually.
3. User selects a topic or types one.
4. User clicks **Generate Learning Path**.
5. Flow AI generates a beginner-friendly course syllabus with summary.
6. User reviews the syllabus and starts Lesson 1.

### Learning flow

1. User opens the first lesson.
2. Flow AI presents the lesson in beginner-friendly language.
3. If useful, Flow AI shows an optional video resource link.
4. User reaches the end-of-lesson quiz.
5. User answers 6 to 10 multiple-choice questions.
6. If score is 70 percent or higher, the next lesson unlocks.
7. If score is below 70 percent, the learner gets a recap and can retry.

### Completion flow

1. User passes all lesson quizzes.
2. Course is marked completed.
3. Completed course is saved under **Completed Courses** in Flow Academy.
4. User can reopen completed courses later for review.

## Information architecture

Flow Academy should use a simple structure that feels obvious and low-stress.

### Top-level tabs

- **Discover**
  - Suggested topics
  - Manual topic entry
  - Generated syllabus preview
- **In Progress**
  - Current active courses
  - Current lesson and progress
- **Completed**
  - Finished courses
  - Completion dates
  - Last quiz score or completion summary

This structure is more intuitive than putting everything into one long AI thread. It makes the learning state visible and gives the user a clear mental model of where they are.[cite:1524][cite:642]

## Course structure

Each generated course should have a clear hierarchy.

```ts
interface LearningCourse {
  id: string
  title: string
  topic: string
  difficulty: 'beginner'
  summary: string
  estimatedDurationMinutes: number
  lessonCount: number
  objectives: string[]
  keyVocabulary: string[]
  status: 'draft' | 'in_progress' | 'completed'
  createdAt: string
  completedAt?: string
  lessons: LearningLesson[]
}

interface LearningLesson {
  id: string
  title: string
  order: number
  summary: string
  objectives: string[]
  explanation: string
  examples: string[]
  recap: string
  videoLinks?: VideoResource[]
  quiz: LessonQuiz
  status: 'locked' | 'unlocked' | 'passed'
}

interface VideoResource {
  title: string
  url: string
  reason: string
}

interface LessonQuiz {
  passingScore: number
  questions: QuizQuestion[]
}

interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}
```

## Learning design rules

Flow AI must follow strict educational generation rules.

### Tone and explanation style

- Explain as if the learner is in middle school.
- Assume no prior knowledge.
- Define all jargon in plain language.
- Use one main idea at a time.
- Use real-world examples and analogies.
- Avoid dense paragraphs and academic wording.
- End each lesson with a short recap.

These rules align with scaffolding guidance that recommends chunking information, introducing vocabulary carefully, and supporting comprehension with guided examples.[cite:1530][cite:1533][cite:1536]

### Lesson design rules

Each lesson should:

- teach one core concept or a small related cluster
- begin with “what you will learn”
- explain the concept simply
- give at least 2 practical examples
- include a short recap
- generate quiz questions only from material actually taught

### Quiz design rules

Each lesson quiz should:

- include 6 to 10 multiple-choice questions
- map directly to the lesson objectives
- include explanations for correct answers
- include explanations for wrong answers after submission
- require at least 70 percent to pass
- generate a retry version when failed

Mastery learning works best when quizzes are objective-linked and feedback helps learners understand mistakes instead of just blocking progress.[cite:1525][cite:1527][cite:1537]

## Retry and mastery flow

The retry experience should feel encouraging, not punishing.

If a user scores under 70 percent:

- show the score
- show which concepts were missed
- show a short “review these ideas” recap
- allow the learner to retry the lesson quiz
- optionally regenerate some questions while preserving lesson alignment

Suggested retry message:

> You are close. Review these ideas first, then try again.

This keeps Flow Academy supportive and aligned with mastery-based progression rather than making the learner feel stuck or judged.[cite:1525][cite:1534]

## Video resource logic

Video links should be optional support, not the foundation of the lesson. The written lesson must stand on its own.

Only show a video resource when:

- the topic is visual or spatial
- the concept is easier to understand with demonstration
- there is a strong beginner-friendly explainer available

Video cards should show:

- title
- why this video helps
- external link

The UI should label these as **Optional video explanation** rather than required content.

## Course generation flow

Suggested generation pipeline:

1. User chooses or enters topic.
2. Flow AI analyzes the topic as a beginner learning request.
3. Flow AI generates a syllabus with:
   - course title
   - short summary
   - lesson list
   - objectives
   - key vocabulary
   - estimated course duration
4. User approves or starts the course.
5. Lessons unlock in sequence.
6. Quiz results update progress.
7. Course completes and moves to Completed tab.

## UI components

Suggested component structure:

```txt
src/flow-academy/
  types.ts
  courseGenerator.ts
  quizEngine.ts
  progressEngine.ts
  videoResolver.ts
  useFlowAcademy.ts
  components/
    FlowAcademyPage.tsx
    TopicPicker.tsx
    TopicSuggestions.tsx
    CourseCard.tsx
    SyllabusView.tsx
    LessonView.tsx
    LessonObjectives.tsx
    VocabularyStrip.tsx
    VideoResources.tsx
    QuizView.tsx
    QuizQuestionCard.tsx
    QuizResults.tsx
    RetryRecap.tsx
    ProgressSidebar.tsx
    CompletedCourseCard.tsx
```

## Page layout

### Flow Academy page

The main Flow Academy page should include:

- page title and short description
- topic suggestion grid
- manual topic input
- Generate Learning Path button
- In Progress section
- Completed Courses section

### Course view layout

Inside an active course, use a clear course structure view.

Recommended layout:

- **Left rail or top progress bar**
  - course title
  - lesson list
  - locked/unlocked/passed state
- **Main content area**
  - syllabus or lesson content
  - video resources
  - quiz state
- **Right rail or lower panel**
  - objectives
  - vocabulary
  - progress

## Progress logic

The progress system should be explicit and persistent.

Track these states:

- course created
- syllabus generated
- lesson unlocked
- lesson viewed
- quiz attempted
- lesson passed
- course completed

Store progress fields such as:

```ts
interface CourseProgress {
  courseId: string
  completedLessonIds: string[]
  unlockedLessonIds: string[]
  quizAttempts: {
    lessonId: string
    score: number
    attemptedAt: string
  }[]
  percentComplete: number
  status: 'in_progress' | 'completed'
}
```

Completed courses should be visible in a dedicated **Completed** tab, not buried in course history.

## Suggested topic generation

Flow Academy should support both manual entry and suggested learning topics.

Suggested topics can be sourced from:

- popular beginner subjects
- saved interests inside FlowMap
- recent user searches
- project-related knowledge gaps

Because FlowMap already stores memory and user/workspace behavior patterns, suggested learning topics can eventually become personalized to what the user explores most often.[cite:855][cite:642]

## Example lesson output rules

A generated lesson should look something like this structurally:

- Lesson title
- What you will learn
- Simple explanation
- Example 1
- Example 2
- Key vocabulary
- Quick recap
- Optional video explanation
- Quiz

The lesson body should avoid long walls of text. Use short sections, simple subheads, and visually distinct blocks.

## Quiz result UI

After submission, the results state should show:

- score percentage
- pass/fail status
- number correct out of total
- explanations for missed questions
- next action button

If passed:

- show **Continue to next lesson**

If failed:

- show **Review and retry**

## Completion state

When a course is completed:

- mark the course as completed
- save completion date
- move it to Completed Courses
- allow reopening syllabus and lessons
- show a completion summary

Optional future enhancement:

- completion badge
- certificate-style summary
- “teach me again quickly” review mode

## Guardrails for Flow AI

To keep quality high, the AI course generator should follow these guardrails:

- Do not generate advanced material unless it was requested.
- Do not assume prior subject knowledge.
- Do not use jargon without defining it.
- Do not create quiz questions about facts not taught in the lesson.
- Do not make the course too short for complex topics.
- Do not overload lessons with too many concepts at once.
- Do not require external videos to understand the lesson.

## Recommended MVP scope

The first version should stay focused.

### MVP features

- topic selection and manual input
- AI-generated syllabus
- lesson-by-lesson progression
- beginner-friendly lesson generation
- 6 to 10 question multiple-choice quizzes
- 70 percent pass requirement
- retry flow with recap
- in-progress and completed course tracking

### Defer to later versions

- adaptive difficulty
- flashcards
- spaced repetition review reminders
- note-taking inside lessons
- voice mode
- printable certificates
- parent/teacher dashboards

## Success criteria

Flow Academy is successful when:

- users can generate a course on almost any topic
- lessons feel understandable to true beginners
- quizzes accurately test what was taught
- learners can retry and eventually pass without confusion
- progress is visible and motivating
- completed courses are clearly saved and easy to revisit

## Build recommendation

Build this feature as a structured learning product, not a chat feature with education styling. The syllabus, lesson progression, quiz logic, and progress tracking should each have their own state model and UI surfaces.[cite:642][cite:1534][cite:1537]

The strongest version of Flow Academy is a patient, mastery-based AI teacher inside FlowMap that helps the user actually understand a topic over time rather than consume one long generated explanation.[cite:1530][cite:1536][cite:1537]
