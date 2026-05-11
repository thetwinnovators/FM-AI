export interface SubLessonProgress {
  subLessonId:  string
  viewed:       boolean
  practiced:    boolean
  completed:    boolean
  skipped:      boolean
  lastOpenedAt: string
}

const PREFIX = 'fm_pyca_'

function defaults(id: string): SubLessonProgress {
  return { subLessonId: id, viewed: false, practiced: false, completed: false, skipped: false, lastOpenedAt: '' }
}

export function loadProgress(id: string): SubLessonProgress {
  try {
    const raw = localStorage.getItem(PREFIX + id)
    return raw ? { ...defaults(id), ...JSON.parse(raw) } : defaults(id)
  } catch {
    return defaults(id)
  }
}

export function saveProgress(id: string, partial: Partial<SubLessonProgress>): void {
  const current = loadProgress(id)
  const updated  = { ...current, ...partial, subLessonId: id, lastOpenedAt: new Date().toISOString() }
  localStorage.setItem(PREFIX + id, JSON.stringify(updated))
}

export function loadAllProgress(): Record<string, SubLessonProgress> {
  const result: Record<string, SubLessonProgress> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) {
      const id = key.slice(PREFIX.length)
      result[id] = loadProgress(id)
    }
  }
  return result
}

export function clearAllProgress(): void {
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) toRemove.push(key)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
}

export function exportProgress(): void {
  const data = loadAllProgress()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'flowmap-python-progress.json'
  a.click()
  URL.revokeObjectURL(url)
}

export function importProgress(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid file')
        Object.entries(parsed).forEach(([id, value]) => {
          if (typeof value === 'object' && value !== null) {
            localStorage.setItem(PREFIX + id, JSON.stringify(value))
          }
        })
        resolve()
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file)
  })
}
