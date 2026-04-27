import React from 'react';
import { mockLearningCards } from '../store/mockData';

export default function Education() {
  return (
    <div className="scroll-area animate-fade-in">
      <header className="mb-6">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Education</h2>
        <p className="text-secondary text-sm">Transform repeated concepts into structured learning artifacts.</p>
      </header>

      <div className="flex flex-col gap-6">
        {mockLearningCards.map(card => (
          <div key={card.id} className="glass-panel" style={{ padding: '2rem' }}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gradient">{card.concept}</h3>
              <button className="button button-outline">Mark as Learned</button>
            </div>
            
            <div className="flex flex-col gap-4 mt-6">
              <div>
                <h4 className="text-sm font-medium text-secondary mb-1 uppercase tracking-wide">Explanation</h4>
                <p className="text-sm leading-relaxed">{card.explanation}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-secondary mb-1 uppercase tracking-wide">Why it matters</h4>
                <p className="text-sm leading-relaxed border-l-2 border-accent-cyan pl-3" style={{ borderColor: 'var(--accent-cyan)' }}>
                  {card.whyItMatters}
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-secondary mb-1 uppercase tracking-wide">Applied Example</h4>
                <div className="bg-[rgba(0,0,0,0.3)] rounded-md p-4 text-sm font-mono text-[var(--accent-emerald)] border border-[rgba(255,255,255,0.05)]">
                  {card.example}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
