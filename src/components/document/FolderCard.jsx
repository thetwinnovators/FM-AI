import { useEffect, useRef, useState } from 'react'
import { Folder, Pencil, Trash2, Brain } from 'lucide-react'

const PALETTE = [
  '#e879f9', '#a78bfa', '#60a5fa', '#34d399',
  '#fb923c', '#f472b6', '#facc15', '#2dd4bf',
]

const AI_MEMORY_NAME = 'AI Memory'

function pickColor(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

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
  const cancelledRef = useRef(false)
  const color = pickColor(folder.id)
  const isAiMemory = folder.name === AI_MEMORY_NAME

  useEffect(() => {
    setDraft(folder.name)
    if (isRenaming) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [isRenaming, folder.name])

  function commit() {
    if (cancelledRef.current) { cancelledRef.current = false; return }
    onRenameCommit?.(folder.id, draft.trim() || folder.name)
  }

  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    if (e.key === 'Escape') { cancelledRef.current = true; setDraft(folder.name); onRenameCommit?.(null, null) }
  }

  function handleDragOver(e) {
    setIsDragOver(true)
    onDragOver?.(e)
  }

  function handleDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return
    setIsDragOver(false)
  }

  function handleDrop(e) {
    setIsDragOver(false)
    onDrop?.(e)
  }

  return (
    <article
      className={`rounded-lg overflow-hidden border transition-colors flex flex-col group shadow-sm relative ${
        isAiMemory
          ? 'border-purple-200'
          : isDragOver ? 'bg-slate-50' : 'border-black/10 bg-slate-100 hover:bg-slate-200'
      }`}
      style={{
        cursor: isRenaming ? 'default' : 'pointer',
        ...(isAiMemory ? {
          background: 'linear-gradient(135deg, #fdf4ff 0%, #f5f3ff 55%, #eff6ff 100%)',
          borderColor: '#d8b4fe',
        } : isDragOver ? { borderColor: color, boxShadow: `0 0 0 2px ${color}66` } : {}),
      }}
      onClick={!isRenaming ? () => onClick?.() : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isAiMemory && (
        <Brain
          size={90}
          className="absolute -bottom-3 -right-3 pointer-events-none select-none"
          style={{ color: '#a855f7', opacity: 0.08 }}
          aria-hidden="true"
        />
      )}

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={isAiMemory
              ? { background: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)', color: '#9333ea' }
              : { backgroundColor: color + '26', color }}
          >
            {isAiMemory ? <Brain size={18} /> : <Folder size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            {isRenaming && !isAiMemory ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={onKey}
                onClick={(e) => e.stopPropagation()}
                className="text-[15px] font-semibold leading-snug w-full bg-transparent outline-none text-gray-900"
                style={{ borderBottom: `1px solid ${color}` }}
              />
            ) : (
              <h3
                className="text-[15px] font-semibold leading-snug line-clamp-2 text-gray-900"
                onDoubleClick={!isAiMemory ? (e) => { e.stopPropagation(); onRenameStart?.(folder.id) } : undefined}
              >
                {folder.name}
              </h3>
            )}
            <p className="text-[11px] mt-1" style={isAiMemory ? { color: '#a855f7' } : { color: 'rgb(107 114 128)' }}>
              {docCount} doc{docCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isAiMemory && (
          <button
            onClick={(e) => { e.stopPropagation(); onRenameStart?.(folder.id) }}
            className="p-1 rounded hover:bg-slate-300 text-gray-500 hover:text-gray-700"
            title="Rename folder"
            aria-label="Rename folder"
          >
            <Pencil size={13} />
          </button>
        )}
        {!isAiMemory && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(folder) }}
            className="p-1 rounded hover:bg-rose-100 text-rose-500 hover:text-rose-700"
            title="Delete folder"
            aria-label="Delete folder"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </article>
  )
}
