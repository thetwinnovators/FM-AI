import { useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import LeftRail from './components/layout/LeftRail.jsx'
import TopBar from './components/layout/TopBar.jsx'
import ConfirmProvider from './components/ui/ConfirmProvider.jsx'
import BackToTop from './components/ui/BackToTop.jsx'
import { useStore } from './store/useStore.js'
import { useIngestionWorker } from './flow-ai/hooks/useIngestionWorker.js'
import Discover from './views/Discover.jsx'
import Search from './views/Search.jsx'
import Topics from './views/Topics.jsx'
import Topic from './views/Topic.jsx'
import FlowMap from './views/FlowMap.jsx'
import Education from './views/Education.jsx'
import Memory from './views/Memory.jsx'
import Documents from './views/Documents.jsx'
import Document from './views/Document.jsx'
import Chat from './views/Chat.jsx'
import Signals from './views/Signals.jsx'
import MCPIntegrationsPage from './mcp/pages/MCPIntegrationsPage.jsx'
import MCPIntegrationDetailPage from './mcp/pages/MCPIntegrationDetailPage.jsx'
import MCPToolCatalogPage from './mcp/pages/MCPToolCatalogPage.jsx'
import MCPExecutionLogPage from './mcp/pages/MCPExecutionLogPage.jsx'
import MCPToolDetailPage from './mcp/pages/MCPToolDetailPage.jsx'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="fm-page-enter">
      <Routes>
        <Route path="/" element={<FlowMap />} />
        <Route path="/flow" element={<FlowMap />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/search" element={<Search />} />
        <Route path="/topics" element={<Topics />} />
        <Route path="/topic/:slug" element={<Topic />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/:id" element={<Document />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:id" element={<Chat />} />
        <Route path="/education" element={<Education />} />
        <Route path="/memory" element={<Memory />} />
        <Route path="/connections" element={<MCPIntegrationsPage />} />
        <Route path="/connections/tools" element={<MCPToolCatalogPage />} />
        <Route path="/connections/tools/:toolId" element={<MCPToolDetailPage />} />
        <Route path="/connections/log" element={<MCPExecutionLogPage />} />
        <Route path="/connections/:id" element={<MCPIntegrationDetailPage />} />
      </Routes>
    </div>
  )
}

/**
 * Mounts the background ingestion worker once the store is available.
 * Kept as a separate component so the worker only activates inside the
 * React tree where useStore is valid.
 */
function IngestionWorker() {
  const { documents, documentContents } = useStore()
  useIngestionWorker(documents, documentContents)
  return null
}

export default function App() {
  const mainRef = useRef(null)
  return (
    <BrowserRouter>
      <ConfirmProvider>
        <IngestionWorker />
        <div className="flex h-full">
          <LeftRail />
          <div className="flex flex-col flex-1 min-w-0">
            <TopBar />
            <main ref={mainRef} className="flex-1 overflow-auto m-3 mt-3">
              <div className="glass-panel min-h-full overflow-clip">
                <AnimatedRoutes />
              </div>
            </main>
          </div>
        </div>
        <BackToTop scrollRef={mainRef} />
      </ConfirmProvider>
    </BrowserRouter>
  )
}
