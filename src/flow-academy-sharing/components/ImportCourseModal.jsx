/**
 * ImportCourseModal — file picker that validates and imports a Flow Academy
 * .json package into the local store.
 *
 * Props:
 *   open     boolean
 *   onClose  () => void
 *   onImport (courseId: string) => void   — called after successful import
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, FileJson2, AlertCircle, CheckCircle2, RotateCcw, GraduationCap } from 'lucide-react'
import { parseImportedPackage } from '../importSharedCourse.js'
import { useStore } from '../../store/useStore.js'

// ── Style constants ────────────────────────────────────────────────────────────

const OVERLAY = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.72)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  zIndex: 9999,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '16px',
}

const PANEL = {
  width: '100%', maxWidth: 460,
  borderRadius: 20,
  background: 'linear-gradient(160deg, rgba(15,17,28,0.97) 0%, rgba(8,10,18,0.98) 100%)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
  overflow: 'hidden',
}

// ── MetaRow ────────────────────────────────────────────────────────────────────

function MetaRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-white/[0.06] last:border-0">
      <span className="text-[11px] text-white/35 uppercase tracking-wider font-semibold">{label}</span>
      <span className="text-[13px] text-white/75 text-right" style={{ maxWidth: 260, wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}

// ── ToggleRow ──────────────────────────────────────────────────────────────────

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/75">{label}</p>
        {hint && <p className="text-[11px] text-white/35 mt-0.5">{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 w-9 h-5 rounded-full transition-all"
        style={{ background: checked ? '#0d9488' : 'rgba(255,255,255,0.12)' }}
      >
        <span
          className="absolute top-0.5 rounded-full bg-white transition-all"
          style={{ left: checked ? '18px' : '2px', width: 16, height: 16 }}
        />
      </button>
    </div>
  )
}

// ── Drop zone ──────────────────────────────────────────────────────────────────

function DropZone({ onFile, dragging, onDragOver, onDragLeave, onDrop }) {
  const inputRef = useRef(null)

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 cursor-pointer transition-all"
      style={{
        borderColor: dragging ? 'rgba(45,212,191,0.6)' : 'rgba(255,255,255,0.12)',
        background: dragging ? 'rgba(45,212,191,0.06)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <FileJson2
        size={32}
        className="transition-colors"
        style={{ color: dragging ? '#2dd4bf' : 'rgba(255,255,255,0.2)' }}
      />
      <div className="text-center">
        <p className="text-sm font-medium text-white/60">Drop your .json file here</p>
        <p className="text-[12px] text-white/30 mt-0.5">or click to browse</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

const IDLE      = 'idle'
const PARSING   = 'parsing'
const PREVIEW   = 'preview'
const ERROR     = 'error'
const IMPORTING = 'importing'
const SUCCESS   = 'success'

export default function ImportCourseModal({ open, onClose, onImport }) {
  const { addCourse } = useStore()

  const [phase, setPhase]             = useState(IDLE)
  const [dragging, setDragging]       = useState(false)
  const [parseResult, setParseResult] = useState(null)   // { ok, course, meta, error }
  const [startFresh, setStartFresh]   = useState(true)
  const [importedId, setImportedId]   = useState(null)

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setPhase(IDLE)
      setDragging(false)
      setParseResult(null)
      setStartFresh(true)
      setImportedId(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  // ── File handling ────────────────────────────────────────────────────────────

  function readFile(file) {
    if (!file || !file.name.endsWith('.json')) {
      setParseResult({ ok: false, error: 'Please select a .json file.' })
      setPhase(ERROR)
      return
    }
    setPhase(PARSING)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = parseImportedPackage(ev.target.result, { startFresh })
      setParseResult(result)
      setPhase(result.ok ? PREVIEW : ERROR)
    }
    reader.onerror = () => {
      setParseResult({ ok: false, error: 'Could not read the file.' })
      setPhase(ERROR)
    }
    reader.readAsText(file)
  }

  function handleDragOver(e) { e.preventDefault(); setDragging(true) }
  function handleDragLeave()  { setDragging(false) }
  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) readFile(file)
  }

  // ── Import ───────────────────────────────────────────────────────────────────

  function handleImport() {
    if (!parseResult?.ok) return
    setPhase(IMPORTING)
    try {
      // Re-apply the current startFresh toggle (user may have changed it after initial parse)
      const courseToAdd = {
        ...parseResult.course,
        status: 'in_progress',
        lessons: parseResult.course.lessons.map((l, i) => ({
          ...l,
          status:        startFresh ? (i === 0 ? 'unlocked' : 'locked') : l.status,
          bestScore:     startFresh ? null : l.bestScore,
          lastAttemptAt: startFresh ? null : l.lastAttemptAt,
        })),
      }
      const imported = addCourse(courseToAdd)
      setImportedId(imported.id)
      setPhase(SUCCESS)
    } catch (err) {
      console.error('[ImportCourseModal] import failed', err)
      setParseResult({ ok: false, error: 'Import failed unexpectedly. Please try again.' })
      setPhase(ERROR)
    }
  }

  function handleOpenCourse() {
    onImport?.(importedId)
    onClose()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return createPortal(
    <div style={OVERLAY} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={PANEL}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Import Shared Course</h2>
            <p className="text-[12px] text-white/40 mt-0.5">Select a Flow Academy .json package</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.07] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pb-6">
          {/* ── IDLE / PARSING ── */}
          {(phase === IDLE || phase === PARSING) && (
            <>
              <DropZone
                onFile={readFile}
                dragging={dragging}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
              {phase === PARSING && (
                <p className="text-center text-[12px] text-white/40 mt-4 animate-pulse">Reading file…</p>
              )}
            </>
          )}

          {/* ── ERROR ── */}
          {phase === ERROR && (
            <div>
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <AlertCircle size={32} className="text-red-400" />
                <p className="text-sm font-semibold text-white/80">Import failed</p>
                <p className="text-[12px] text-white/40 max-w-sm leading-relaxed">
                  {parseResult?.error ?? 'Unknown error'}
                </p>
              </div>
              <button
                onClick={() => setPhase(IDLE)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-all"
              >
                <RotateCcw size={14} /> Try another file
              </button>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {phase === PREVIEW && parseResult?.meta && (
            <div>
              {/* Course summary card */}
              <div
                className="rounded-xl border border-white/[0.08] px-4 py-1 mb-4"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <MetaRow label="Title"   value={parseResult.meta.title} />
                <MetaRow label="Lessons" value={`${parseResult.meta.lessonCount} lessons`} />
                {parseResult.meta.exportedAt && (
                  <MetaRow
                    label="Exported"
                    value={new Date(parseResult.meta.exportedAt).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  />
                )}
                {parseResult.meta.summary && (
                  <div className="py-2 border-t border-white/[0.06]">
                    <p
                      className="text-[12px] text-white/45 leading-relaxed"
                      style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    >
                      {parseResult.meta.summary}
                    </p>
                  </div>
                )}
              </div>

              {/* Progress toggle — only relevant when package includes progress */}
              {parseResult.meta.hasProgress && (
                <div className="mb-5 rounded-xl border border-white/[0.07] px-4">
                  <ToggleRow
                    label="Start fresh"
                    hint={startFresh
                      ? 'Ignore sender progress — start from lesson 1'
                      : "Import sender's quiz scores and unlock state"}
                    checked={startFresh}
                    onChange={setStartFresh}
                  />
                </div>
              )}

              {/* Action row */}
              <div className="flex gap-2">
                <button
                  onClick={() => setPhase(IDLE)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all"
                >
                  Change file
                </button>
                <button
                  onClick={handleImport}
                  className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
                >
                  <Upload size={14} /> Import course
                </button>
              </div>
            </div>
          )}

          {/* ── IMPORTING ── */}
          {phase === IMPORTING && (
            <p className="text-center text-[12px] text-white/40 py-10 animate-pulse">Importing…</p>
          )}

          {/* ── SUCCESS ── */}
          {phase === SUCCESS && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle2 size={36} className="text-teal-400" />
              <div>
                <p className="text-sm font-semibold text-white/90">Course imported!</p>
                <p className="text-[12px] text-white/40 mt-1">
                  {parseResult?.meta?.title ?? 'Course'} is now in your Flow Academy.
                </p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all"
                >
                  Done
                </button>
                <button
                  onClick={handleOpenCourse}
                  className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)' }}
                >
                  <GraduationCap size={14} /> Open course
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
