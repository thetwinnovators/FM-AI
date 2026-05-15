// ─── Record state machine ─────────────────────────────────────────────────────
export type VentureRecordState =
  | 'active'        // current live record
  | 'superseded'    // older version retained after refinement
  | 'archived'      // hidden from default views, preserved
  | 'deleted'       // user-requested, reversible within recovery window
  | 'hard_deleted'  // permanently removed after explicit confirmation

// ─── Multi-candidate concept ──────────────────────────────────────────────────
export interface VentureConceptCandidate {
  id:                     string
  clusterId:              string
  rank:                   number          // 1 = leading concept
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
  generatedBy:            'ollama' | 'template'
  status:                 VentureRecordState
  createdAt:              string
  updatedAt:              string
  // Optional expanded brief fields (populated by generateConcepts when available)
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

// ─── Evidence trace entry ─────────────────────────────────────────────────────
export interface EvidenceTraceEntry {
  sourceId:        string
  sourceType:      string
  topicId?:        string
  documentId?:     string
  evidenceSnippet: string
  extractedAt:     string
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
