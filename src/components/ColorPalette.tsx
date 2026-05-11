import React, { useState } from 'react';

interface Props {
  currentColor: string;
  setColor: (color: string) => void;
}

const PRESET_COLORS = [
  '#000000', '#1a1a2e', '#16213e', '#0f3460',
  '#533483', '#e94560', '#ff6b6b', '#ffa502',
  '#ffda79', '#2ed573', '#1e90ff', '#70a1ff',
  '#ffffff', '#f1f2f6', '#dfe4ea', '#ced6e0',
  '#2c3e50', '#e74c3c', '#e67e22', '#f1c40f',
  '#2ecc71', '#1abc9c', '#3498db', '#9b59b6',
  '#34495e', '#c0392b', '#d35400', '#f39c12',
  '#27ae60', '#16a085', '#2980b9', '#8e44ad',
  '#ffeaa7', '#fdcb6e', '#f8b739', '#e17055',
  '#d63031', '#b71540', '#6c5ce7', '#a29bfe',
  '#74b9ff', '#55efc4', '#00b894', '#81ecec',
  '#fab1a0', '#ff7675', '#fd79a8', '#636e72',
  '#0f380f', '#306230', '#8bac0f', '#9bbc0f',
  '#8b4513', '#a0522d', '#deb887', '#f5deb3',
  '#4b0082', '#800080', '#ff00ff', '#ff1493',
  '#00ffff', '#00ff00', '#ffff00', '#ff0000',
];

export const ColorPalette: React.FC<Props> = ({ currentColor, setColor }) => {
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const handleColorChange = (color: string) => {
    setColor(color);
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      return [color, ...filtered].slice(0, 8);
    });
  };

  return (
    <div className="bg-[#16213e] border-b border-[#0f3460] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Color</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-10 h-10 rounded-lg border-2 border-white/30 shadow-inner"
          style={{ backgroundColor: currentColor }}
        />
        <input
          type="color"
          value={currentColor}
          onChange={e => handleColorChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
        />
        <input
          type="text"
          value={currentColor}
          onChange={e => {
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
              handleColorChange(e.target.value);
            }
          }}
          className="flex-1 bg-[#1a1a2e] text-white text-xs font-mono px-2 py-1 rounded border border-[#0f3460] focus:border-[#e94560] outline-none"
        />
      </div>

      {recentColors.length > 0 && (
        <div className="mb-2">
          <span className="text-[9px] text-gray-500 uppercase">Recent</span>
          <div className="flex gap-1 mt-1">
            {recentColors.map((color, i) => (
              <button
                key={`${color}-${i}`}
                onClick={() => setColor(color)}
                className={`w-5 h-5 rounded-sm border transition-transform hover:scale-125 ${
                  color === currentColor ? 'border-white scale-110' : 'border-white/20'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-8 gap-0.5">
        {PRESET_COLORS.map((color, i) => (
          <button
            key={`${color}-${i}`}
            onClick={() => handleColorChange(color)}
            className={`w-full aspect-square rounded-sm border transition-all hover:scale-125 hover:z-10 ${
              color === currentColor ? 'border-white scale-110 z-10 ring-1 ring-[#e94560]' : 'border-transparent hover:border-white/40'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
};
