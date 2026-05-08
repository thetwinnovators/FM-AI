export type PainType =
  | 'workflow' | 'cost' | 'feature' | 'complexity'
  | 'speed'    | 'workaround' | 'integration' | 'privacy'

export interface PainSignal {
  id:             string
  detectedAt:     string         // ISO timestamp
  source:         'reddit' | 'hackernews' | 'youtube'
  sourceUrl:      string
  author?:        string
  painText:       string         // raw extracted text
  normalizedText: string         // lowercased, stopwords stripped, synonyms collapsed
  keyTerms:       string[]       // extracted from normalizedText
  painType:       PainType
  intensityScore: number         // 0–10
  clusterId?:     string
  queryUsed:      string
}

export interface OpportunityCluster {
  id:               string
  clusterName:      string
  painTheme:        PainType
  signalIds:        string[]
  signalCount:      number
  sourceDiversity:  number
  avgIntensity:     number
  firstDetected:    string
  lastDetected:     string
  termFrequency:    Record<string, number>
  opportunityScore:    number
  isBuildable:         boolean
  status:              'emerging' | 'validated' | 'concept_generated' | 'archived'
  // Set by the AI opportunity filter after each scan
  aiValidated?:        boolean        // undefined = not yet evaluated, true = approved, false = rejected
  aiRejectionReason?:  string
  // Market-layer scoring — populated by scoreOpportunity(); undefined until first scored
  gapScore?:          number
  marketScore?:       number
  buildabilityScore?: number
  inferredCategory?:  string | null
  createdAt:        string
  updatedAt:        string
}

export interface AppConcept {
  id:             string
  clusterId:      string
  title:          string
  tagline:        string
  confidenceScore: number

  evidenceSummary: {
    signalCount:     number
    sourceBreakdown: Record<string, number>
    dateRange:       { first: string; last: string }
    topQuotes:       Array<{ text: string; source: string; url: string; author?: string }>
  }
  painPoints: Array<{ point: string; frequency: number }>

  opportunitySummary:  string
  problemStatement:    string
  targetUser:          string
  proposedSolution:    string
  valueProp:           string
  mvpScope:            string
  risks:               string
  claudeCodePrompt:    string
  implementationPlan:  string

  generatedBy: 'ollama' | 'template'
  status:      'new' | 'reviewing' | 'saved' | 'building' | 'archived'
  createdAt:   string
  updatedAt:   string
}

export interface RadarScanMeta {
  lastScanAt:      string | null
  totalSignals:    number
  totalClusters:   number
  scanDurationMs?: number
}

export interface CategoryChart {
  category:  string                    // e.g. 'productivity'
  chartType: 'top_free' | 'top_grossing'
  fetchedAt: string                    // ISO timestamp
  apps: Array<{
    rank:      number
    name:      string
    publisher: string
    appId:     string
  }>
}

export interface WinningApp {
  id:           string
  name:         string
  category:     string
  pricingModel: 'free' | 'subscription' | 'iap' | 'mixed' | 'one_time'
  notes:        string   // free-text: complaints, strengths, context
  addedAt:      string
  updatedAt:    string
}
