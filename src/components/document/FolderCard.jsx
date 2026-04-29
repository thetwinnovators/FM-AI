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
