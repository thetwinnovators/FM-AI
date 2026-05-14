import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import LeftRail from './components/layout/LeftRail.jsx'
import TopBar from './components/layout/TopBar.jsx'
import ConfirmProvider from './components/ui/ConfirmProvider.jsx'
import { ApprovalDialogProvider } from './components/ui/ApprovalDialog.jsx'
import BackToTop from './components/ui/BackToTop.jsx'
import QuickChatLauncher from './components/flow/QuickChatLauncher.jsx'
import RouteLoadingBar from './components/ui/RouteLoadingBar.jsx'
import { useStore } from './store/useStore.js'
import { useIngestionWorker } from './flow-ai/hooks/useIngestionWorker.js'
import { useMemoryIndex } from './memory-index/useMemoryIndex.js'
import { localMCPStorage } from './mcp/storage/localMCPStorage.js'
import { startPolling, stopPolling } from './mcp/services/telegramPollingService.js'
import { processTelegramCommand } from './mcp/services/telegramBotResponder.js'

// ─── Lazy route chunks ────────────────────────────────────────────────────────
// Each view is fetched on first visit and cached for the session. This splits
// the 815 KB monolith into ~18 separate on-demand chunks, dramatically
// reducing initial JS parse time and deferring bytes the user may never need.
const Discover               = lazy(() => import('./views/Discover.jsx'))
const Search                 = lazy(() => import('./views/Search.jsx'))
const Topics                 = lazy(() => import('./views/Topics.jsx'))
const Topic                  = lazy(() => import('./views/Topic.jsx'))
const FlowMap                = lazy(() => import('./views/FlowMap.jsx'))
const Education              = lazy(() => import('./views/Education.jsx'))
const Memory                 = lazy(() => import('./views/Memory.jsx'))
const Documents              = lazy(() => import('./views/Documents.jsx'))
const Document               = lazy(() => import('./views/Document.jsx'))
const Chat                   = lazy(() => import('./views/Chat.jsx'))
const Signals                = lazy(() => import('./views/Signals.jsx'))
const OpportunityRadar       = lazy(() => import('./views/OpportunityRadar.jsx'))
const MCPIntegrationsPage    = lazy(() => import('./mcp/pages/MCPIntegrationsPage.jsx'))
const MCPIntegrationDetailPage = lazy(() => import('./mcp/pages/MCPIntegrationDetailPage.jsx'))
const MCPToolCatalogPage     = lazy(() => import('./mcp/pages/MCPToolCatalogPage.jsx'))
const MCPExecutionLogPage    = lazy(() => import('./mcp/pages/MCPExecutionLogPage.jsx'))
const MCPToolDetailPage      = lazy(() => import('./mcp/pages/MCPToolDetailPage.jsx'))
const CodeAcademy            = lazy(() => import('./views/CodeAcademy.jsx'))
const Briefs                 = lazy(() => import('./views/Briefs.jsx'))
const OperatorWorkspace      = lazy(() => import('./views/OperatorWorkspace.jsx'))
const FlowTrade              = lazy(() => import('./views/FlowTrade.jsx'))
const GlobeView              = lazy(() => import('./views/GlobeView.jsx'))
const TerminalControlView    = lazy(() => import('./views/TerminalControlView.jsx'))
const OperatorSettings       = lazy(() => import('./views/OperatorSettings.jsx'))

// ─── Scroll restoration ───────────────────────────────────────────────────────
// Scrolls the main content panel to the top on every route change so the user
// always starts at the top when navigating to a new page.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

// ─── Routes ───────────────────────────────────────────────────────────────────
// Suspense wraps the route tree so the loading bar shows whenever a lazy chunk
// is being fetched (first visit to any page). The shell (LeftRail, TopBar)
// renders immediately — only the content area shows the fallback.
const WORKSPACE_ROUTES = ['/flow-trade', '/globe']

function AnimatedRoutes({ isWorkspace }) {
  const location = useLocation()
  return (
    <Suspense fallback={<RouteLoadingBar />}>
      <ScrollToTop />
      <div key={location.pathname} className={isWorkspace ? 'fm-page-enter h-full' : 'fm-page-enter'}>
        <Routes>
          <Route path="/"                              element={<FlowMap />} />
          <Route path="/flow"                          element={<FlowMap />} />
          <Route path="/discover"                      element={<Discover />} />
          <Route path="/signals"                       element={<Signals />} />
          <Route path="/radar"                         element={<OpportunityRadar />} />
          <Route path="/search"                        element={<Search />} />
          <Route path="/topics"                        element={<Topics />} />
          <Route path="/topic/:slug"                   element={<Topic />} />
          <Route path="/documents"                     element={<Documents />} />
          <Route path="/documents/:id"                 element={<Document />} />
          <Route path="/chat"                          element={<Chat />} />
          <Route path="/chat/:id"                      element={<Chat />} />
          <Route path="/education"                     element={<Education />} />
          <Route path="/code-academy"                  element={<CodeAcademy />} />
          <Route path="/briefs"                        element={<Briefs />} />
          <Route path="/operator"                      element={<OperatorWorkspace />} />
          <Route path="/operator/terminal"             element={<TerminalControlView />} />
          <Route path="/operator/settings"             element={<OperatorSettings />} />
          <Route path="/flow-trade"                    element={<FlowTrade />} />
          <Route path="/globe"                         element={<GlobeView />} />
          <Route path="/memory"                        element={<Memory />} />
          <Route path="/connections"                   element={<MCPIntegrationsPage />} />
          <Route path="/connections/tools"             element={<MCPToolCatalogPage />} />
          <Route path="/connections/tools/:toolId"     element={<MCPToolDetailPage />} />
          <Route path="/connections/log"               element={<MCPExecutionLogPage />} />
          <Route path="/connections/:id"               element={<MCPIntegrationDetailPage />} />
        </Routes>
      </div>
    </Suspense>
  )
}

// ─── Background workers ───────────────────────────────────────────────────────

// Keeps the Telegram bot polling alive for the whole session, not just while
// the /connections/telegram page is open. Mounts once inside DeferredWorkers.
function TelegramPollingWorker() {
  useEffect(() => {
    const integration = localMCPStorage.getIntegration('integ_telegram')
    const token  = integration?.config?.['token'] ?? ''
    const chatId = integration?.config?.['chatId'] ?? ''
    if (!token || !chatId || integration?.status !== 'connected') return

    startPolling(token, chatId, async (text, fromName) => {
      // Save inbound to local log
      localMCPStorage.saveTelegramMessage({
        id: `tcm_in_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        chatId,
        messageText: `${fromName}: ${text}`,
        receivedAt: new Date().toISOString(),
        status: 'received',
      })
      window.dispatchEvent(new CustomEvent('fm-telegram-inbound'))

      const reply = await processTelegramCommand(text, fromName)

      localMCPStorage.saveTelegramMessage({
        id: `tcm_out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        chatId,
        messageText: `FlowMap AI: ${reply.replace(/<[^>]+>/g, '')}`,
        receivedAt: new Date().toISOString(),
        status: 'processed',
      })
      window.dispatchEvent(new CustomEvent('fm-telegram-inbound'))

      return reply
    })

    return () => stopPolling()
  // Run once on mount — config is read from localStorage, won't change mid-session
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

function IngestionWorker() {
  const { documents, documentContents } = useStore()
  useIngestionWorker(documents, documentContents)
  return null
}

function MemoryIndexUpdater() {
  useMemoryIndex()
  return null
}

// requestIdleCallback polyfill — Safari doesn't support rIC; fall back to a
// short setTimeout so workers still mount soon but after the first paint.
const rIC = typeof window !== 'undefined' && window.requestIdleCallback
  ? (cb) => window.requestIdleCallback(cb, { timeout: 2000 })
  : (cb) => setTimeout(cb, 200)
const cIC = typeof window !== 'undefined' && window.cancelIdleCallback
  ? (id) => window.cancelIdleCallback(id)
  : (id) => clearTimeout(id)

// Defers background workers until the browser is idle after the first paint
// so they don't compete with the critical rendering path on startup.
function DeferredWorkers() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = rIC(() => setReady(true))
    return () => cIC(id)
  }, [])
  if (!ready) return null
  return (
    <>
      <TelegramPollingWorker />
      <IngestionWorker />
      <MemoryIndexUpdater />
    </>
  )
}

// ─── App root ─────────────────────────────────────────────────────────────────

function AppShell() {
  const location = useLocation()
  const mainRef = useRef(null)
  const isWorkspace = WORKSPACE_ROUTES.includes(location.pathname)

  return (
    <>
      <div className="flex h-full">
        <LeftRail />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar />
          <main
            ref={mainRef}
            className={`flex-1 m-3 mt-3 ${isWorkspace ? 'overflow-hidden' : 'overflow-auto'}`}
          >
            <div className={`glass-panel overflow-clip ${isWorkspace ? 'h-full' : 'min-h-full'}`}>
              <AnimatedRoutes isWorkspace={isWorkspace} />
            </div>
          </main>
        </div>
      </div>
      <BackToTop scrollRef={mainRef} />
      <QuickChatLauncher />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ConfirmProvider>
        <ApprovalDialogProvider>
          <DeferredWorkers />
          <AppShell />
        </ApprovalDialogProvider>
      </ConfirmProvider>
    </BrowserRouter>
  )
}
