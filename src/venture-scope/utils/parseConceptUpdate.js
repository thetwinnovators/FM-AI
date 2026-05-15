/**
 * Parse an AI-generated markdown response into VentureConceptCandidate field updates.
 *
 * The AI typically responds with ## headings that map to known concept fields.
 * Any unrecognised sections are collected into `enhancementNotes`.
 * If the response has no headings at all, the full text is stored as `enhancementNotes`.
 *
 * Returns a new concept object merged from the existing concept + parsed updates.
 * Always sets `updatedAt` and `generatedBy: 'flow_ai_enhanced'`.
 */
export function parseConceptUpdate(aiText, existingConcept) {
  if (!aiText || !existingConcept) return existingConcept

  const lines = aiText.split('\n')

  // Collect [{ heading (lowercased), lineIdx }] in document order
  const headingEntries = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#{1,3}\s+(.+)$/)
    if (m) headingEntries.push({ heading: m[1].trim().toLowerCase(), lineIdx: i })
  }

  // Extract body text for each section
  const sections = {}
  for (let h = 0; h < headingEntries.length; h++) {
    const { heading, lineIdx } = headingEntries[h]
    const endIdx = h + 1 < headingEntries.length ? headingEntries[h + 1].lineIdx : lines.length
    const body = lines.slice(lineIdx + 1, endIdx).join('\n').trim()
    if (body) sections[heading] = body
  }

  // Ordered map: heading pattern aliases → concept field name
  const FIELD_MAP = [
    [['problem statement', 'problem'],                    'problemStatement'],
    [['proposed solution', 'solution'],                   'proposedSolution'],
    [['why now', 'why now?', 'timing'],                   'whyNow'],
    [['mvp scope', 'mvp', 'minimum viable product'],      'mvpScope'],
    [
      ['go-to-market', 'go to market', 'gtm', 'go-to-market angle', 'gtm angle'],
      'goToMarketAngle',
    ],
    [['metrics of success', 'success metrics', 'metrics'], 'successMetrics'],
    [['opportunity summary', 'summary', 'overview'],      'opportunitySummary'],
    [['target user', 'target audience', 'primary user'],  'targetUser'],
    [['value proposition', 'value prop'],                 'valueProp'],
    [['defensibility', 'moat'],                           'defensibility'],
    [['risks', 'key risks'],                              'risks'],
    [['tagline'],                                         'tagline'],
    [['core insight', 'core wedge'],                      'coreWedge'],
    [['pricing', 'pricing hypothesis', 'revenue model'],  'pricingHypothesis'],
    [['buyer vs user', 'buyer vs. user'],                 'buyerVsUser'],
    [['current alternatives', 'alternatives'],            'currentAlternatives'],
    [['existing workarounds', 'workarounds'],             'existingWorkarounds'],
    [['key assumptions', 'assumptions'],                  'keyAssumptions'],
    [['implementation plan'],                             'implementationPlan'],
    [['workflows', 'workflow'],                           'workflowAnalysis'],
    [['processes', 'process'],                            'processAnalysis'],
    [['trigger events', 'triggers'],                      'triggerEvents'],
    [['inputs & outputs', 'inputs and outputs'],          'inputsOutputs'],
    [['dependencies'],                                    'dependencies'],
    [['handoffs'],                                        'handoffs'],
    [['bottlenecks'],                                     'bottlenecks'],
    [['solution modality', 'modality', 'solution type'],  'solutionModality'],
    [['ai role', 'ai role in solution', 'role of ai'],    'aiRoleInSolution'],
    [['mvp exclusions', 'what does not ship', 'not in scope', 'out of scope'], 'mvpExclusions'],
    [['core workflows', 'core workflow steps', 'workflow steps'], 'coreWorkflows'],
    [['north star metric', 'core metrics', 'key metrics', 'metric'], 'metrics'],
    [['chosen interpretation', 'interpretation', 'selected interpretation'], 'chosenInterpretation'],
  ]

  const updates = {}
  const mappedKeys = new Set()

  for (const [patterns, field] of FIELD_MAP) {
    for (const pattern of patterns) {
      if (sections[pattern] && !mappedKeys.has(pattern)) {
        updates[field] = sections[pattern]
        mappedKeys.add(pattern)
        break
      }
    }
  }

  // Collect unrecognised sections into enhancementNotes
  const unmapped = Object.entries(sections)
    .filter(([key]) => !mappedKeys.has(key))
    .map(([key, val]) => `### ${key.charAt(0).toUpperCase() + key.slice(1)}\n${val}`)
    .join('\n\n')

  const hasUpdates = Object.keys(updates).length > 0
  const enhancementNotes = hasUpdates
    ? (unmapped || null)
    : (aiText.trim() || null)  // no headings found — store full prose

  return {
    ...existingConcept,
    ...updates,
    ...(enhancementNotes ? { enhancementNotes } : {}),
    updatedAt: new Date().toISOString(),
    generatedBy: 'flow_ai_enhanced',
  }
}
