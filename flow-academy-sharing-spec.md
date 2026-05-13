# Flow Academy Sharing System Spec

## Objective

Build a sharing system for **Flow Academy** that works even though FlowMap is local and not online. The system should let a user share a course with a friend by exporting either:

- a **branded Flow Academy HTML file** that preserves the same Flow Academy UI and course experience
- an **importable course package** that another FlowMap user can load into their own local app

This feature must respect FlowMap’s local-first architecture and visual identity. Because FlowMap is a personal local app with a dark glassmorphic interface, the exported course should not look like a plain document. It should feel like a portable Flow Academy experience.[cite:642][cite:1573][web:1582][web:1588]

## Core product principle

The exported HTML should not be treated as a static document. It should be treated as a **self-contained portable mini-app** for one course. Self-contained HTML files can embed CSS, JavaScript, and structured data, which makes them suitable for preserving branded UI and lightweight interactivity offline.[web:1582][web:1588][web:1586]

That means the exported HTML should:

- open in a browser with the same Flow Academy look and feel
- preserve the course shell and lesson layout
- preserve quiz interactions
- feel visually consistent with the in-app Flow Academy experience
- work without any backend or live Flow AI connection [cite:642][web:1582]

## Sharing modes

Flow Academy should support three export modes.

| Export mode | Purpose | Best for |
|---|---|---|
| Flow Academy Page (`.html`) | Branded self-contained course viewer with interactivity | Sharing with friends for viewing and quiz-taking |
| Flow Academy Package (`.json`) | Importable structured course data | Sharing between FlowMap users |
| Both | Viewer + import package together | Power users and full-fidelity sharing |

This gives users a beautiful share format and a durable data-transfer format at the same time.[web:1562][web:1582]

## UX language

Avoid technical labels like “export HTML” and “export JSON” as the primary user-facing actions. The UI should use plain language.

Recommended labels:

- **Share as Flow Academy page**
- **Share as Flow Academy package**
- **Share both**
- **Import shared course**
- **Include my progress**
- **Start fresh on import**

This keeps the feature understandable for normal users while still supporting robust data portability.

## Share flow

### Export flow

1. User opens a course in Flow Academy.
2. User clicks **Share Course**.
3. Modal appears with export choices:
   - Share as Flow Academy page
   - Share as Flow Academy package
   - Share both
4. User chooses whether to include progress.
5. FlowMap generates the selected export locally.
6. User saves or sends the file to a friend via email, AirDrop, LocalSend, USB, or another file-sharing method.[web:1567][web:1564]

### Import flow

1. User opens Flow Academy.
2. User clicks **Import Shared Course**.
3. User selects a `.json` package file.
4. FlowMap validates the schema and shows a preview.
5. User chooses whether to import with sender progress or start fresh.
6. Course appears under imported or in-progress courses.

## HTML export goals

The HTML export must preserve the **Flow Academy UX format**, not just the lesson text. That means the exported file should look and behave like a branded course view from inside FlowMap.[cite:642]

### Preserve these UI layers

- dark glassmorphic theme
- Flow Academy typography and spacing rhythm
- course title and summary shell
- lesson navigation structure
- card surfaces and section framing
- objectives and vocabulary blocks
- quiz question cards
- results state styling
- progress indicators
- completion or lesson status chips [cite:642][cite:1573]

### Do not try to preserve these app-only layers

- live Flow AI generation
- global FlowMap navigation shell
- user memory retrieval
- backend-dependent services
- cloud sync or live collaboration

The exported page should feel like a **course snapshot with interactivity**, not the full FlowMap application.[cite:642][cite:855]

## Architectural recommendation

Do not export the live DOM directly from the current page. Instead, build a dedicated export renderer.

Recommended approach:

```ts
renderFlowAcademyExportHTML(course, options)
```

This renderer should:

- receive structured course data
- apply Flow Academy design tokens
- inline the required CSS
- inline lightweight JavaScript for interactivity
- embed the course data as JSON inside the HTML
- output one self-contained `.html` file [web:1582][web:1588][web:1586]

This approach is more stable, easier to evolve, and better for preserving visual consistency.

## HTML export structure

The exported HTML should be a single self-contained file.

Recommended structure:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Flow Academy — Course Title</title>
    <style>
      /* Inlined Flow Academy export CSS */
    </style>
  </head>
  <body>
    <div id="app"></div>

    <script type="application/json" id="course-data">
      { ...courseJson }
    </script>

    <script>
      // Inlined export viewer logic
    </script>
  </body>
</html>
```

This ensures the file can be opened locally in a browser without needing external assets or a server.[web:1582][web:1588]

## Visual design requirements

The exported HTML should look unmistakably like Flow Academy.

### Theme requirements

- dark mode default
- glassmorphic surface treatment
- blurred or frosted panel styling where appropriate
- subtle borders and layer depth
- consistent spacing tokens
- branded heading hierarchy
- elegant card-based lesson framing [cite:642]

### Layout requirements

- course header at top
- lesson navigation rail or top module strip
- main lesson content panel
- objectives and vocabulary summary blocks
- quiz block at lesson end
- results panel after submission

### Status markers

The user strongly values meaningful UI hotspots and status markers, so lesson states and completion markers should communicate value clearly rather than acting as decorative pills.[cite:1573]

Status markers should show:

- lesson locked
- lesson unlocked
- lesson passed
- quiz ready
- quiz passed
- course completed

## HTML export behavior

The Flow Academy page export should support lightweight interactivity inside the file itself.

### Required behaviors

- open to syllabus view or first lesson
- navigate between lessons
- expand lesson sections
- take multiple choice quizzes
- show score after submission
- show pass/fail state
- reveal next lesson only if progression mode is enabled

### Optional behaviors

- remember temporary progress during the same open session
- allow review mode
- toggle between syllabus and lesson view

### Avoid

- browser storage dependencies that may fail in constrained environments
- server fetches
- external API calls

The file should work offline as a standalone experience.[web:1558][web:1582]

## Export modes inside HTML

The branded HTML export should support two viewer modes.

### 1. Read-only mode

Best for simple sharing.

Behavior:

- all lessons visible
- quizzes visible but optional
- no gating required
- completion status shown as informational only

### 2. Guided mode

Best for a course-like experience.

Behavior:

- lessons unlock in sequence
- quizzes required to proceed
- 70 percent pass threshold
- local in-file progress only for that session

This gives the sender a choice between “share to read” and “share to experience.”

## JSON package role

The JSON package should remain the real interchange format for FlowMap-to-FlowMap sharing.[web:1562]

The JSON should contain:

- course metadata
- lessons
- objectives
- vocabulary
- quiz data
- optional sender progress
- export version
- origin metadata

Suggested schema:

```ts
interface SharedCoursePackage {
  version: string
  exportedAt: string
  exportType: 'flow-academy-package'
  includeProgress: boolean
  course: LearningCourse
  progress?: CourseProgress
}
```

The HTML export may embed this same data internally, but JSON should still exist as the clean source format for import workflows.

## Source-of-truth strategy

Use this hierarchy:

1. course data model inside FlowMap
2. JSON package export as canonical portable format
3. HTML export rendered from the same structured data

This avoids having two incompatible export systems.

## Course export renderer modules

Suggested implementation structure:

```txt
src/flow-academy-sharing/
  exportTypes.ts
  buildCoursePackage.ts
  renderFlowAcademyExportHTML.ts
  exportThemeTokens.ts
  exportQuizRuntime.ts
  importSharedCourse.ts
  validateSharedCourse.ts
  components/
    ShareCourseModal.tsx
    ExportModeCard.tsx
    ImportCourseModal.tsx
```

## Export options model

```ts
interface ShareCourseOptions {
  mode: 'html' | 'json' | 'both'
  includeProgress: boolean
  htmlViewerMode: 'read_only' | 'guided'
  includeAnswerExplanations: boolean
}
```

## Suggested HTML viewer shell

The exported Flow Academy page should have the following structure:

- top header with Flow Academy branding and course title
- summary card with topic, difficulty, lesson count, estimated time
- lesson progress rail
- lesson content card
- vocabulary/objective side panels or stacked support cards
- quiz section card
- results card
- completion card when done

This should feel like a polished mini-product, not a generated static artifact.

## File generation rules

When generating the HTML export:

- inline all required CSS
- inline only lightweight JS needed for course behavior
- embed course JSON inside the file
- avoid remote font dependencies when possible, or provide robust fallbacks
- do not assume internet access
- keep the file portable and readable in normal browsers [web:1582][web:1588]

## Import UI behavior

The import side should be simple.

### Import steps

- choose package file
- validate version
- preview title, summary, lesson count, and sender name if available
- choose start fresh or keep progress
- import into Flow Academy

### Imported course placement

Imported courses should appear in one of these ways:

- in a dedicated **Shared Courses** section, or
- inside **In Progress** with a small imported badge

## Security and trust considerations

Because the app is local and files may come from other people, imported packages should be validated before loading.

Validate:

- schema shape
- export version
- safe string lengths
- allowed field types
- quiz data integrity

Do not execute arbitrary code from imported packages. The package format should be data only.

## Recommended MVP

Build the first version with:

- Share Course modal
- HTML export with branded Flow Academy UI
- JSON package export
- Import shared course flow
- optional include-progress toggle
- guided versus read-only HTML mode

## Future enhancements

Later versions can add:

- sender info card
- custom cover art for shared courses
- printable certificate export
- “Open in FlowMap” deep-link helper
- local QR handoff to nearby device
- share analytics inside the sender’s local app

## Success criteria

This feature is successful when:

- the exported HTML looks and feels like Flow Academy, not a plain web page
- a friend can open the file locally and understand the course immediately
- quizzes still work inside the HTML export
- another FlowMap user can import the package cleanly
- export/import remains local-first and backend-free
- the product identity survives outside the app shell [cite:642][cite:1573][web:1582]

## Product positioning statement

Flow Academy sharing should let a user package a course as either a beautiful portable learning page or a true importable course package, while preserving the Flow Academy visual identity and local-first product model.[cite:642]
