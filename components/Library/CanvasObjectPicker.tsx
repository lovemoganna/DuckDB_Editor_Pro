import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface CanvasObjectPickerProps {
  objects: any[];
  objectTypes: any[];
  onSelect: (objectId: number) => void;
  onClose: () => void;
}

const CanvasObjectPicker: React.FC<CanvasObjectPickerProps> = ({ objects, objectTypes, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const filtered = objects.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 400,
          background: '#1a1a24',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600 }}>添加对象到画布</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div style={{ padding: 12 }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索对象名称..."
            style={{
              width: '100%', padding: '8px 12px',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#fff', outline: 'none',
            }}
          />
        </div>
        <div style={{ maxHeight: 300, overflow: 'auto', padding: '0 12px 12px' }}>
          {filtered.map(obj => (
            <button
              key={obj.id}
              onClick={() => { onSelect(obj.id); onClose(); }}
              style={{
                width: '100%', padding: 12, borderRadius: 10,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                marginBottom: 4, textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500 }}>{obj.name}</span>
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CanvasObjectPicker;
