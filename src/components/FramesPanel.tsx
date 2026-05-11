import React, { useRef, useEffect } from 'react';
import { EditorState } from '../types';

interface Props {
  state: EditorState;
  setCurrentFrame: (index: number) => void;
  addFrame: () => void;
  duplicateFrame: () => void;
  removeFrame: (index: number) => void;
}

function renderFrameThumb(
  canvas: HTMLCanvasElement,
  state: EditorState,
  frameIndex: number
) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = state;
  const frame = state.frames[frameIndex];
  const scale = Math.min(canvas.width / width, canvas.height / height);
  const ox = (canvas.width - width * scale) / 2;
  const oy = (canvas.height - height * scale) / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.fillRect(ox, oy, width * scale, height * scale);
  ctx.fillStyle = '#ddd';
  const cs = Math.max(2, scale);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((x + y) % 2 === 1) {
        ctx.fillRect(ox + x * scale, oy + y * scale, cs, cs);
      }
    }
  }

  for (const layer of frame.layers) {
    if (!layer.visible) continue;
    ctx.globalAlpha = layer.opacity;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = layer.pixels[y][x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
        }
      }
    }
  }
  ctx.globalAlpha = 1;
}

const FrameThumb: React.FC<{
  state: EditorState;
  frameIndex: number;
  isActive: boolean;
  onClick: () => void;
  onRemove?: () => void;
}> = ({ state, frameIndex, isActive, onClick, onRemove }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      renderFrameThumb(canvasRef.current, state, frameIndex);
    }
  }, [state, frameIndex]);

  return (
    <div
      onClick={onClick}
      className={`relative flex-shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
        isActive ? 'border-[#e94560] shadow-lg shadow-[#e94560]/20' : 'border-[#0f3460] hover:border-[#533483]'
      }`}
    >
      <canvas ref={canvasRef} width={60} height={60} className="bg-[#1a1a2e]" />
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[9px] text-white py-0.5">
        {frameIndex + 1}
      </div>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-0 right-0 w-4 h-4 bg-red-600/80 text-white text-[8px] flex items-center justify-center rounded-bl opacity-0 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export const FramesPanel: React.FC<Props> = ({
  state,
  setCurrentFrame,
  addFrame,
  duplicateFrame,
  removeFrame,
}) => {
  return (
    <div className="bg-[#16213e] border-t border-[#0f3460] px-3 py-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Frames</span>
        <div className="flex-1" />
        <button
          onClick={duplicateFrame}
          className="text-[10px] bg-[#0f3460] hover:bg-[#533483] text-white px-2 py-0.5 rounded transition-colors"
          title="Duplicate frame"
        >
          📋 Dup
        </button>
        <button
          onClick={addFrame}
          className="text-[10px] bg-[#0f3460] hover:bg-[#e94560] text-white px-2 py-0.5 rounded transition-colors"
        >
          + Frame
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {state.frames.map((_, i) => (
          <FrameThumb
            key={state.frames[i].id}
            state={state}
            frameIndex={i}
            isActive={i === state.currentFrameIndex}
            onClick={() => setCurrentFrame(i)}
            onRemove={state.frames.length > 1 ? () => removeFrame(i) : undefined}
          />
        ))}
      </div>
    </div>
  );
};
