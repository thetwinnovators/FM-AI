import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, FolderPlus, Plus, Inbox, Upload, CheckSquare, Square, X, Trash2, ChevronRight, FolderInput, Wand2, Loader2 } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import PasteDocumentModal from '../components/document/PasteDocumentModal.jsx'
import FolderCard from '../components/document/FolderCard.jsx'
import FileTypeChip from '../components/document/FileTypeChip.jsx'
import { useConfirm } from '../components/ui/ConfirmProvider.jsx'
import { extractDocument, ACCEPT_ATTR } from '../lib/document/extract.js'
import { normalizeMarkdown, PROCESSING_VERSION } from '../lib/document/normalizeMarkdown.js'

const PAGE_SIZE = 24

function relativeDate(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Math.floor((Date.now() - t) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function Documents() {
  const { topics: seedTopics, topicById } = useSeed()
  const {
    documents, folders,
    userTopics, removeDocument, addDocument,
    addFolder, renameFolder, removeFolder, updateDocument,
    reprocessDocument, requestSummary,
  } = useStore()
  const confirm = useConfirm()

  const [showPaste, setShowPaste] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [page, setPage] = useState(1)
  const bulkInputRef = useRef(null)
  const [bulkStatus, setBulkStatus] = useState(null) // { ok, skipped, failures: string[] }
  // Bulk-select mode: checkboxes on each card; bulk delete from header.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [activeFolderId, setActiveFolderId] = useState(null)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const moveMenuRef = useRef(null)
  const moveBtnRef = useRef(null)
  const [renamingFolderId, setRenamingFolderId] = useState(null)
  const draggedDocId = useRef(null)

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
    setShowMoveMenu(false)
  }

  function bulkMove(targetFolderId) {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    ids.forEach((id) => updateDocument(id, { folderId: targetFolderId || null }))
    setShowMoveMenu(false)
    exitSelectMode()
  }

  // Close move-menu when clicking outside it
  useEffect(() => {
    if (!showMoveMenu) return
    function onPointerDown(e) {
      if (
        moveMenuRef.current?.contains(e.target) ||
        moveBtnRef.current?.contains(e.target)
      ) return
      setShowMoveMenu(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [showMoveMenu])

  async function askBulkDelete() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const ok = await confirm({
      title: `Delete ${ids.length} document${ids.length === 1 ? '' : 's'}?`,
      message: 'This deletes the selected documents and their content. Topic links and any future citations are removed.',
      confirmLabel: `Delete ${ids.length}`,
      danger: true,
    })
    if (!ok) return
    ids.forEach((id) => removeDocument(id))
    exitSelectMode()
  }

  // Reset to first page whenever the filtered set changes shape.
  useEffect(() => { setPage(1) }, [filterText, filterTopic, filterSource, activeFolderId])

  // Bulk file ingest. Dispatches to format-specific extractors (txt, md, pdf,
  // docx, xls/xlsx, pptx, eml) and creates one Document per file with the
  // extracted plain text. Failures (unsupported format, empty, parse error)
  // are surfaced in the status banner with a short reason.
  async function onBulkPicked(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return

    let ok = 0
    const failures = []
    for (const f of files) {
      const result = await extractDocument(f)
      if (result.error) {
        failures.push(`${f.name} — ${result.error}`)
        continue
      }
      let normalizedMarkdown = null
      let processingStatus = 'failed'
      let processingError = null
      try {
        normalizedMarkdown = normalizeMarkdown(result.text, f.type || '')
        processingStatus = 'processed'
      } catch (err) {
        processingError = err?.message || 'Normalization failed'
      }

      const meta = addDocument({
        title: f.name.replace(/\.[^.]+$/, '').slice(0, 80),
        plainText: result.text,
        sourceType: 'upload',
        fileName: f.name,
        mimeType: f.type || null,
        normalizedMarkdown,
        processingStatus,
        processingError,
        processingVersion: PROCESSING_VERSION,
      })
      if (meta?.id) {
        ok += 1
        requestSummary(meta.id)
      }
    }
    setBulkStatus({ ok, skipped: failures.length, failures })
    // Auto-clear status after 8s so the banner doesn't linger forever.
    setTimeout(() => setBulkStatus((cur) => (cur && cur.ok === ok && cur.skipped === failures.length ? null : cur)), 8000)
  }

  function topicNameFor(id) {
    return topicById(id)?.name || userTopics[id]?.name || null
  }

  async function askRemove(doc) {
    const ok = await confirm({
      title: `Delete "${doc.title}"?`,
      message: 'This deletes the document and its content. Topic links and any future citations are removed.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) removeDocument(doc.id)
  }

  const [formatAllProgress, setFormatAllProgress] = useState(null) // null | { current, total, done }

  async function formatAllDocuments() {
    const toProcess = Object.values(documents || {}).filter(
      (d) => d.processingStatus !== 'processed' || d.processingVersion !== PROCESSING_VERSION
    )
    if (toProcess.length === 0) {
      setFormatAllProgress({ current: 0, total: 0, done: true })
      setTimeout(() => setFormatAllProgress(null), 3000)
      return
    }
    setFormatAllProgress({ current: 0, total: toProcess.length, done: false })
    for (let i = 0; i < toProcess.length; i++) {
      const doc = toProcess[i]
      setFormatAllProgress({ current: i + 1, total: toProcess.length, done: false })
      updateDocument(doc.id, { processingStatus: 'reprocessing' })
      await reprocessDocument(doc.id)
    }
    setFormatAllProgress({ current: toProcess.length, total: toProcess.length, done: true })
    setTimeout(() => setFormatAllProgress(null), 4000)
  }

  const allFolders = useMemo(() =>
    Object.values(folders || {}).sort((a, b) => a.name.localeCompare(b.name)),
  [folders])

  const regularFolders = useMemo(() => allFolders.filter(f => f.name !== 'AI Memory'), [allFolders])
  const systemFolders  = useMemo(() => allFolders.filter(f => f.name === 'AI Memory'), [allFolders])

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

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < filtered.length

  const allTopics = useMemo(() => [
    ...seedTopics.map((t) => ({ id: t.id, name: t.name, isUser: false })),
    ...Object.values(userTopics).map((t) => ({ id: t.id, name: t.name, isUser: true })),
  ], [seedTopics, userTopics])

  return (
    <div className="p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2.5">
            <FileText size={20} className="text-[color:var(--color-topic)]" /> My Documents
          </h1>
          <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
            Long-form notes, chat dumps, and articles you want FlowMap to remember.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {selectMode ? (
            <>
              <span className="text-[11px] text-[color:var(--color-text-tertiary)] mr-1">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => {
                  const allSelected = visible.every((d) => selectedIds.has(d.id))
                  setSelectedIds((prev) => {
                    const next = new Set(prev)
                    if (allSelected) visible.forEach((d) => next.delete(d.id))
                    else visible.forEach((d) => next.add(d.id))
                    return next
                  })
                }}
                className="btn text-sm"
              >
                <CheckSquare size={13} /> Select visible
              </button>
              <div className="relative">
                <button
                  ref={moveBtnRef}
                  onClick={() => setShowMoveMenu((v) => !v)}
                  disabled={selectedIds.size === 0}
                  className="btn text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Move selected documents to a folder"
                >
                  <FolderInput size={13} /> Move to…
                </button>
                {showMoveMenu ? (
                  <div
                    ref={moveMenuRef}
                    className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl overflow-hidden shadow-xl"
                    style={{
                      background: 'linear-gradient(160deg,rgba(15,17,28,0.97) 0%,rgba(8,10,18,0.99) 100%)',
                      border: '1px solid rgba(255,255,255,0.11)',
                      backdropFilter: 'blur(32px)',
                    }}
                  >
                    <div className="py-1">
                      <p className="text-[10px] uppercase tracking-wide text-white/40 font-medium px-3 pt-2 pb-1">
                        Move {selectedIds.size} doc{selectedIds.size === 1 ? '' : 's'} to
                      </p>
                      <button
                        onClick={() => bulkMove(null)}
                        className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/[0.07] flex items-center gap-2"
                      >
                        <span className="text-white/40">📂</span> Unfiled (root)
                      </button>
                      {allFolders.filter(f => f.name !== 'AI Memory').map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => bulkMove(folder.id)}
                          className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/[0.07] flex items-center gap-2"
                        >
                          <span className="text-white/40">📁</span> {folder.name}
                        </button>
                      ))}
                      {allFolders.filter(f => f.name !== 'AI Memory').length === 0 ? (
                        <p className="text-[11px] text-white/30 px-3 pb-2">No folders yet — create one first.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                onClick={askBulkDelete}
                disabled={selectedIds.size === 0}
                className="btn text-sm text-rose-300 hover:text-rose-200 hover:border-rose-400/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={13} /> Delete {selectedIds.size > 0 ? selectedIds.size : ''}
              </button>
              <button onClick={exitSelectMode} className="btn text-sm">
                <X size={13} /> Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={formatAllDocuments}
                disabled={!!formatAllProgress && !formatAllProgress.done}
                className="btn text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Convert all unformatted documents to readable Markdown"
              >
                {formatAllProgress && !formatAllProgress.done ? (
                  <><Loader2 size={13} className="animate-spin" /> {formatAllProgress.current}/{formatAllProgress.total}</>
                ) : formatAllProgress?.done ? (
                  <><Wand2 size={13} /> Done</>
                ) : (
                  <><Wand2 size={13} /> Format All</>
                )}
              </button>
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
                className="btn btn-primary text-sm"
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
            </>
          )}
        </div>
      </header>

      {bulkStatus ? (
        <div
          className={`mb-4 px-3 py-2 rounded-lg border text-[12px] ${
            bulkStatus.skipped === 0
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200/90'
              : 'border-amber-500/30 bg-amber-500/5 text-amber-200/90'
          }`}
        >
          Uploaded {bulkStatus.ok} document{bulkStatus.ok === 1 ? '' : 's'}
          {bulkStatus.skipped > 0 ? `, skipped ${bulkStatus.skipped}` : ''}.
          {bulkStatus.failures.length > 0 ? (
            <span className="block text-[11px] mt-1 text-[color:var(--color-text-tertiary)] truncate">
              Skipped: {bulkStatus.failures.slice(0, 5).join(', ')}{bulkStatus.failures.length > 5 ? ` (+${bulkStatus.failures.length - 5} more)` : ''}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Filter bar */}
      <div className="glass-panel p-3 mb-6 flex items-center gap-3 flex-wrap">
        <input
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Search title, excerpt, tags…"
          className="glass-input text-sm flex-1 min-w-[200px] max-w-[360px]"
        />
        <select
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
          className="glass-input text-sm"
        >
          <option value="">All topics</option>
          {allTopics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}{t.isUser ? ' (saved)' : ''}</option>
          ))}
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="glass-input text-sm"
        >
          <option value="">All sources</option>
          <option value="pasted">Pasted</option>
          <option value="upload">Upload</option>
          <option value="saved-url">Saved URL</option>
        </select>
        <span className="text-[11px] text-[color:var(--color-text-tertiary)] ml-auto">
          {filtered.length} of {activeFolderId ? (docCountFor[activeFolderId] || 0) : allDocs.length}
        </span>
      </div>

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

      {filtered.length === 0 && (activeFolderId ? true : allFolders.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-[color:var(--color-bg-glass-strong)] border border-[color:var(--color-border-default)] flex items-center justify-center mb-4">
            <Inbox size={20} className="text-[color:var(--color-text-tertiary)]" />
          </div>
          <h3 className="text-base font-semibold">
            {allDocs.length === 0 ? 'No documents yet' : activeFolderId ? 'Folder is empty' : 'Nothing matches'}
          </h3>
          <p className="text-sm text-[color:var(--color-text-tertiary)] mt-2 max-w-md">
            {allDocs.length === 0
              ? 'Paste a chat transcript or a long note to get started. AI summaries land in Phase 2.'
              : activeFolderId
                ? 'Drag documents here from the root view, or upload new files.'
                : 'Loosen the filters above.'}
          </p>
          {allDocs.length === 0 ? (
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => bulkInputRef.current?.click()}
                className="btn text-sm"
              >
                <Upload size={13} /> Upload file(s)
              </button>
              <button
                onClick={() => setShowPaste(true)}
                className="btn btn-primary text-sm"
              >
                <Plus size={13} /> New from text
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
        {/* AI Memory system folder — pinned above regular folders */}
        {!activeFolderId && systemFolders.length > 0 ? (
          <div className="mb-5 pb-5 border-b border-white/[0.06]">
            <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">
              AI-generated
            </p>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, 300px)' }}
            >
              {systemFolders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  docCount={docCountFor[folder.id] || 0}
                  isRenaming={false}
                  onRenameStart={() => {}}
                  onRenameCommit={() => {}}
                  onDelete={() => {}}
                  onClick={() => { setActiveFolderId(folder.id); setPage(1) }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, folder.id)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, 300px)' }}
        >
          {/* Regular folder cards — only shown in root view */}
          {!activeFolderId ? regularFolders.map((folder, i) => (
            <div key={folder.id} className="fm-fade-up" style={{ '--fm-delay': `${i * 35}ms` }}>
              <FolderCard
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
            </div>
          )) : null}

          {/* Document cards */}
          {visible.map((d, i) => {
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
                style={{ '--fm-delay': `${i * 35}ms` }}
                className={`fm-fade-up rounded-lg overflow-hidden border transition-colors flex flex-col group shadow-sm relative ${
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

        <div className="text-center pt-6">
          {hasMore ? (
            <button onClick={() => setPage((p) => p + 1)} className="btn">
              Load more <span className="text-[11px] text-[color:var(--color-text-tertiary)] ml-1">{visible.length} of {filtered.length}</span>
            </button>
          ) : filtered.length > PAGE_SIZE ? (
            <p className="text-[11px] text-[color:var(--color-text-tertiary)]">All {filtered.length} documents loaded.</p>
          ) : null}
        </div>
        </>
      )}

      <PasteDocumentModal
        open={showPaste}
        onClose={() => setShowPaste(false)}
      />
    </div>
  )
}
