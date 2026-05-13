/**
 * ShareCourseModal — lets the user export the current course as HTML, JSON, or both.
 *
 * Props:
 *   open     boolean
 *   course   course object
 *   onClose  () => void
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, FileCode2, FileJson2, Files, Lock, Unlock, Eye, BookOpen, ChevronDown } from 'lucide-react'
import { downloadCoursePackage } from '../buildCoursePackage.js'
import { downloadCourseHTML } from '../renderFlowAcademyExportHTML.js'
import { EXPORT_MODES, VIEWER_MODES } from '../exportTypes.js'

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
  width: '100%', maxWidth: 500,
  borderRadius: 20,
  background: 'linear-gradient(160deg, rgba(15,17,28,0.97) 0%, rgba(8,10,18,0.98) 100%)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
  overflow: 'hidden',
}

// ── Mode card ──────────────────────────────────────────────────────────────────

function ModeCard({ id, icon: Icon, label, description, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className="w-full text-left rounded-xl border p-4 transition-all"
      style={{
        background: selected
          ? 'linear-gradient(135deg, rgba(13,148,136,0.18) 0%, rgba(99,102,241,0.12) 100%)'
          : 'rgba(255,255,255,0.03)',
        borderColor: selected ? 'rgba(45,212,191,0.45)' : 'rgba(255,255,255,0.08)',
        boxShadow: selected ? '0 0 0 1px rgba(45,212,191,0.15) inset' : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        <Icon size={18} className={selected ? 'text-teal-400' : 'text-white/35'} style={{ marginTop: 1, flexShrink: 0 }} />
        <div className="min-w-0">
          <p className={`text-sm font-semibold mb-0.5 ${selected ? 'text-white' : 'text-white/60'}`}>{label}</p>
          <p className="text-[12px] text-white/40 leading-snug">{description}</p>
        </div>
        <div
          className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 transition-all"
          style={{
            borderColor: selected ? '#2dd4bf' : 'rgba(255,255,255,0.2)',
            background: selected ? '#2dd4bf' : 'transparent',
          }}
        />
      </div>
    </button>
  )
}

// ── Toggle row ─────────────────────────────────────────────────────────────────

function ToggleRow({ icon: Icon, label, hint, checked, onChange }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/[0.06] last:border-0">
      <Icon size={14} className="text-white/35 flex-shrink-0" />
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

// ── ViewerMode select (only shown when HTML is included) ───────────────────────

function ViewerModeSelect({ value, onChange }) {
  const opts = [
    {
      id: VIEWER_MODES.GUIDED,
      label: 'Guided mode',
      hint: 'Lessons unlock sequentially; quiz must pass to advance',
    },
    {
      id: VIEWER_MODES.READ_ONLY,
      label: 'Read-only mode',
      hint: 'All content visible immediately, no quiz gates',
    },
  ]

  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-white/[0.07]">
      {opts.map((o, i) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
          style={{
            background: value === o.id ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
            borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}
        >
          <div
            className="mt-1 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all"
            style={{
              borderColor: value === o.id ? '#6366f1' : 'rgba(255,255,255,0.2)',
              background: value === o.id ? '#6366f1' : 'transparent',
            }}
          />
          <div>
            <p className={`text-sm font-medium ${value === o.id ? 'text-white' : 'text-white/55'}`}>{o.label}</p>
            <p className="text-[11px] text-white/35 mt-0.5 leading-snug">{o.hint}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ShareCourseModal({ open, course, onClose }) {
  const [mode, setMode]               = useState(EXPORT_MODES.HTML)
  const [includeProgress, setInclude] = useState(false)
  const [viewerMode, setViewerMode]   = useState(VIEWER_MODES.GUIDED)
  const [downloading, setDownloading] = useState(false)
  const [done, setDone]               = useState(false)

  useEffect(() => {
    if (!open) { setDone(false); setDownloading(false) }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !course) return null

  const includeHTML = mode === EXPORT_MODES.HTML || mode === EXPORT_MODES.BOTH
  const includeJSON = mode === EXPORT_MODES.JSON || mode === EXPORT_MODES.BOTH

  const generatedCount = course.lessons.filter(
    (l) => l.explanation !== null,
  ).length
  const totalLessons = course.lessons.length

  function handleDownload() {
    setDownloading(true)
    try {
      if (includeHTML) downloadCourseHTML(course, { includeProgress, viewerMode })
      if (includeJSON) downloadCoursePackage(course, { includeProgress })
      setDone(true)
    } catch (err) {
      console.error('[ShareCourseModal] export failed', err)
    } finally {
      setDownloading(false)
    }
  }

  return createPortal(
    <div style={OVERLAY} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={PANEL}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Share Course</h2>
            <p className="text-[12px] text-white/40 mt-0.5 truncate" style={{ maxWidth: 360 }}>
              {course.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.07] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Lesson generation warning */}
        {generatedCount < totalLessons && (
          <div className="mx-6 mb-4 px-4 py-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06]">
            <p className="text-[12px] text-amber-300/80 leading-snug">
              <span className="font-semibold">{totalLessons - generatedCount} lesson{totalLessons - generatedCount !== 1 ? 's' : ''}</span>
              {' '}haven't been generated yet. Recipients will see empty lessons for those.{' '}
              Open each lesson first to generate its content, then export.
            </p>
          </div>
        )}

        {/* Scrollable body */}
        <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 120px)' }}>
          {/* Export format */}
          <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">Export format</p>
          <div className="flex flex-col gap-2 mb-5">
            <ModeCard
              id={EXPORT_MODES.HTML}
              icon={FileCode2}
              label="Shareable webpage (.html)"
              description="A self-contained file anyone can open in a browser — no account needed."
              selected={mode === EXPORT_MODES.HTML}
              onClick={setMode}
            />
            <ModeCard
              id={EXPORT_MODES.JSON}
              icon={FileJson2}
              label="Import package (.json)"
              description="Recipients can import this into their own Flow Academy and continue where you left off."
              selected={mode === EXPORT_MODES.JSON}
              onClick={setMode}
            />
            <ModeCard
              id={EXPORT_MODES.BOTH}
              icon={Files}
              label="Both files"
              description="Download the webpage and the import package together."
              selected={mode === EXPORT_MODES.BOTH}
              onClick={setMode}
            />
          </div>

          {/* HTML viewer mode (only when HTML is included) */}
          {includeHTML && (
            <div className="mb-5">
              <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2">Viewer experience</p>
              <ViewerModeSelect value={viewerMode} onChange={setViewerMode} />
            </div>
          )}

          {/* Options */}
          <div className="mb-6 rounded-xl border border-white/[0.07] px-4">
            <ToggleRow
              icon={includeProgress ? Unlock : Lock}
              label="Include my progress"
              hint={includeProgress
                ? 'Recipient starts with your quiz scores and unlock state'
                : 'Recipient starts fresh from lesson 1'}
              checked={includeProgress}
              onChange={setInclude}
            />
          </div>

          {/* Download button */}
          {done ? (
            <div className="flex flex-col items-center gap-2 py-3">
              <p className="text-sm font-semibold text-teal-400">
                {mode === EXPORT_MODES.BOTH ? 'Files downloaded!' : 'File downloaded!'}
              </p>
              <button
                onClick={handleDownload}
                className="text-[12px] text-white/40 hover:text-white/70 transition-colors"
              >
                Download again
              </button>
            </div>
          ) : (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: downloading
                  ? 'rgba(13,148,136,0.3)'
                  : 'linear-gradient(135deg, #0d9488 0%, #6366f1 100%)',
                color: downloading ? 'rgba(255,255,255,0.5)' : '#fff',
                cursor: downloading ? 'not-allowed' : 'pointer',
              }}
            >
              <Download size={15} />
              {downloading ? 'Preparing…' : `Download ${mode === EXPORT_MODES.BOTH ? 'files' : 'file'}`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
