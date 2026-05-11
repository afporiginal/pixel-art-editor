import React, { useState } from 'react';
import { Frame } from '../types';

interface Props {
  frame: Frame;
  currentLayerIndex: number;
  setCurrentLayer: (index: number) => void;
  addLayer: () => void;
  removeLayer: (index: number) => void;
  toggleLayerVisibility: (index: number) => void;
  setLayerOpacity: (index: number, opacity: number) => void;
  renameLayer: (index: number, name: string) => void;
  moveLayer: (from: number, to: number) => void;
}

export const LayersPanel: React.FC<Props> = ({
  frame,
  currentLayerIndex,
  setCurrentLayer,
  addLayer,
  removeLayer,
  toggleLayerVisibility,
  setLayerOpacity,
  renameLayer,
  moveLayer,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const startRename = (index: number) => {
    setEditingIndex(index);
    setEditName(frame.layers[index].name);
  };

  const commitRename = () => {
    if (editingIndex !== null && editName.trim()) {
      renameLayer(editingIndex, editName.trim());
    }
    setEditingIndex(null);
  };

  return (
    <div className="bg-[#16213e] border-b border-[#0f3460] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Layers</span>
        <button
          onClick={addLayer}
          className="text-xs bg-[#0f3460] hover:bg-[#e94560] text-white px-2 py-0.5 rounded transition-colors"
        >
          + Add
        </button>
      </div>

      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
        {[...frame.layers].reverse().map((layer, reversedIdx) => {
          const idx = frame.layers.length - 1 - reversedIdx;
          const isActive = idx === currentLayerIndex;

          return (
            <div
              key={layer.id}
              onClick={() => setCurrentLayer(idx)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors group ${
                isActive
                  ? 'bg-[#e94560]/20 border border-[#e94560]/50'
                  : 'bg-[#1a1a2e] border border-transparent hover:border-[#0f3460]'
              }`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(idx); }}
                className={`text-sm flex-shrink-0 ${layer.visible ? 'opacity-100' : 'opacity-30'}`}
                title={layer.visible ? 'Hide' : 'Show'}
              >
                {layer.visible ? '👁️' : '👁️‍🗨️'}
              </button>

              {editingIndex === idx ? (
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); }}
                  className="flex-1 bg-[#0f3460] text-white text-xs px-1 py-0.5 rounded outline-none border border-[#e94560]"
                  autoFocus
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span
                  className="flex-1 text-xs text-white truncate"
                  onDoubleClick={(e) => { e.stopPropagation(); startRename(idx); }}
                >
                  {layer.name}
                </span>
              )}

              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(layer.opacity * 100)}
                onChange={e => { e.stopPropagation(); setLayerOpacity(idx, parseInt(e.target.value) / 100); }}
                onClick={e => e.stopPropagation()}
                className="w-12 h-1 accent-[#e94560] flex-shrink-0"
                title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
              />

              <div className="flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); if (idx < frame.layers.length - 1) moveLayer(idx, idx + 1); }}
                  className="text-[8px] text-gray-400 hover:text-white leading-none"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (idx > 0) moveLayer(idx, idx - 1); }}
                  className="text-[8px] text-gray-400 hover:text-white leading-none"
                  title="Move down"
                >
                  ▼
                </button>
              </div>

              {frame.layers.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeLayer(idx); }}
                  className="text-xs text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  title="Delete layer"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
