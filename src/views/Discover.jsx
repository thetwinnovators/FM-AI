import React from 'react';
import { mockContent } from '../store/mockData';
import { Play, FileText, MessageSquare, Bookmark } from 'lucide-react';

export default function Discover() {
  const getIcon = (type) => {
    switch(type) {
      case 'video': return <Play size={16} />;
      case 'article': return <FileText size={16} />;
      case 'social': return <MessageSquare size={16} />;
      default: return <FileText size={16} />;
    }
  };

  return (
    <div className="scroll-area animate-fade-in">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Discover Feed</h2>
          <p className="text-secondary text-sm">Freshly found content based on your tracked topics.</p>
        </div>
        <div className="flex gap-2">
          <button className="button button-outline">All Formats</button>
          <button className="button button-outline">Latest</button>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        {mockContent.map(item => (
          <div key={item.id} className="glass-card flex gap-4">
            <div className="text-secondary" style={{ marginTop: '0.25rem' }}>
              {getIcon(item.type)}
            </div>
            <div style={{ flex: 1 }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-secondary">{item.source}</span>
                <span className="text-xs text-secondary">•</span>
                <span className="text-xs text-secondary">{item.date}</span>
                <span className="text-xs text-secondary">•</span>
                <span className="text-xs text-secondary">{item.author}</span>
              </div>
              <h3 className="font-medium mb-2">{item.title}</h3>
              <p className="text-sm text-secondary mb-4">{item.relevance}</p>
              <div className="flex gap-2">
                {item.topics.map(t => (
                  <span key={t} className="badge badge-cyan">Topic {t}</span>
                ))}
              </div>
            </div>
            <div>
              <button className={`button ${item.saved ? 'button-primary' : 'button-outline'}`}>
                <Bookmark size={16} fill={item.saved ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
