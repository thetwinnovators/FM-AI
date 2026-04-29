# Document Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add flat folder organisation to the Documents page — create folders, drag documents into them, browse folder contents, eject documents back to unfiled.

**Architecture:** Folders are stored as a top-level `folders` map in the existing persisted state. Documents get a `folderId: string | null` field. The Documents grid renders folder cards before unfiled doc cards; clicking a folder switches to a filtered folder view via local `activeFolderId` state. Drag-and-drop uses the HTML5 drag API with no library.

**Tech Stack:** React (useState, useRef, useMemo), HTML5 drag-and-drop API, existing `useStore` / `persist` pattern, Vitest + @testing-library/react.

---

### Task 1: Store — folder state + actions

**Files:**
- Modify: `src/store/useStore.js`
- Modify: `src/store/useStore.test.js`

- [ ] **Step 1: Write the failing tests**

Append this `describe` block to the end of `src/store/useStore.test.js` (before the final closing brace if any, or just at the end of the file):

```js
describe('folder actions', () => {
  beforeEach(() => { localStorage.clear() })

  it('addFolder creates a folder and returns its meta', () => {
    const { result } = renderHook(() => useStore())
    let folder
    act(() => { folder = result.current.addFolder('Research') })
    expect(folder.name).toBe('Research')
    expect(folder.id).toMatch(/^folder_/)
    expect(folder.createdAt).toBeTruthy()
    expect(result.current.folders[folder.id]).toEqual(folder)
  })

  it('addFolder trims and caps name at 80 chars', () => {
    const { result } = renderHook(() => useStore())
    let folder
    act(() => { folder = result.current.addFolder('  ' + 'A'.repeat(100) + '  ') })
    expect(folder.name).toBe('A'.repeat(80))
  })

  it('addFolder with blank name falls back to "New Folder"', () => {
    const { result } = renderHook(() => useStore())
    let folder
    act(() => { folder = result.current.addFolder('   ') })
    expect(folder.name).toBe('New Folder')
  })

  it('renameFolder updates the folder name', () => {
    const { result } = renderHook(() => useStore())
    let folder
    act(() => { folder = result.current.addFolder('Old') })
    act(() => result.current.renameFolder(folder.id, 'New'))
    expect(result.current.folders[folder.id].name).toBe('New')
  })

  it('renameFolder is a no-op for unknown id', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.renameFolder('folder_nope', 'X'))
    // no throw
  })

  it('removeFolder deletes folder and nulls folderId on its docs', () => {
    const { result } = renderHook(() => useStore())
    let folder, doc
    act(() => { folder = result.current.addFolder('F') })
    act(() => { doc = result.current.addDocument({ title: 'D', plainText: 'hello', folderId: folder.id }) })
    expect(result.current.documents[doc.id].folderId).toBe(folder.id)
    act(() => result.current.removeFolder(folder.id))
    expect(result.current.folders[folder.id]).toBeUndefined()
    expect(result.current.documents[doc.id].folderId).toBeNull()
  })

  it('removeFolder leaves docs from other folders untouched', () => {
    const { result } = renderHook(() => useStore())
    let f1, f2, d1, d2
    act(() => { f1 = result.current.addFolder('F1') })
    act(() => { f2 = result.current.addFolder('F2') })
    act(() => { d1 = result.current.addDocument({ title: 'A', plainText: 'a', folderId: f1.id }) })
    act(() => { d2 = result.current.addDocument({ title: 'B', plainText: 'b', folderId: f2.id }) })
    act(() => result.current.removeFolder(f1.id))
    expect(result.current.documents[d1.id].folderId).toBeNull()
    expect(result.current.documents[d2.id].folderId).toBe(f2.id)
  })

  it('updateDocument assigns and clears folderId', () => {
    const { result } = renderHook(() => useStore())
    let folder, doc
    act(() => { folder = result.current.addFolder('F') })
    act(() => { doc = result.current.addDocument({ title: 'D', plainText: 'hello' }) })
    expect(result.current.documents[doc.id].folderId).toBeNull()
    act(() => result.current.updateDocument(doc.id, { folderId: folder.id }))
    expect(result.current.documents[doc.id].folderId).toBe(folder.id)
    act(() => result.current.updateDocument(doc.id, { folderId: null }))
    expect(result.current.documents[doc.id].folderId).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --run src/store/useStore.test.js
```

Expected: FAIL — `result.current.addFolder is not a function` (or similar) — confirming tests drive the implementation.

- [ ] **Step 3: Add `folders: {}` to the EMPTY state**

In `src/store/useStore.js`, find the `const EMPTY = {` block (around line 9). Add `folders: {}` after `userNotes: {}`:

```js
const EMPTY = {
  saves: {},
  follows: {},
  dismisses: {},
  collections: {},
  views: {},
  searches: {},
  memoryEntries: {},
  memoryDismisses: {},
  userTopics: {},
  manualContent: {},
  documents: {},
  documentContents: {},
  conversations: {},
  chatMessages: {},
  userNotes: {},
  folders: {},
}
```

- [ ] **Step 4: Add `folderId` to `addDocument`**

Find the `addDocument` callback (around line 448). Inside the `meta` object literal, add `folderId` after `wordCount`:

```js
const meta = {
  id,
  title: String(data.title || '').trim() || (plainText.split('\n')[0] || 'Untitled').slice(0, 80),
  sourceType: data.sourceType || 'pasted',
  fileName: data.fileName || null,
  mimeType: data.mimeType || null,
  url: data.url || null,
  createdAt: now,
  updatedAt: now,
  topics: Array.isArray(data.topics) ? data.topics : [],
  tags: Array.isArray(data.tags) ? data.tags : [],
  summary: null,
  excerpt: plainText.slice(0, 240) || null,
  wordCount,
  folderId: data.folderId || null,
}
```

- [ ] **Step 5: Add `addFolder`, `renameFolder`, `removeFolder` actions**

Add these three callbacks after the `removeDocument` callback (around line 506), before `const documentById`:

```js
const addFolder = useCallback((name) => {
  const cur = memoryState
  const id = `folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const trimmed = String(name || '').trim().slice(0, 80) || 'New Folder'
  const folder = { id, name: trimmed, createdAt: new Date().toISOString() }
  persist({ ...cur, folders: { ...(cur.folders || {}), [id]: folder } })
  return folder
}, [])

const renameFolder = useCallback((id, name) => {
  const cur = memoryState
  const folder = (cur.folders || {})[id]
  if (!folder) return
  const trimmed = String(name || '').trim().slice(0, 80) || 'New Folder'
  persist({ ...cur, folders: { ...cur.folders, [id]: { ...folder, name: trimmed } } })
}, [])

const removeFolder = useCallback((id) => {
  const cur = memoryState
  const folders = { ...(cur.folders || {}) }
  delete folders[id]
  const documents = {}
  for (const [docId, doc] of Object.entries(cur.documents || {})) {
    documents[docId] = doc.folderId === id ? { ...doc, folderId: null } : doc
  }
  persist({ ...cur, folders, documents })
}, [])
```

- [ ] **Step 6: Expose the new actions from the hook return**

Find the `return {` block at the end of `useStore` (around line 651). Add `addFolder, renameFolder, removeFolder` to the return — place them alongside the other document actions:

```js
return {
  ...state,
  toggleSave, toggleFollow, dismiss,
  recordView, recordSearch,
  addMemory, updateMemory, deleteMemory, isMemoryDismissed,
  notesFor, addNote, removeNote,
  addUserTopic, removeUserTopic, updateUserTopic, userTopicBySlug,
  addManualContent, removeManualContent, manualContentForTopic, manualContentByUrl,
  addDocument, updateDocument, removeDocument, documentById, documentContentById, documentsForTopic, requestSummary,
  addFolder, renameFolder, removeFolder,
  createConversation, updateConversation, deleteConversation, addChatMessage,
  conversationById, chatMessagesFor, allConversationsSorted,
  isSaved, isFollowing, isDismissed, viewCount, recentSearches,
}
```

- [ ] **Step 7: Run tests to verify they pass**

```
npm test -- --run src/store/useStore.test.js
```

Expected: all tests PASS (including the new folder describe block).

- [ ] **Step 8: Run the full suite to check for regressions**

```
npm test -- --run
```

Expected: all 97+ tests PASS.

- [ ] **Step 9: Commit**

```
git add src/store/useStore.js src/store/useStore.test.js
git commit -m "feat(store): add folder state + addFolder/renameFolder/removeFolder actions"
```

---

### Task 2: FolderCard component

**Files:**
- Create: `src/components/document/FolderCard.jsx`

- [ ] **Step 1: Create the component**

Create `src/components/document/FolderCard.jsx` with this exact content:

```jsx
import { useEffect, useRef, useState } from 'react'
import { Folder, Pencil, Trash2 } from 'lucide-react'

export default function FolderCard({
  folder,
  docCount,
  isRenaming,
  onRenameStart,
  onRenameCommit,
  onDelete,
  onClick,
  onDragOver,
  onDrop,
}) {
  const [draft, setDraft] = useState(folder.name)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isRenaming) {
      setDraft(folder.name)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [isRenaming, folder.name])

  function commit() {
    const name = draft.trim() || folder.name
    onRenameCommit(folder.id, name)
  }

  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    if (e.key === 'Escape') { setDraft(folder.name); onRenameCommit(null, null) }
  }

  function handleDragOver(e) {
    setIsDragOver(true)
    onDragOver(e)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e) {
    setIsDragOver(false)
    onDrop(e)
  }

  return (
    <article
      className={`rounded-lg overflow-hidden border transition-colors flex flex-col group shadow-sm relative ${
        isDragOver
          ? 'border-[color:var(--color-topic)] ring-2 ring-[color:var(--color-topic)]/40 bg-slate-50'
          : 'border-black/10 bg-slate-100 hover:bg-slate-200'
      }`}
      style={{ cursor: isRenaming ? 'default' : 'pointer' }}
      onClick={!isRenaming ? onClick : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[color:var(--color-topic)]/15 flex items-center justify-center flex-shrink-0">
            <Folder size={18} className="text-[color:var(--color-topic)]" />
          </div>
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={onKey}
                onClick={(e) => e.stopPropagation()}
                className="text-[15px] font-semibold leading-snug w-full bg-transparent border-b border-[color:var(--color-topic)] outline-none text-gray-900"
              />
            ) : (
              <h3
                className="text-[15px] font-semibold leading-snug line-clamp-2 text-gray-900"
                onDoubleClick={(e) => { e.stopPropagation(); onRenameStart(folder.id) }}
              >
                {folder.name}
              </h3>
            )}
            <p className="text-[11px] text-gray-500 mt-1">
              {docCount} doc{docCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onRenameStart(folder.id) }}
          className="p-1 rounded hover:bg-slate-300 text-gray-500 hover:text-gray-700"
          title="Rename folder"
          aria-label="Rename folder"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(folder) }}
          className="p-1 rounded hover:bg-rose-100 text-rose-500 hover:text-rose-700"
          title="Delete folder"
          aria-label="Delete folder"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Run the test suite to confirm nothing broke**

```
npm test -- --run
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```
git add src/components/document/FolderCard.jsx
git commit -m "feat(documents): add FolderCard component"
```

---

### Task 3: Wire Documents.jsx — folders grid, drag-and-drop, folder view

**Files:**
- Modify: `src/views/Documents.jsx`

- [ ] **Step 1: Add imports**

Replace the existing import line at the top of `src/views/Documents.jsx`:

```js
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, FolderPlus, Plus, Inbox, Upload, CheckSquare, Square, X, Trash2, ChevronRight } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import PasteDocumentModal from '../components/document/PasteDocumentModal.jsx'
import FolderCard from '../components/document/FolderCard.jsx'
import FileTypeChip from '../components/document/FileTypeChip.jsx'
import { useConfirm } from '../components/ui/ConfirmProvider.jsx'
import { extractDocument, ACCEPT_ATTR } from '../lib/document/extract.js'
```

- [ ] **Step 2: Destructure new store actions**

Replace the existing `useStore()` destructure (around line 27):

```js
const {
  documents, folders,
  userTopics, removeDocument, addDocument,
  addFolder, renameFolder, removeFolder, updateDocument,
  requestSummary,
} = useStore()
```

- [ ] **Step 3: Add new local state**

After the existing `useState` declarations (after line 39, after `const [selectedIds, ...]`), add:

```js
const [activeFolderId, setActiveFolderId] = useState(null)
const [renamingFolderId, setRenamingFolderId] = useState(null)
const draggedDocId = useRef(null)
```

- [ ] **Step 4: Add folder helpers**

Add these functions after `askRemove` (around line 117):

```js
const allFolders = useMemo(() =>
  Object.values(folders || {}).sort((a, b) => a.name.localeCompare(b.name)),
[folders])

const docCountFor = useMemo(() => {
  const counts = {}
  for (const doc of Object.values(documents || {})) {
    if (doc.folderId) counts[doc.folderId] = (counts[doc.folderId] || 0) + 1
  }
  return counts
}, [documents])

async function askRemoveFolder(folder) {
  const count = docCountFor[folder.id] || 0
  const ok = await confirm({
    title: `Delete folder "${folder.name}"?`,
    message: count > 0
      ? `This deletes the folder. The ${count} document${count === 1 ? '' : 's'} inside will move to unfiled.`
      : 'This deletes the empty folder.',
    confirmLabel: 'Delete folder',
    danger: true,
  })
  if (ok) {
    removeFolder(folder.id)
    if (activeFolderId === folder.id) setActiveFolderId(null)
  }
}

function handleDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

function handleDrop(e, folderId) {
  e.preventDefault()
  const docId = e.dataTransfer.getData('docId') || draggedDocId.current
  if (docId) updateDocument(docId, { folderId })
  draggedDocId.current = null
}
```

- [ ] **Step 5: Scope `filtered` to the current view**

Replace the existing `allDocs` and `filtered` useMemo blocks (around lines 119–134):

```js
const allDocs = useMemo(() =>
  Object.values(documents || {}).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
[documents])

const filtered = useMemo(() => {
  const q = filterText.trim().toLowerCase()
  return allDocs.filter((d) => {
    if (activeFolderId) {
      if (d.folderId !== activeFolderId) return false
    } else {
      if (d.folderId) return false
    }
    if (filterTopic && !(d.topics || []).includes(filterTopic)) return false
    if (filterSource && d.sourceType !== filterSource) return false
    if (q) {
      const hay = `${d.title || ''} ${d.excerpt || ''} ${(d.tags || []).join(' ')}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}, [allDocs, filterText, filterTopic, filterSource, activeFolderId])
```

Also reset page when activeFolderId changes — update the existing `useEffect` for page reset (around line 70):

```js
useEffect(() => { setPage(1) }, [filterText, filterTopic, filterSource, activeFolderId])
```

- [ ] **Step 6: Add the "New Folder" button to the header**

In the non-select-mode toolbar (the second `<>` branch of the `{selectMode ? … : …}` block, around line 187), add a New Folder button before the existing Select button:

```jsx
<button
  onClick={() => {
    const f = addFolder('New Folder')
    setRenamingFolderId(f.id)
  }}
  className="btn text-sm"
  title="Create a new folder"
>
  <FolderPlus size={13} /> New Folder
</button>
<button
  onClick={() => setSelectMode(true)}
  className="btn text-sm"
  disabled={allDocs.length === 0}
  title="Bulk-select documents to delete"
>
  <CheckSquare size={13} /> Select
</button>
<button
  onClick={() => bulkInputRef.current?.click()}
  className="btn text-sm"
  title="Upload .txt, .md, .pdf, .docx, .xlsx, .pptx, or .eml"
>
  <Upload size={13} /> Upload file(s)
</button>
<input
  ref={bulkInputRef}
  type="file"
  accept={ACCEPT_ATTR}
  multiple
  className="hidden"
  onChange={onBulkPicked}
/>
<button
  onClick={() => setShowPaste(true)}
  className="btn btn-primary text-sm"
>
  <Plus size={13} /> New from text
</button>
```

- [ ] **Step 7: Add the breadcrumb**

Between the filter bar and the grid/empty-state block, add the breadcrumb. Find the `{/* Filter bar */}` comment (around line 240) and add the breadcrumb immediately after the closing `</div>` of the filter bar:

```jsx
{activeFolderId ? (
  <div className="mb-4 flex items-center gap-1.5 text-sm">
    <button
      onClick={() => setActiveFolderId(null)}
      className="text-[color:var(--color-topic)] hover:underline"
    >
      Documents
    </button>
    <ChevronRight size={13} className="text-gray-400" />
    <span className="font-medium text-gray-700">
      {(folders || {})[activeFolderId]?.name || 'Folder'}
    </span>
  </div>
) : null}
```

- [ ] **Step 8: Render folder cards + drag-enabled doc cards in the grid**

Replace the entire `<div className="grid gap-4" ...>` block (from line 308 to the closing `</div>` around line 405) with the block below. This adds folder cards at the top in root view, drag handlers on doc cards, and an eject button in folder view:

```jsx
<div
  className="grid gap-4"
  style={{ gridTemplateColumns: 'repeat(auto-fill, 300px)' }}
>
  {/* Folder cards — only shown in root view */}
  {!activeFolderId ? allFolders.map((folder) => (
    <FolderCard
      key={folder.id}
      folder={folder}
      docCount={docCountFor[folder.id] || 0}
      isRenaming={renamingFolderId === folder.id}
      onRenameStart={(id) => setRenamingFolderId(id)}
      onRenameCommit={(id, name) => {
        if (id && name) renameFolder(id, name)
        setRenamingFolderId(null)
      }}
      onDelete={askRemoveFolder}
      onClick={() => { setActiveFolderId(folder.id); setPage(1) }}
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, folder.id)}
    />
  )) : null}

  {/* Document cards */}
  {visible.map((d) => {
    const topicNames = (d.topics || []).map(topicNameFor).filter(Boolean)
    const isSelected = selectMode && selectedIds.has(d.id)

    const body = (
      <>
        <div className="flex items-center gap-2 mb-4">
          <FileTypeChip sourceType={d.sourceType} fileName={d.fileName} />
          {d.fileName ? (
            <span className="text-[11px] text-gray-500 font-mono truncate min-w-0" title={d.fileName}>
              {d.fileName}
            </span>
          ) : null}
          <span className="text-[11px] text-gray-500 ml-auto flex-shrink-0">
            {relativeDate(d.updatedAt || d.createdAt)}
          </span>
        </div>
        <h3 className="text-[15px] font-semibold leading-snug line-clamp-2 text-gray-900">{d.title}</h3>
        {d.summary ? (
          <p className="mt-3 text-xs text-gray-600 line-clamp-3 leading-relaxed">{d.summary}</p>
        ) : d.excerpt ? (
          <p className="mt-3 text-xs text-gray-600 line-clamp-3 leading-relaxed">"{d.excerpt}"</p>
        ) : null}
        {topicNames.length || d.tags?.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {topicNames.map((name, i) => (
              <span
                key={`t-${i}`}
                className="text-[10px] uppercase tracking-wide font-medium text-[color:var(--color-topic)] px-1.5 py-0.5 rounded border border-[color:var(--color-topic)]/30 bg-[color:var(--color-topic)]/10"
              >
                {name}
              </span>
            ))}
            {(d.tags || []).map((tag, i) => (
              <span
                key={`tag-${i}`}
                className="text-[10px] text-gray-700 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </>
    )

    return (
      <article
        key={d.id}
        draggable={!selectMode && !activeFolderId}
        onDragStart={(!selectMode && !activeFolderId) ? (e) => {
          draggedDocId.current = d.id
          e.dataTransfer.setData('docId', d.id)
          e.dataTransfer.effectAllowed = 'move'
        } : undefined}
        className={`rounded-lg overflow-hidden border transition-colors flex flex-col group shadow-sm relative ${
          isSelected
            ? 'border-teal-400 ring-2 ring-teal-400/40 bg-slate-50'
            : selectMode
              ? 'border-black/10 bg-slate-100 hover:bg-teal-50 hover:outline-2 hover:outline-teal-400'
              : 'border-black/10 bg-slate-100 hover:bg-slate-200'
        }`}
      >
        {selectMode ? (
          <span className="absolute top-2 right-2 z-10 pointer-events-none">
            {isSelected ? (
              <CheckSquare size={18} className="text-teal-500" />
            ) : (
              <Square size={18} className="text-gray-400" />
            )}
          </span>
        ) : null}
        {selectMode ? (
          <button
            type="button"
            onClick={() => toggleSelect(d.id)}
            aria-pressed={isSelected}
            className="block p-5 flex-1 text-left w-full"
          >
            {body}
          </button>
        ) : (
          <Link to={`/documents/${d.id}`} className="block p-5 flex-1">
            {body}
          </Link>
        )}
        <div className="px-4 pb-3 flex items-center justify-between text-[11px] text-gray-500">
          <span>{d.wordCount || 0} words</span>
          {selectMode ? null : (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {activeFolderId ? (
                <button
                  onClick={() => updateDocument(d.id, { folderId: null })}
                  className="text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                  title="Remove from folder"
                >
                  Eject
                </button>
              ) : null}
              <button
                onClick={() => askRemove(d)}
                className="text-rose-600 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </article>
    )
  })}
</div>
```

- [ ] **Step 9: Run the full test suite**

```
npm test -- --run
```

Expected: all tests PASS.

- [ ] **Step 10: Manual smoke test**

Start the dev server (`npm run dev`) and verify:

1. Documents page shows a "New Folder" button in the header toolbar.
2. Click "New Folder" → a folder card appears in the grid with the name input focused and selected.
3. Type "Research" and press Enter → folder card shows "Research · 0 docs".
4. Drag a document card onto the folder card → the folder card highlights during drag; on drop the doc card disappears from root view and the doc count increases to "1 doc".
5. Click the folder card → breadcrumb shows "Documents / Research"; the dragged document appears in the grid.
6. Hover the doc card inside the folder → "Eject" button appears alongside "Delete".
7. Click "Eject" → doc returns to root view; folder shows "0 docs".
8. Hover the folder card → pencil (rename) and trash (delete) icons appear.
9. Click trash → confirmation dialog; confirm → folder disappears from grid.
10. Double-click a folder name → inline rename input appears; edit and press Enter → name updates.

- [ ] **Step 11: Commit**

```
git add src/views/Documents.jsx
git commit -m "feat(documents): folder grid, drag-and-drop, folder view, breadcrumb"
```
