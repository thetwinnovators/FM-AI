export type PainType =
  | 'workflow' | 'cost' | 'feature' | 'complexity'
  | 'speed'    | 'workaround' | 'integration' | 'privacy'

// ─── Schema v1: Entity types ──────────────────────────────────────────────────
// Seven entity types extracted from raw signals. Each type maps to a distinct
// discovery layer: who is affected, what they do, what they use, where they work,
// how they work around gaps, and what already exists in the market.

export type EntityType =
  | 'persona'              // who experiences the problem (role / segment)
  | 'pain_point'           // the core friction (problem space)
  | 'workflow'             // the process or task being done
  | 'technology'           // tools, platforms, or APIs mentioned
  | 'industry'             // sector or market context
  | 'workaround'           // how people currently solve the gap
  | 'existing_solution'    // named products / services already in use
  // Venture Scope additions (v2)
  | 'bottleneck'           // specific step that blocks progress
  | 'buyer_role'           // who controls budget/purchase decision
  | 'company_type'         // SMB, enterprise, startup, agency, etc.
  | 'process_step'         // named step inside a workflow
  | 'trigger_event'        // event that initiates a workflow or need
  | 'emerging_technology'  // new tech that enables new approaches
  | 'platform_shift'       // macro change creating new opportunity window

/** A single entity extracted from a signal. Stored inline with the signal. */
export interface SignalEntity {
  type:       EntityType
  value:      string    // normalized canonical form
  rawText:    string    // exact text from source (for tracing)
  confidence: number    // 0–1: extraction certainty
}

/** Aggregated entity record built from many signals — the entity registry. */
export interface ExtractedEntity {
  id:             string          // stable hash of type+value
  type:           EntityType
  value:          string          // canonical form
  frequency:      number          // how many signals mention this entity
  confidence:     number          // mean confidence across mentions
  sourceSignalIds: string[]       // which signal IDs contain this entity
  lastSeen:       string          // ISO timestamp
  firstSeen:      string          // ISO timestamp
}

// ─── Relationships ────────────────────────────────────────────────────────────

export type RelationshipType =
  | 'experiences'     // persona  → pain_point
  | 'performs'        // persona  → workflow
  | 'has_friction'    // workflow → pain_point
  | 'uses'            // persona  → existing_solution
  | 'signals_gap'     // workaround → pain_point  (workaround = unmet need evidence)
  | 'enables'         // technology → workflow
  | 'operates_in'     // persona  → industry
  | 'substitutes'     // workaround → existing_solution

export interface EntityRelationship {
  id:               string
  fromId:           string            // entity id
  toId:             string            // entity id
  relationshipType: RelationshipType
  strength:         number            // 0–1 (based on co-occurrence count)
  evidenceCount:    number
  lastSeen:         string
  contradicted:     boolean           // flag for contradictory evidence
}

/** The living entity graph produced from a full scan. */
export interface EntityGraph {
  entities:      Record<string, ExtractedEntity>
  relationships: Record<string, EntityRelationship>
  updatedAt:     string
}

// ─── 10-Dimension scoring model ───────────────────────────────────────────────

/**
 * The 10-dimension opportunity scoring breakdown.
 * Each dimension is 0–100. Populated by scoreDimensions() and stored on the
 * cluster after each scan so the UI can surface individual dimension insights.
 *
 *   Demand:  painSeverity, frequency, urgency, willingnessToPay
 *   Market:  marketBreadth, poorSolutionFit
 *   Supply:  feasibility, whyNow, defensibility, gtmClarity
 */
export interface DimensionScores {
  /** How intense is the reported pain across signals? (intensity avg + high-intensity ratio) */
  painSeverity:     number
  /** Signal volume and cross-source breadth. */
  frequency:        number
  /** Time-pressure signals: urgency keywords + recency + pain-type bonus. */
  urgency:          number
  /** Evidence that people will pay: financial keywords, cost-type pain, existing paid tools. */
  willingnessToPay: number
  /** Breadth of affected audience: source diversity + distinct personas + industries. */
  marketBreadth:    number
  /** Evidence of inadequate existing solutions: workarounds, workaround pain-type, non-saturation. */
  poorSolutionFit:  number
  /** Can a solo/small team build this? Passes buildability filter + tech clarity. */
  feasibility:      number
  /** Is the timing right? Recency of signals + AI/automation momentum. */
  whyNow:           number
  /** Long-term moat potential: workflow depth, tech entanglement, cross-industry presence. */
  defensibility:    number
  /** Clarity of go-to-market: named personas, industry focus, community presence. */
  gtmClarity:       number
  /** Overall confidence in the score: 0–1. Low when signal count < 5. */
  confidence?:      number
}

// ─── PainSignal (extended — backward compatible) ──────────────────────────────

// ─── Corpus source lineage (Schema v2: internal corpus adapter) ──────────────

export type CorpusSourceType =
  | 'save'           // item bookmarked via saves[id]
  | 'document'       // uploaded or pasted document
  | 'manual_content' // user-added URL via manualContent[id]
  | 'topic_summary'  // AI-generated topic overview / brief section
  | 'brief'          // structured topic brief from generateTopicBrief

export interface PainSignal {
  id:             string
  detectedAt:     string         // ISO timestamp
  source:         'reddit' | 'hackernews' | 'youtube' | 'stackoverflow' | 'github'
                | 'producthunt' | 'indiehackers' | 'g2' | 'capterra'
                | 'twitter' | 'linkedin' | 'discord'
                | 'mobbin' | 'behance' | 'dribbble' | 'thefwa'
                | 'corpus'       // Schema v2: any internal corpus source
  sourceUrl:      string
  author?:        string
  painText:       string         // raw extracted text
  normalizedText: string         // lowercased, stopwords stripped, synonyms collapsed
  keyTerms:       string[]       // extracted from normalizedText
  painType:       PainType
  intensityScore: number         // 0–10
  clusterId?:     string
  queryUsed:      string
  // Schema v1: extracted entities (undefined on legacy signals)
  entities?:      SignalEntity[]
  // Schema v2: corpus lineage (only present on signals from ingestCorpus())
  corpusSourceId?:   string           // ID of the originating save / document / topic
  corpusSourceType?: CorpusSourceType
  corpusTopicId?:    string           // primary topic this content belongs to
  corpusTopicName?:  string           // human-readable topic name
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
  gapScore?:          number          // 0–100; demand-side roll-up (pain severity + urgency + gap + WTP)
  marketScore?:       number          // 0–100; market-side roll-up (breadth + frequency + chart data)
  buildabilityScore?: number          // 0–100; supply-side roll-up (feasibility + why-now + defensibility)
  // Three states: undefined = not yet scored, null = scored but no category matched,
  // string = matched category slug (e.g. 'productivity')
  inferredCategory?:  string | null
  // Schema v1: 10-dimension breakdown (undefined on legacy clusters scored before this upgrade)
  dimensionScores?: DimensionScores
  // Schema v1: aggregated entity summary for this cluster (undefined on legacy)
  entitySummary?: {
    personas:          string[]   // top persona values seen in cluster signals
    workflows:         string[]   // top workflow values
    technologies:      string[]   // top technology values
    workarounds:       string[]   // workaround values — strongest unmet-need evidence
    existingSolutions: string[]   // existing product/service names
    industries:        string[]   // sector context
  }
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
