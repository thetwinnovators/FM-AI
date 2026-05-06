export type SignalCategory =
  | 'rising-keyword'
  | 'repeating-hook'
  | 'recurring-question'
  | 'entity-spike'
  | 'format-trend'
  | 'cta-pattern'
  | 'news-mention'

export type SignalDirection = 'up' | 'flat' | 'down'
export type SourceType = 'youtube' | 'google-alert'

export interface SignalTopic {
  id: string
  title: string
  keywords: string[]
  aliases?: string[]
  excludedPhrases?: string[]
  sourcePreferences?: { youtube?: boolean; googleAlerts?: boolean }
  watchStatus: 'active' | 'paused'
  createdAt: string
  updatedAt: string
}

export interface SignalSource {
  id: string
  type: SourceType
  label: string
  query: string
  topicIds: string[]
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface SignalEvidence {
  label: string
  snippet?: string
  url?: string
  publishedAt?: string
}

export interface SignalItem {
  id: string
  primaryTopicId?: string
  relatedTopicIds: string[]
  sourceId: string
  sourceType: SourceType
  category: SignalCategory
  title: string
  summary: string
  score: number
  direction: SignalDirection
  firstDetectedAt: string
  lastDetectedAt: string
  evidence: SignalEvidence[]
  pinned?: boolean
  muted?: boolean
  memoryFileId?: string | null
  noteId?: string | null
  createdAt: string
  updatedAt: string
}

export interface ScanConfig {
  youtubeFrequency: 'manual' | '6h' | '12h' | 'daily' | 'weekly'
  alertsFrequency: 'manual' | '6h' | '12h' | 'daily' | 'weekly'
  lastYoutubeScan?: string
  lastAlertsScan?: string
}
