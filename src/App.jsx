import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LeftRail from './components/layout/LeftRail.jsx'
import TopBar from './components/layout/TopBar.jsx'
import Discover from './views/Discover.jsx'
import Search from './views/Search.jsx'
import Topics from './views/Topics.jsx'
import Topic from './views/Topic.jsx'
import FlowMap from './views/FlowMap.jsx'
import Education from './views/Education.jsx'
import Memory from './views/Memory.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-full">
        <LeftRail />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar />
          <main className="flex-1 overflow-auto m-3 mt-3">
            <div className="glass-panel min-h-full overflow-clip">
              <Routes>
                <Route path="/" element={<FlowMap />} />
                <Route path="/flow" element={<FlowMap />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/search" element={<Search />} />
                <Route path="/topics" element={<Topics />} />
                <Route path="/topic/:slug" element={<Topic />} />
                <Route path="/education" element={<Education />} />
                <Route path="/memory" element={<Memory />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
