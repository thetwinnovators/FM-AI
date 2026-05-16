import type {
  OpportunityCluster,
  PainSignal,
  ExtractedEntity,
  EntityRelationship,
  CorpusSourceType,
} from '../opportunity-radar/types.js'

// ─── Record state machine ─────────────────────────────────────────────────────
export type VentureRecordState =
  | 'active'        // current live record
  | 'superseded'    // older version retained after refinement
  | 'archived'      // hidden from default views, preserved
  | 'deleted'       // user-requested, reversible within recovery window
  | 'hard_deleted'  // permanently removed after explicit confirmation

// ─── Opportunity frame ────────────────────────────────────────────────────────
// The structured packet built from the entity graph before concept generation.
// Replaces raw cluster + pain signals as the primary input to generateConcepts().
// Every field is derived deterministically from the graph — no invented content.

export interface OpportunityFrame {
  cluster:           OpportunityCluster

  // Entities from the cluster's signals, sorted by frequency descending
  personas:          ExtractedEntity[]   // who experiences the problem
  workflows:         ExtractedEntity[]   // what processes are affected
  workarounds:       ExtractedEntity[]   // what people do instead of a real tool
  technologies:      ExtractedEntity[]   // platforms and tools in context
  bottlenecks:       ExtractedEntity[]   // specific steps that block progress
  platformShifts:    ExtractedEntity[]   // macro changes creating new windows
  emergingTech:      ExtractedEntity[]   // new capabilities enabling new approaches
  buyerRoles:        ExtractedEntity[]   // who controls budget
  existingSolutions: ExtractedEntity[]   // named tools with known gaps
  industries:        ExtractedEntity[]   // sector context

  // Relationships where both endpoints exist in the cluster entity set
  relationships:     EntityRelationship[]

  // Signals from this cluster with full corpus lineage
  signals:           PainSignal[]
}

// ─── Resolved source link ─────────────────────────────────────────────────────
// Produced by sourceResolver.ts — maps a (sourceId, sourceType) pair to
// navigable display metadata for rendering in the evidence trace.

export interface ResolvedSourceLink {
  label:         string          // e.g. "Saved item", "Document"
  title?:        string          // item title from the store
  date?:         string          // ISO date from savedAt / createdAt
  externalUrl?:  string          // open in new tab
  internalPath?: string          // React Router path to navigate to
  canNavigate:   boolean         // false if record deleted or type unsupported
  notFound:      boolean         // true if sourceId not in store
}

// ─── Dimension drivers ────────────────────────────────────────────────────────
// Each driver explains one contribution to a dimension score.

export interface DimensionDriver {
  type:           'signal' | 'entity' | 'flag'
  signalId?:      string        // for type='signal': the PainSignal id
  signalSnippet?: string        // first 120 chars of painText
  entityValue?:   string        // for type='entity': the entity value
  entityType?:    string        // for type='entity': the entity type
  flagKey?:       string        // for type='flag': machine key for the flag
  label:          string        // human-readable explanation
  contribution:   'positive' | 'negative'
  pointValue?:    number        // approximate score impact
}

export type DimensionDriverMap = Partial<Record<
  | 'painSeverity' | 'frequency' | 'urgency' | 'willingnessToPay'
  | 'marketBreadth' | 'poorSolutionFit' | 'feasibility'
  | 'whyNow' | 'defensibility' | 'gtmClarity',
  DimensionDriver[]
>>

// ─── Evidence trace entry ─────────────────────────────────────────────────────
// Every claim in a venture brief must trace back to a specific source item
// in the user's research corpus. Anonymous graph data should not exist.

export interface EvidenceTraceEntry {
  signalId?:       string          // the PainSignal that produced this evidence
  sourceId:        string          // corpusSourceId — save/document/topic/brief ID
  sourceType:      string          // CorpusSourceType: save | document | topic_summary | brief
  topicId?:        string          // primary topic this content belongs to
  documentId?:     string          // populated when sourceType === 'document'
  evidenceSnippet: string          // the actual text from the source item
  extractedAt:     string          // ISO timestamp
  entityType?:     string          // which entity type made this signal relevant
}

// ─── Evidence snippet ────────────────────────────────────────────────────────
export interface EvidenceSnippet {
  text:       string            // up to 200 chars of painText
  sourceType: CorpusSourceType  // corpus source category
}

// ─── LLM contract types ───────────────────────────────────────────────────────
// VentureScopeLLMInput is the ONLY packet the LLM receives — every value is
// derived deterministically from the entity graph and dimension scores.
// No corpusSourceIds, no cluster IDs, no internal references are exposed.

export interface VentureScopeLLMInput {
  clusterName:      string
  angleType:        'persona_first' | 'workflow_first' | 'technology_enablement'
  angleDescription: string   // human-readable description of the strategic angle
  coreWedge:        string   // deterministic wedge statement built before the LLM call

  opportunityScore: number   // 0–100
  isBuildable:      boolean

  // Human-readable scoring summary — one entry per notable dimension
  // Example: "High willingness-to-pay (72/100)"
  scoreSummary: string[]

  // Entity values only — no IDs, no metadata
  graphContext: {
    personas:          string[]
    workflows:         string[]
    workarounds:       string[]
    bottlenecks:       string[]
    existingSolutions: string[]
    emergingTech:      string[]   // merged from frame.emergingTech + frame.platformShifts
    industries:        string[]
    technologies:      string[]
  }

  // Plaintext evidence excerpts — no corpusSourceIds exposed to the model
  evidenceSnippets: EvidenceSnippet[]

  // Optional ambiguity hint — populated by assessConceptAmbiguity() before the
  // LLM call. Present when level is 'medium' or 'high'. The LLM is instructed
  // to select the narrowest plausible interpretation rather than hallucinating.
  ambiguityHint?: {
    level: 'medium' | 'high'
    flags: string[]
    recommendedInterpretations: string[]
  }
}

// ─── Solution modality ────────────────────────────────────────────────────────
// Classifies what kind of solution the opportunity calls for.
// Venture Scope solutions are NOT required to be AI-first. The evidence drives
// the modality — not a default assumption. Choose the modality that best fits
// the challenge, users, industry, buyer, workflow, and operational constraints.
//
// rules_based:            Deterministic rules, decision trees, structured logic. No AI.
// ai_assisted:            AI assists a human workflow. Humans retain decision authority.
// ai_native:              AI is the core mechanism. Without it the product does not exist.
// hybrid_workflow_ai:     Structured workflow orchestration with AI at specific decision or enrichment points.
// workflow_automation:    Software-driven workflow automation without meaningful AI; replaces manual steps.
// orchestration_layer:    Coordinates multiple systems, APIs, or agents; intelligence is in the orchestration logic.
// analytics_monitoring:   Surfaces data, trends, or anomalies; primary value is visibility and measurement.
// governance_compliance:  Enforces rules, policies, or compliance requirements; correctness > intelligence.
// infrastructure_platform: Foundational layer that other systems run on; developer or operator tool.
// service_software_hybrid: Human service delivery augmented or scoped by software; people deliver the value.
// marketplace:            Connects supply and demand; product value is in the network and matching logic.
// other:                  Does not fit cleanly into any above category.
export type SolutionModality =
  | 'rules_based'
  | 'ai_assisted'
  | 'ai_native'
  | 'hybrid_workflow_ai'
  | 'workflow_automation'
  | 'orchestration_layer'
  | 'analytics_monitoring'
  | 'governance_compliance'
  | 'infrastructure_platform'
  | 'service_software_hybrid'
  | 'marketplace'
  | 'other'

// The LLM writes ONLY these narrative synthesis fields.
// Scoring, IDs, evidence trace, rank, and structural metadata stay deterministic.
// All fields required and non-empty — parseVentureScopeLLMOutput enforces this.
export interface VentureScopeLLMOutput {
  title:               string
  tagline:             string
  opportunitySummary:  string
  problemStatement:    string
  targetUser:          string
  proposedSolution:    string
  valueProp:           string
  whyNow:              string
  buyerVsUser:         string
  currentAlternatives: string
  existingWorkarounds: string
  keyAssumptions:      string
  successMetrics:      string
  pricingHypothesis:   string
  defensibility:       string
  goToMarketAngle:     string
  mvpScope:            string
  risks:               string
  // Guardrail fields — modality classification prevents generic "AI wrapper" concepts.
  // LLM must classify these before writing any solution content.
  solutionModality:    SolutionModality
  aiRoleInSolution:    string   // Specific sentence: "AI does X in Y step", or "N/A" if AI is not central
  // Interpretation fields — draft concept skepticism.
  // The model is required to reason about alternative interpretations before picking one.
  // These are optional/supplementary: small models may omit them; parser falls back to '—'.
  chosenInterpretation?:    string   // "The specific workflow-level opportunity this brief addresses"
  alternateInterpretations?: string  // "1–2 alternatives considered (user | context | modality)"
}

// ─── Multi-candidate concept ──────────────────────────────────────────────────
export interface VentureConceptCandidate {
  id:                     string
  clusterId:              string
  rank:                   number          // 1 = leading concept
  angleType?:             'persona_first' | 'workflow_first' | 'technology_enablement'
  title:                  string
  tagline:                string
  coreWedge:              string
  primaryUser:            string
  buyer:                  string
  workflowImprovement:    string
  whyNow:                 string
  complexityEstimate:     'low' | 'medium' | 'high'
  revenueModelHypothesis: string
  opportunityScore:       number
  confidenceScore:        number
  generatedBy:            'ollama' | 'template' | 'graph' | 'flow_ai_enhanced'
  status:                 VentureRecordState
  createdAt:              string
  updatedAt:              string
  // Evidence trace — every candidate carries source lineage for its claims
  evidenceTrace?:         EvidenceTraceEntry[]
  // Optional expanded brief fields
  opportunitySummary?:    string
  problemStatement?:      string
  targetUser?:            string
  proposedSolution?:      string
  valueProp?:             string
  mvpScope?:              string
  risks?:                 string
  implementationPlan?:    string
  buyerVsUser?:           string
  currentAlternatives?:   string
  existingWorkarounds?:   string
  keyAssumptions?:        string
  successMetrics?:        string
  pricingHypothesis?:     string
  defensibility?:         string
  goToMarketAngle?:       string
  roiModel?:              RoiModel
  // ── Modality & AI role ──────────────────────────────────────────────────────
  solutionModality?:       SolutionModality
  aiRoleInSolution?:       string

  // ── Workflow analysis fields (set by parseConceptUpdate from FLOW.AI response) ─
  workflowAnalysis?:       string   // end-to-end workflow map
  processAnalysis?:        string   // business process integration
  triggerEvents?:          string   // "oh no" moments that cause product reach
  inputsOutputs?:          string   // what enters/exits the system
  dependencies?:           string   // APIs, integrations, upstream systems
  handoffs?:               string   // human/system transition points
  bottlenecks?:            string   // failure points and adoption blockers (narrative)
  enhancementNotes?:       string   // unstructured FLOW.AI additions

  // ── Ambiguity assessment (set by assessConceptAmbiguity before prompt dispatch) ─
  ambiguityLevel?:             'low' | 'medium' | 'high'
  ambiguityFlags?:             string[]   // e.g. ["vague cluster name", "low signal count"]
  chosenInterpretation?:       string     // which interpretation was selected
  alternateInterpretations?:   string[]   // other valid readings of the cluster
  evidenceBoundaries?:         string     // what the evidence does/doesn't support

  // ── Extended brief fields (from FLOW.AI enhancement) ───────────────────────
  mvpExclusions?:          string   // explicitly what is OUT of MVP scope
  coreWorkflows?:          string   // 3-5 core workflow steps
  metrics?:                string   // north star + leading/lagging indicators
}

// ─── ROI Model ────────────────────────────────────────────────────────────────
export interface RoiModel {
  estimatedValueCreation:    string
  estimatedCostToBuild:      string
  estimatedTimeToMvp:        string
  estimatedCostOfProblem:    string
  efficiencyGainPotential:   string
  revenuePotentialScenarios: string
  paybackPeriod:             string
  confidenceBand:            'low' | 'medium' | 'high'
}

// ─── Score breakdown entry ────────────────────────────────────────────────────
export interface ScoreBreakdownEntry {
  dimension:   string
  score:       number
  explanation: string
  confidence:  number
}

// ─── Scan meta ────────────────────────────────────────────────────────────────
export interface VentureScanMeta {
  lastScanAt:      string | null
  totalSignals:    number
  totalClusters:   number
  totalConcepts:   number
  scanDurationMs?: number
  corpusCoverage?: number   // 0–1: fraction of corpus items scanned
}
