import React, { useCallback } from 'react';
import ReactFlow, { 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState 
} from 'reactflow';
import 'reactflow/dist/style.css';
import { mockGraphData } from '../store/mockData';

// Custom node to match our design system
const CustomNode = ({ data }) => {
  const getBadgeClass = (type) => {
    switch(type) {
      case 'topic': return 'badge-cyan';
      case 'tool': return 'badge-purple';
      case 'concept': return 'badge-emerald';
      default: return 'badge-cyan';
    }
  };

  return (
    <div className="glass-card" style={{ padding: '10px 15px', minWidth: '120px', textAlign: 'center' }}>
      <div className="font-medium text-sm">{data.label}</div>
      <div className={`badge ${getBadgeClass(data.type)} mt-2`} style={{ fontSize: '0.6rem' }}>
        {data.type}
      </div>
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

export default function GraphMap() {
  const [nodes, setNodes, onNodesChange] = useNodesState(mockGraphData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(mockGraphData.edges);

  return (
    <div className="animate-fade-in" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '2rem 2rem 0 2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Flow Map</h2>
        <p className="text-secondary text-sm mb-4">Interactive visual map of topics, creators, and tools.</p>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="#ffffff" gap={24} size={1} opacity={0.05} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
