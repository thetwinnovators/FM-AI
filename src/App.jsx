import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Search, Compass, Network, BookOpen, Brain, Map } from 'lucide-react';
import Home from './views/Home';
import Discover from './views/Discover';
import Topic from './views/Topic';
import GraphMap from './views/GraphMap';
import Education from './views/Education';
import Memory from './views/Memory';

function Sidebar() {
  const navItems = [
    { path: '/search', label: 'Home / Search', icon: Search },
    { path: '/discover', label: 'Discover', icon: Compass },
    { path: '/topic/t1', label: 'Topic Pages', icon: BookOpen }, // default to t1 for demo
    { path: '/graph', label: 'Flow Map', icon: Network },
    { path: '/education', label: 'Education', icon: Brain },
    { path: '/memory', label: 'Memory', icon: Map },
  ];

  return (
    <aside className="sidebar">
      <div className="p-6">
        <h1 className="text-xl text-gradient font-bold tracking-tight">FlowMap</h1>
        <p className="text-xs text-secondary mt-1">Topic Intelligence Workspace</p>
      </div>
      
      <nav className="flex-1 px-4 flex flex-col gap-2 mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive 
                  ? 'bg-[rgba(255,255,255,0.08)] text-white font-medium' 
                  : 'text-secondary hover:bg-[rgba(255,255,255,0.04)] hover:text-white'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-[rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold">
            JU
          </div>
          <div>
            <p className="text-sm font-medium">JenoU</p>
            <p className="text-xs text-secondary">Researcher</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/search" replace />} />
            <Route path="/search" element={<Home />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/topic/:id" element={<Topic />} />
            <Route path="/graph" element={<GraphMap />} />
            <Route path="/education" element={<Education />} />
            <Route path="/memory" element={<Memory />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
