import React from 'react';
import { mockTopics, mockMemory } from '../store/mockData';

export default function Home() {
  return (
    <div className="scroll-area animate-fade-in">
      <header className="mb-6">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Home / Search</h2>
        <p className="text-secondary text-sm">Discover and monitor your AI and tech interests.</p>
      </header>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <input 
          type="text" 
          className="search-input" 
          placeholder="Search topics, creators, or workflows... (e.g. 'Claude agents')" 
        />
      </div>

      <div className="flex gap-6" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 2 }}>
          <h3 className="font-medium mb-4">Tracked Topics</h3>
          <div className="flex flex-col gap-4">
            {mockTopics.map(topic => (
              <div key={topic.id} className="glass-card flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{topic.name}</h4>
                  <p className="text-xs text-secondary mt-1">{topic.followers.toLocaleString()} followers</p>
                </div>
                <span className={`badge ${topic.trend === 'up' ? 'badge-emerald' : 'badge-cyan'}`}>
                  {topic.trend === 'up' ? 'Trending Up' : 'Stable'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <h3 className="font-medium mb-4">Suggested for You</h3>
          <div className="flex flex-col gap-4">
            {mockMemory.suggestions.map((sug, i) => (
              <div key={i} className="glass-card">
                <h4 className="font-medium text-sm">{sug.topic}</h4>
                <p className="text-xs text-secondary mt-1">{sug.reason}</p>
                <button className="button button-outline mt-4" style={{ width: '100%' }}>Follow</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
