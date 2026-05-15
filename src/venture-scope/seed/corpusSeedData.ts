/**
 * corpusSeedData — static venture briefs injected into every Venture Scope scan.
 *
 * These items are NOT stored in localStorage. They live in the bundle and are
 * available on every scan regardless of localStorage quota or reset state.
 *
 * The primary purpose is to provide high-quality B2B/platform opportunity
 * examples to the signal-extraction and clustering pipeline, ensuring the
 * scoring model is calibrated against real enterprise-scale opportunities —
 * not just solo-developer personal tools.
 *
 * Format: each item is a pre-formatted RawSearchResult ready for ingestCorpus().
 * CorpusSourceType is 'brief' — these are treated as user-authored venture briefs.
 */

export interface SeedCorpusItem {
  id:              string
  title:           string
  body:            string
  publishedAt:     string
}

/**
 * Static seed corpus.
 * Add new example briefs here — they will be ingested on every scan.
 */
export const SEED_CORPUS_ITEMS: SeedCorpusItem[] = [
  {
    id:          'seed_ai_governance_studio_v1',
    publishedAt: '2025-01-01T00:00:00.000Z',
    title:       'AI Agent Governance Studio — Venture Brief',
    body: `
Opportunity summary: Enterprises are deploying AI agents across HR, legal, media, and customer
operations but have no structured way to define scope, set guardrails, audit decisions, or safely
roll out policy changes. The gap is not AI capability — it is AI governance. Every enterprise team
building on foundation models needs a policy engine, and none of the model providers or framework
companies are positioned to own the governance layer.

Problem statement: Enterprise teams spend weeks building bespoke agent pipelines from scratch, only
to discover they have no way to audit AI decisions, no enforcement mechanism for business rules, and
no safe path for non-technical domain operators to modify agent behaviour without breaking production
workflows. Existing tools do not solve the governance layer: prompt engineering platforms such as
PromptLayer and Helicone log and observe but do not enforce scope or guardrails. Low-code AI
workflow builders such as Zapier and Make build automation but have no policy engine. Custom internal
tooling on LangChain or LlamaIndex gives control but requires engineering effort for every rule
change. No dedicated product sits between the LLM and the production workflow to enforce policy,
scope, and accountability at enterprise scale.

Target users: Product managers deploying AI workflows inside their product who need to configure
agent behaviour without writing code. CTOs and VP Engineering leads who are accountable for AI
reliability, compliance, and risk management across their organisation. Domain operators — HR
directors, legal operations leads, media editorial managers — who are responsible for AI-assisted
decisions and need visibility and override capability without depending on engineering. Enterprises
with 50 to 2000 employees already running at least one production AI workflow who feel the
governance gap acutely.

Buyer versus user: CTO or VP Engineering is the economic buyer and signs the contract. Product
managers and domain operators are the daily users who interact with the governance configuration and
audit interfaces. The purchase decision is driven by risk reduction and compliance framing for the
CTO. The daily value is control, visibility, and audit capability for the operator. These are
different jobs, different success criteria, and require different product surfaces. Selling to the
buyer and designing for the user is a critical product insight for this category.

Current alternatives and gaps: PromptLayer and Helicone provide observability for prompts and
model calls but do not enforce guardrails or scope limits. Zapier and Make handle workflow
automation but have no governance or policy layer. LangChain and LlamaIndex are developer
primitives for building orchestration but require every team to implement their own governance
logic from scratch. OpenAI and Anthropic system prompts offer basic constraint setting but no
audit log, no human-review queue, no role-based access, and no change management for governance
policies. Every enterprise team builds their own governance layer once, poorly, inconsistently,
with no institutional memory. No dedicated standalone governance product exists.

Proposed solution: A governed agent orchestration layer that gives non-technical stakeholders
visibility and control over AI agent behaviour without writing code. Operators define what agents
can do (scope), what they must verify before acting (guardrails), and what gets logged for audit
(action trails). AI engineers configure the underlying models and tools once through an API or
SDK. The product is the policy engine positioned between the LLM and production — not the model
and not the application. Core components: workflow template library for common enterprise use
cases across HR, legal, and operations; guardrail configuration UI that non-engineers can use;
action log with human-review queue for high-stakes decisions requiring operator oversight; sandbox
environment for safe policy testing before production rollout.

Value proposition: Enterprises deploy AI agents to production workflows faster with governance
tooling that satisfies legal, compliance, and stakeholder oversight requirements without slowing
AI engineering teams. Specific benefits: reduced time from AI prototype to production deployment,
clear accountability chain for AI-assisted decisions that satisfies audit requirements, and
operator-controlled scope that removes bottlenecks on the AI engineering team. The governance
layer doubles as institutional knowledge — every workflow policy, every guardrail, every exception
is documented automatically in a queryable audit log.

Why now: Enterprise AI deployments have hit a governance wall. Model capability is no longer the
primary blocker — operational accountability and compliance are. Every team building on foundation
models now needs a policy layer, and the market is forming before regulation mandates it. OpenAI
and Anthropic sell capability. LangChain and LlamaIndex sell orchestration primitives. Nobody owns
the enterprise-grade governance layer that turns those primitives into auditable, compliant,
stakeholder-controlled workflows. The window is open: the pain is acute, no incumbent owns the
space, and the technical infrastructure for building it (LLM APIs at accessible cost, reliable
tool-calling, structured output) is production-ready today.

Defensibility: Owning the governance layer means owning the audit log, the scope definitions, and
the approval workflow history. These become compliance artifacts that are structurally impossible to
migrate away from without business disruption. Network effects from multi-team deployment within an
enterprise reinforce lock-in — the more workflows that run through the governance layer, the more
valuable the institutional audit history and the harder the replacement decision becomes. Early
movers also define the vocabulary of enterprise AI governance: their policy templates, their risk
taxonomies, and their compliance frameworks become the category default.

Go-to-market strategy: Narrow vertical wedge targeting HR technology or legal operations first —
both sectors have explicit compliance mandates that make governance a non-optional purchase rather
than a discretionary one. Sell directly to CTOs or Heads of AI at mid-market companies with 50 to
2000 employees already running at least one production AI workflow. These buyers feel the
governance pain acutely and have budget authority. Design partner programme with two to three
enterprise design partners in the first quarter to validate the governance framework before scaling
sales. Enterprise sales cycle is 6 to 12 months — plan for that timeline in the financial model
and ensure sufficient runway.

MVP scope: Two predefined workflow templates — AI-assisted hiring screening and AI contract review
flagging — representing the HR and legal verticals with the clearest compliance mandates. Guardrail
configuration UI that domain operators can use without writing code. Action log with human-review
queue for decisions above a confidence threshold. Sandbox environment for testing policy changes
before production rollout. Role separation between engineers who configure models and tools and
operators who configure scope and guardrails. Explicit v1 exclusions: no general-purpose agent
builder, no marketplace of third-party integrations, no custom LLM provider support beyond OpenAI
and Anthropic, no mobile interface, no self-serve billing and provisioning. Narrow and deep beats
broad and shallow for enterprise trust and compliance credibility.

Risks and failure modes: LLM framework fatigue — enterprises are being pitched new AI tooling
every week and procurement cycles require executive sponsorship and legal review. Enterprise sales
cycles of 6 to 12 months mean slow early revenue even with strong customer interest. Model
providers could ship native governance layers, directly commoditising the standalone product
category. Governance can be perceived as compliance overhead rather than value creation — the
positioning must lead with deployment speed and operator empowerment, not with risk and restriction.
Technical risk that agent behaviour is sufficiently non-deterministic to make policy enforcement
brittle in production.

Key assumptions: Mid-market enterprises will pay for governance tooling before regulators mandate
it. The policy layer is a distinct product category and not just a feature of existing LLM
platforms. CTOs prioritise governance and accountability over engineering flexibility at production
scale. Domain operators — HR, legal, media — will adopt the tool if it gives them meaningful
control without requiring engineering involvement. The enterprise AI deployment wave continues to
accelerate and the governance gap deepens over the next 24 months.

Success metrics: Time from first sales conversation to signed contract under 90 days for design
partners. At least two production AI workflows running through the governance layer at each design
partner within 60 days of deployment. Net Promoter Score above 40 from domain operator users
after 30 days. Engineering team reports zero unplanned interruptions to fix governance
configuration issues after initial setup.

Implementation phases: Phase one over months one to three — core governance engine covering
workflow scope definition, guardrail configuration, and action logging, with two enterprise design
partners for validation and co-development. Phase two over months four to six — human-in-the-loop
review queue, sandbox mode, audit trail export, and first paid pilots targeting HR and legal
operations. Phase three over months seven to twelve — multi-agent orchestration support,
role-based access control for operator and engineer personas, compliance reporting dashboard.
Phase four in year two — enterprise single sign-on, policy-as-code export for version control
integration, marketplace of governance templates for common enterprise workflows, expansion to
additional verticals beyond HR and legal.

Pricing hypothesis: Annual enterprise contract with per-seat licensing for operator users, priced
at approximately 200 to 500 dollars per seat per year for mid-market accounts. Separate
engineering tier for the API and SDK layer at a flat platform fee. Free trial limited to sandbox
mode to remove adoption friction while protecting production workflow data. First design partners
receive founding-customer pricing at significant discount in exchange for co-development
participation and reference customer status.
`.trim(),
  },
]
