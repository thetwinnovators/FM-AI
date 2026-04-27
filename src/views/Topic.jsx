import React from 'react';
import { useParams } from 'react-router-dom';
import { mockTopics, mockContent, mockLearningCards } from '../store/mockData';

export default function Topic() {
  const { id } = useParams();
  // In a real app we'd fetch topic details. Using a hardcoded ID or the first topic for mock purposes.
  const topicId = id || 't1';
  const topic = mockTopics.find(t => t.id === topicId) || mockTopics[0];
  
  const relatedContent = mockContent.filter(c => c.topics.includes(topicId));
  const learningCards = mockLearningCards.filter(l => l.topicId === topicId);

  return (
    <div className="scroll-area animate-fade-in">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }} className="text-gradient">{topic.name}</h2>
          <p className="text-secondary text-sm">Canonical topic page and research stream.</p>
        </div>
        <button className="button button-primary">Following</button>
      </header>

      <div className="flex gap-6" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 2 }} className="flex flex-col gap-6">
          <section className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 className="font-medium mb-2">Topic Summary</h3>
            <p className="text-sm text-secondary leading-relaxed">
              This topic tracks developments around {topic.name}, including major tooling updates, new workflows, and ecosystem changes. 
              Currently trending upwards in the developer community.
            </p>
          </section>

          <section>
            <h3 className="font-medium mb-4">Latest Content</h3>
            <div className="flex flex-col gap-4">
              {relatedContent.length > 0 ? relatedContent.map(item => (
                <div key={item.id} className="glass-card">
                  <h4 className="font-medium text-sm mb-1">{item.title}</h4>
                  <p className="text-xs text-secondary">{item.source} • {item.author}</p>
                </div>
              )) : (
                <p className="text-sm text-secondary">No recent content found.</p>
              )}
            </div>
          </section>
        </div>

        <div style={{ flex: 1 }} className="flex flex-col gap-6">
          {learningCards.length > 0 && (
            <section>
              <h3 className="font-medium mb-4">Core Concepts</h3>
              <div className="flex flex-col gap-4">
                {learningCards.map(card => (
                  <div key={card.id} className="glass-card">
                    <h4 className="font-medium text-sm mb-2 text-gradient">{card.concept}</h4>
                    <p className="text-xs text-secondary">{card.explanation}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 className="font-medium mb-4">Signals</h3>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-[rgba(255,255,255,0.08)] pb-2">
                <span className="text-sm text-secondary">Followers</span>
                <span className="font-medium">{topic.followers.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[rgba(255,255,255,0.08)] pb-2">
                <span className="text-sm text-secondary">Trend</span>
                <span className={`badge ${topic.trend === 'up' ? 'badge-emerald' : 'badge-cyan'}`}>
                  {topic.trend}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
