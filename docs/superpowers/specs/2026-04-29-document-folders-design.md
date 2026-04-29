# Document Folders Design

**Date:** 2026-04-29
**Scope:** Documents page — flat folder organisation with drag-and-drop filing.

---

## Problem

The Documents grid has no organisational structure. As the library grows, users cannot group related documents or browse by project/topic without relying on the existing tag/topic filters alone.

---

## Goal

Allow users to create named flat folders, drag document cards into them, and browse folder contents — while unfiled documents continue to appear alongside folder cards in the root grid.

---

## Out of Scope

- Nested folders (no sub-folders)
- Moving a document into multiple folders (one folder per doc)
- Folder-level topics or tags
- Folder ordering (alphabetical is sufficient for v1)

---

## Data Model

### `folders` (new top-level key in persisted state)

```js
folders: {
  [folderId]: {
    id: string,       // format: folder_<timestamp>_<random4>
    name: string,     // user-supplied, max 80 chars
    createdAt: string // ISO 8601
  }
}
```

Default value: `{}` (empty object).

### `documents[id].folderId` (new field on DocumentMeta)

```js
folderId: string | null   // null = unfiled; string = folder id
```

New documents default to `folderId: null`. Existing documents (no `folderId` key) are treated as unfiled — code checks `!doc.folderId` (covers both `null` and `undefined`).

---

## Store Actions

| Action | Signature | Behaviour |
|---|---|---|
| `addFolder` | `(name: string) → FolderMeta` | Creates folder, persists, returns meta |
| `renameFolder` | `(id, name) → void` | Updates `name` on the folder entry |
| `removeFolder` | `(id) → void` | Atomically deletes folder entry and sets `folderId: null` on all its docs in a single `persist()` call |

`updateDocument(id, { folderId })` handles filing / unfiling — no new action needed.

---

## UI

### Root grid

- **Sort order:** folder cards first (alphabetically by `name`), then unfiled doc cards (by `updatedAt` descending).
- **"New Folder" button** added to the header toolbar (next to Upload and New from text).
  - Clicking calls `addFolder("New Folder")`, stores the returned `id` in a `renamingFolderId` local state, and passes `isRenaming={true}` to that `FolderCard` — which auto-focuses its name input.
- Existing search / topic / source filters apply only to the unfiled doc cards in root view (folder cards are always shown).

### FolderCard component (`src/components/document/FolderCard.jsx`)

Rendered in the same 300 px grid slot as doc cards. Contains:

- Folder icon + **name** (editable inline on rename)
- Doc count chip (`3 docs`)
- Hover actions:
  - **Rename** — controlled via `isRenaming` prop from `Documents.jsx`. Triggered by: (a) clicking the pencil icon, (b) double-clicking the name, or (c) being a freshly-created folder. Swaps the label for an auto-focused `<input>`. Enter/blur commits via `renameFolder` and clears `renamingFolderId`. Escape reverts without saving.
  - **Delete** — trash icon, confirmation required (`ConfirmDialog`). On confirm: `removeFolder(id)` — all contained docs move to unfiled.
- **Drag-over highlight**: when a doc card is dragged over, the folder card shows a coloured border glow.
- `onDragOver(e)` calls `e.preventDefault()` to allow drop.
- `onDrop(e)` reads `e.dataTransfer.getData('docId')` and calls `updateDocument(docId, { folderId: id })`.

### Drag-and-drop (HTML5, no library)

- Doc cards set `draggable="true"`.
- `onDragStart` stores the doc id: `e.dataTransfer.setData('docId', item.id)`.
- `draggedDocId` is tracked in a `useRef` in `Documents.jsx` for any additional drag-state styling needed.
- Drop target is `FolderCard` only (not the grid background).

### Folder view (inside a folder)

Activated by clicking a folder card — sets `activeFolderId` in local `useState` within `Documents.jsx`. No URL change.

- **Breadcrumb** at the top of the content area: `Documents / Folder Name`. Clicking "Documents" clears `activeFolderId`.
- Grid shows only docs whose `folderId === activeFolderId`.
- Existing text / topic / source filters apply within the folder.
- Doc cards show an **"Eject from folder"** button on hover (alongside the existing delete button). Clicking calls `updateDocument(id, { folderId: null })`.
- Drag-and-drop is disabled in folder view (no folder cards to drop onto).
- Pagination works the same as root view (24 per page).

---

## Files Changed

| File | Change |
|---|---|
| `src/store/useStore.js` | Add `folders: {}` to initial state; add `addFolder`, `renameFolder`, `removeFolder` actions; return them from the hook |
| `src/views/Documents.jsx` | New Folder button; `activeFolderId` state; root/folder grid logic; drag start handlers on doc cards; breadcrumb |
| `src/components/document/FolderCard.jsx` | New component — folder card with inline rename, delete, drag-over/drop |

No new routes. No changes to `Document.jsx` (detail view) or `useGraph.js`.
