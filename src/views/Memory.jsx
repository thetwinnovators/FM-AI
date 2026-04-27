import React from 'react';
import { mockMemory } from '../store/mockData';

export default function Memory() {
  return (
    <div className="scroll-area animate-fade-in">
      <header className="mb-6">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Interest Memory</h2>
        <p className="text-secondary text-sm">Your learned patterns, source preferences, and suggestion controls.</p>
      </header>

      <div className="flex gap-6">
        <div style={{ flex: 1 }} className="flex flex-col gap-6">
          <section className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 className="font-medium mb-4 text-sm uppercase tracking-wider text-secondary">Followed Topics</h3>
            <div className="flex flex-wrap gap-2">
              {mockMemory.followedTopics.map(topic => (
                <span key={topic} className="badge badge-purple">{topic}</span>
              ))}
              <button className="badge" style={{ cursor: 'pointer', borderStyle: 'dashed' }}>+ Add Topic</button>
            </div>
          </section>

          <section className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 className="font-medium mb-4 text-sm uppercase tracking-wider text-secondary">Preferred Sources</h3>
            <div className="flex flex-wrap gap-2">
              {mockMemory.preferredSources.map(source => (
                <span key={source} className="badge badge-emerald">{source}</span>
              ))}
            </div>
          </section>
        </div>

        <div style={{ flex: 1 }} className="flex flex-col gap-6">
          <section className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 className="font-medium mb-4 text-sm uppercase tracking-wider text-secondary">Suggestions</h3>
            <div className="flex flex-col gap-3">
              {mockMemory.suggestions.map((sug, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-md" style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <div>
                    <h4 className="font-medium text-sm">{sug.topic}</h4>
                    <p className="text-xs text-secondary mt-1">{sug.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="button button-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Approve</button>
                    <button className="button button-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
