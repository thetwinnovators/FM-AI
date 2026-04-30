# FlowMap Research Multi-Canvas Feature Prompt

Use the prompt below in Claude Code to build a multi-project Research workspace for FlowMap.

```text
You are helping me extend FlowMap with a new Research feature.

Goal:
Implement a multi-project Research workspace system, where users can create multiple research canvases/projects and each canvas is saved separately.

Important constraints:
- No Supabase.
- No realtime collaboration.
- No auth implementation required; assume a userId is already available.
- Use React + TypeScript + Tailwind.
- Persist data through clean storage interfaces with localStorage or in-memory stubs for now, but structure the code so I can later swap in my own backend/database.

Product requirements:

1) Research Home Page
- Add a top-level Research page/view.
- On first visit, if the user has no canvases, show a strong empty state:
  - title: "Create a Research Canvas"
  - supporting text explaining that canvases can be used for organizing links, notes, videos, images, and ideas
  - primary CTA button: "Create Research Canvas"
- Once canvases exist, show them in a grid or list.
- Each canvas card should show:
  - title
  - created date or last updated date
  - optional small preview/thumbnail if easy to support
  - actions menu with Rename and Delete

2) Research Canvas / Project Model
Create TypeScript interfaces like:

interface ResearchCanvas {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  thumbnailUrl?: string | null;
}

type CardType = "web-article" | "video" | "sticky-note" | "image";

interface ResearchCard {
  id: string;
  canvasId: string;
  type: CardType;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  data: {
    url?: string;
    title?: string;
    description?: string;
    faviconUrl?: string;
    imageUrl?: string;
    videoPlatform?: "youtube" | "vimeo" | "other";
    videoId?: string;
    text?: string;
    color?: string;
  };
}

3) Storage Interfaces
Implement storage abstractions for both canvas metadata and cards:

interface ResearchStorage {
  listCanvases(userId: string): Promise<ResearchCanvas[]>;
  createCanvas(userId: string, input: { title?: string }): Promise<ResearchCanvas>;
  updateCanvas(canvasId: string, patch: Partial<ResearchCanvas>): Promise<ResearchCanvas>;
  deleteCanvas(canvasId: string): Promise<void>;
  getCanvas(canvasId: string): Promise<ResearchCanvas | null>;

  listCards(canvasId: string): Promise<ResearchCard[]>;
  saveCards(canvasId: string, cards: ResearchCard[]): Promise<void>;
}

Requirements:
- Provide a localStorage-backed implementation for now.
- Keep the storage code isolated so it can later be replaced by FlowMap’s own backend.
- Deleting a canvas must also delete all cards for that canvas.

4) User Flows
Implement these flows:

A. First visit:
- If no canvases exist, show empty state and CTA.

B. Create canvas:
- Clicking "Create Research Canvas" creates a new canvas with a default title like:
  - "Untitled Research"
  - or "Research Canvas 1", "Research Canvas 2", etc.
- After creation, navigate directly into that canvas.

C. Open canvas:
- Clicking a canvas card opens that canvas workspace.

D. Rename canvas:
- User can rename from:
  - canvas card menu on the Research home page
  - optionally in the canvas header while inside the canvas
- Persist rename immediately.

E. Delete canvas:
- User can delete from the canvas card menu.
- Show a confirmation dialog before delete.
- After delete, remove it from storage and UI.

F. Multiple canvases:
- User can create as many research canvases/projects as they want.
- Each must load and save independently.

5) Research Canvas Page
Inside a single canvas/project view:
- Reuse the smart canvas concept:
  - pannable / zoomable canvas
  - smart cards (web article, video, sticky note, image)
  - smart paste detection
  - drag and drop with grid snapping
- The canvas page should load cards only for the active canvasId.
- Saving cards should persist only to that canvas.

6) Suggested Component Structure
Provide code organized roughly like this:

src/research/
  pages/
    ResearchHomePage.tsx
    ResearchCanvasPage.tsx
  components/
    ResearchEmptyState.tsx
    ResearchCanvasCard.tsx
    ResearchCanvasGrid.tsx
    ResearchCanvasHeader.tsx
    ResearchToolbar.tsx
    ResearchCanvas.tsx
    cards/
      ResearchCardWrapper.tsx
      WebArticleCard.tsx
      VideoCard.tsx
      StickyNoteCard.tsx
      ImageCard.tsx
  hooks/
    useResearchCanvases.ts
    useResearchCanvasState.ts
    useSmartPaste.ts
  storage/
    researchStorage.ts
    localResearchStorage.ts
  utils/
    grid.ts
    urlClassifier.ts
    metadata.ts
    ids.ts

7) Routing / Navigation
Assume FlowMap has app routing.
Use a route shape like:
- /research
- /research/:canvasId

The implementation should:
- show the canvases index on /research
- show a single canvas workspace on /research/:canvasId

If you don’t know my exact router, keep the code router-agnostic but show clear examples for navigation callbacks.

8) UX details
- Use a polished dark UI that fits FlowMap.
- Empty state should feel intentional and premium, not generic.
- Canvas cards on the Research home page should have good hover states and a clear primary action.
- Include a “New Research Canvas” button on the Research page once canvases already exist.
- In the canvas view, include breadcrumbs or a back button to return to the canvases index.

9) Output format
Provide the implementation in labeled code sections by filename.
Focus on production-quality React + TypeScript code with comments only where useful.
Do not use Supabase anywhere.
Use localStorage for now, but isolate persistence cleanly so I can replace it later with my own backend.
```
