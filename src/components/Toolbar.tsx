import React from 'react';
import { Tool } from '../types';

interface Props {
  currentTool: Tool;
  brushSize: number;
  showGrid: boolean;
  onionSkin: boolean;
  setTool: (tool: Tool) => void;
  setBrushSize: (size: number) => void;
  setShowGrid: (show: boolean) => void;
  setOnionSkin: (on: boolean) => void;
  undo: () => void;
  redo: () => void;
  clearLayer: () => void;
}

const tools: { tool: Tool; icon: string; label: string }[] = [
  { tool: 'pen', icon: '✏️', label: 'Pen (B)' },
  { tool: 'eraser', icon: '🧹', label: 'Eraser (E)' },
  { tool: 'fill', icon: '🪣', label: 'Fill (G)' },
  { tool: 'line', icon: '📏', label: 'Line (L)' },
  { tool: 'rect', icon: '⬜', label: 'Rectangle (R)' },
  { tool: 'circle', icon: '⭕', label: 'Circle (C)' },
  { tool: 'eyedropper', icon: '💉', label: 'Eyedropper (I)' },
];

export const Toolbar: React.FC<Props> = ({
  currentTool,
  brushSize,
  showGrid,
  onionSkin,
  setTool,
  setBrushSize,
  setShowGrid,
  setOnionSkin,
  undo,
  redo,
  clearLayer,
}) => {
  return (
    <div className="w-14 bg-[#16213e] flex flex-col items-center py-2 gap-1 border-r border-[#0f3460]">
      {tools.map(({ tool, icon, label }) => (
        <button
          key={tool}
          title={label}
          onClick={() => setTool(tool)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all
            ${currentTool === tool
              ? 'bg-[#e94560] shadow-lg shadow-[#e94560]/30 scale-110'
              : 'bg-[#1a1a2e] hover:bg-[#0f3460]'
            }`}
        >
          {icon}
        </button>
      ))}

      <div className="w-8 h-px bg-[#0f3460] my-1" />

      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-gray-400 uppercase">Size</span>
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => setBrushSize(Math.min(16, brushSize + 1))}
            className="w-7 h-5 bg-[#1a1a2e] hover:bg-[#0f3460] rounded text-xs text-white"
          >
            +
          </button>
          <span className="text-white text-xs font-mono w-7 text-center">{brushSize}</span>
          <button
            onClick={() => setBrushSize(Math.max(1, brushSize - 1))}
            className="w-7 h-5 bg-[#1a1a2e] hover:bg-[#0f3460] rounded text-xs text-white"
          >
            −
          </button>
        </div>
      </div>

      <div className="w-8 h-px bg-[#0f3460] my-1" />

      <button
        title="Undo (Ctrl+Z)"
        onClick={undo}
        className="w-10 h-10 rounded-lg bg-[#1a1a2e] hover:bg-[#0f3460] flex items-center justify-center text-lg"
      >
        ↩️
      </button>
      <button
        title="Redo (Ctrl+Y)"
        onClick={redo}
        className="w-10 h-10 rounded-lg bg-[#1a1a2e] hover:bg-[#0f3460] flex items-center justify-center text-lg"
      >
        ↪️
      </button>

      <div className="w-8 h-px bg-[#0f3460] my-1" />

      <button
        title="Toggle Grid"
        onClick={() => setShowGrid(!showGrid)}
        className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg
          ${showGrid ? 'bg-[#0f3460]' : 'bg-[#1a1a2e] hover:bg-[#0f3460]'}`}
      >
        #️⃣
      </button>

      <button
        title="Onion Skin"
        onClick={() => setOnionSkin(!onionSkin)}
        className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg
          ${onionSkin ? 'bg-[#0f3460]' : 'bg-[#1a1a2e] hover:bg-[#0f3460]'}`}
      >
        🧅
      </button>

      <div className="flex-1" />

      <button
        title="Clear Layer"
        onClick={clearLayer}
        className="w-10 h-10 rounded-lg bg-[#1a1a2e] hover:bg-red-900/50 flex items-center justify-center text-lg"
      >
        🗑️
      </button>
    </div>
  );
};
