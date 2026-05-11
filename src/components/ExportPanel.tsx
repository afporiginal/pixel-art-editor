import React, { useState, useCallback } from 'react';
import { EditorState } from '../types';

interface Props {
  state: EditorState;
  resizeCanvas: (w: number, h: number) => void;
}

function renderFrameToCanvas(state: EditorState, frameIndex: number, scale: number = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = state.width * scale;
  canvas.height = state.height * scale;
  const ctx = canvas.getContext('2d')!;

  const frame = state.frames[frameIndex];
  for (const layer of frame.layers) {
    if (!layer.visible) continue;
    ctx.globalAlpha = layer.opacity;
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const color = layer.pixels[y][x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
  }
  ctx.globalAlpha = 1;
  return canvas;
}

export const ExportPanel: React.FC<Props> = ({ state, resizeCanvas }) => {
  const [exportScale, setExportScale] = useState(4);
  const [gifFps, setGifFps] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [newWidth, setNewWidth] = useState(state.width);
  const [newHeight, setNewHeight] = useState(state.height);
  const [showResize, setShowResize] = useState(false);

  const exportPNG = useCallback(() => {
    const canvas = renderFrameToCanvas(state, state.currentFrameIndex, exportScale);
    const link = document.createElement('a');
    link.download = `pixel-art-frame${state.currentFrameIndex + 1}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [state, exportScale]);

  const exportAllFramesPNG = useCallback(() => {
    for (let i = 0; i < state.frames.length; i++) {
      const canvas = renderFrameToCanvas(state, i, exportScale);
      const link = document.createElement('a');
      link.download = `pixel-art-frame${i + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      setTimeout(() => link.click(), i * 100);
    }
  }, [state, exportScale]);

  const exportSpriteSheet = useCallback(() => {
    const cols = Math.ceil(Math.sqrt(state.frames.length));
    const rows = Math.ceil(state.frames.length / cols);
    const sw = state.width * exportScale;
    const sh = state.height * exportScale;

    const canvas = document.createElement('canvas');
    canvas.width = cols * sw;
    canvas.height = rows * sh;
    const ctx = canvas.getContext('2d')!;

    for (let i = 0; i < state.frames.length; i++) {
      const frameCanvas = renderFrameToCanvas(state, i, exportScale);
      const col = i % cols;
      const row = Math.floor(i / cols);
      ctx.drawImage(frameCanvas, col * sw, row * sh);
    }

    const link = document.createElement('a');
    link.download = 'pixel-art-spritesheet.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [state, exportScale]);

  const exportGIF = useCallback(async () => {
    setExporting(true);
    try {
      const w = state.width * exportScale;
      const h = state.height * exportScale;
      const delay = Math.round(100 / gifFps);

      const framesData: ImageData[] = [];
      for (let i = 0; i < state.frames.length; i++) {
        const canvas = renderFrameToCanvas(state, i, exportScale);
        const ctx = canvas.getContext('2d')!;
        framesData.push(ctx.getImageData(0, 0, w, h));
      }

      const colorMap = new Map<string, number>();
      const palette: [number, number, number][] = [];
      let transparentIndex = -1;

      palette.push([0, 0, 0]);
      colorMap.set('transparent', 0);
      transparentIndex = 0;

      for (const imgData of framesData) {
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
          if (!colorMap.has(key) && palette.length < 256) {
            colorMap.set(key, palette.length);
            palette.push([data[i], data[i + 1], data[i + 2]]);
          }
        }
      }

      const colorBits = Math.max(2, Math.ceil(Math.log2(palette.length)));
      const paletteSize = 1 << colorBits;
      while (palette.length < paletteSize) {
        palette.push([0, 0, 0]);
      }

      const bytes: number[] = [];
      const writeByte = (b: number) => bytes.push(b & 0xff);
      const writeShort = (s: number) => { writeByte(s & 0xff); writeByte((s >> 8) & 0xff); };
      const writeString = (s: string) => { for (let i = 0; i < s.length; i++) writeByte(s.charCodeAt(i)); };

      writeString('GIF89a');

      writeShort(w);
      writeShort(h);
      writeByte(0x80 | ((colorBits - 1) & 7) | (((colorBits - 1) & 7) << 4));
      writeByte(transparentIndex);
      writeByte(0);

      for (const [r, g, b] of palette) {
        writeByte(r); writeByte(g); writeByte(b);
      }

      writeByte(0x21);
      writeByte(0xff);
      writeByte(11);
      writeString('NETSCAPE2.0');
      writeByte(3);
      writeByte(1);
      writeShort(0);
      writeByte(0);

      function lzwCompress(indexData: number[], minCodeSize: number): number[] {
        const clearCode = 1 << minCodeSize;
        const eoiCode = clearCode + 1;
        let codeSize = minCodeSize + 1;
        let nextCode = eoiCode + 1;
        const maxCode = 4096;

        const output: number[] = [];
        let bitBuffer = 0;
        let bitCount = 0;

        function emit(code: number) {
          bitBuffer |= (code << bitCount);
          bitCount += codeSize;
          while (bitCount >= 8) {
            output.push(bitBuffer & 0xff);
            bitBuffer >>= 8;
            bitCount -= 8;
          }
        }

        let table = new Map<string, number>();
        function resetTable() {
          table = new Map();
          for (let i = 0; i < clearCode; i++) {
            table.set(String(i), i);
          }
          codeSize = minCodeSize + 1;
          nextCode = eoiCode + 1;
        }

        resetTable();
        emit(clearCode);

        let w = String(indexData[0]);
        for (let i = 1; i < indexData.length; i++) {
          const k = String(indexData[i]);
          const wk = w + ',' + k;
          if (table.has(wk)) {
            w = wk;
          } else {
            emit(table.get(w)!);
            if (nextCode < maxCode) {
              table.set(wk, nextCode++);
              if (nextCode > (1 << codeSize) && codeSize < 12) {
                codeSize++;
              }
            } else {
              emit(clearCode);
              resetTable();
            }
            w = k;
          }
        }
        emit(table.get(w)!);
        emit(eoiCode);

        if (bitCount > 0) {
          output.push(bitBuffer & 0xff);
        }

        return output;
      }

      for (let f = 0; f < framesData.length; f++) {
        writeByte(0x21);
        writeByte(0xf9);
        writeByte(4);
        writeByte(transparentIndex >= 0 ? 0x09 : 0x08);
        writeShort(delay);
        writeByte(transparentIndex >= 0 ? transparentIndex : 0);
        writeByte(0);

        writeByte(0x2c);
        writeShort(0);
        writeShort(0);
        writeShort(w);
        writeShort(h);
        writeByte(0);

        const imgData = framesData[f].data;
        const indexData: number[] = [];
        for (let i = 0; i < imgData.length; i += 4) {
          if (imgData[i + 3] < 128) {
            indexData.push(transparentIndex);
          } else {
            const key = `${imgData[i]},${imgData[i + 1]},${imgData[i + 2]}`;
            indexData.push(colorMap.get(key) ?? 0);
          }
        }

        const minCodeSize = colorBits;
        writeByte(minCodeSize);

        const compressed = lzwCompress(indexData, minCodeSize);

        let pos = 0;
        while (pos < compressed.length) {
          const blockSize = Math.min(255, compressed.length - pos);
          writeByte(blockSize);
          for (let i = 0; i < blockSize; i++) {
            writeByte(compressed[pos++]);
          }
        }
        writeByte(0);
      }

      writeByte(0x3b);

      const blob = new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'pixel-art-animation.gif';
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('GIF export error:', err);
      alert('Error exporting GIF. Check console for details.');
    } finally {
      setExporting(false);
    }
  }, [state, exportScale, gifFps]);

  return (
    <div className="bg-[#16213e] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Export</span>
      </div>

      <div className="mb-3">
        <button
          onClick={() => setShowResize(!showResize)}
          className="text-[10px] text-gray-300 hover:text-white flex items-center gap-1"
        >
          <span>Canvas: {state.width}×{state.height}</span>
          <span className="text-gray-500">{showResize ? '▲' : '▼'}</span>
        </button>
        {showResize && (
          <div className="mt-1 flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={256}
              value={newWidth}
              onChange={e => setNewWidth(parseInt(e.target.value) || 1)}
              className="w-14 bg-[#1a1a2e] text-white text-xs px-1 py-0.5 rounded border border-[#0f3460] focus:border-[#e94560] outline-none"
            />
            <span className="text-gray-400 text-xs">×</span>
            <input
              type="number"
              min={1}
              max={256}
              value={newHeight}
              onChange={e => setNewHeight(parseInt(e.target.value) || 1)}
              className="w-14 bg-[#1a1a2e] text-white text-xs px-1 py-0.5 rounded border border-[#0f3460] focus:border-[#e94560] outline-none"
            />
            <button
              onClick={() => resizeCanvas(newWidth, newHeight)}
              className="text-xs bg-[#e94560] text-white px-2 py-0.5 rounded hover:bg-[#d63051]"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-gray-400">Scale:</span>
        {[1, 2, 4, 8, 16].map(s => (
          <button
            key={s}
            onClick={() => setExportScale(s)}
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              exportScale === s ? 'bg-[#e94560] text-white' : 'bg-[#1a1a2e] text-gray-300 hover:bg-[#0f3460]'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          onClick={exportPNG}
          className="w-full text-xs bg-[#2ecc71] hover:bg-[#27ae60] text-white py-1.5 rounded font-semibold transition-colors"
        >
          📥 Export PNG
        </button>

        {state.frames.length > 1 && (
          <>
            <button
              onClick={exportAllFramesPNG}
              className="w-full text-xs bg-[#3498db] hover:bg-[#2980b9] text-white py-1.5 rounded font-semibold transition-colors"
            >
              📥 Export All Frames (PNG)
            </button>
            <button
              onClick={exportSpriteSheet}
              className="w-full text-xs bg-[#9b59b6] hover:bg-[#8e44ad] text-white py-1.5 rounded font-semibold transition-colors"
            >
              📥 Sprite Sheet
            </button>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-gray-400">FPS:</span>
              <input
                type="range"
                min={1}
                max={30}
                value={gifFps}
                onChange={e => setGifFps(parseInt(e.target.value))}
                className="flex-1 h-1 accent-[#e94560]"
              />
              <span className="text-[10px] text-white w-6">{gifFps}</span>
            </div>
            <button
              onClick={exportGIF}
              disabled={exporting}
              className="w-full text-xs bg-[#e94560] hover:bg-[#d63051] text-white py-1.5 rounded font-semibold transition-colors disabled:opacity-50"
            >
              {exporting ? '⏳ Generating...' : '🎬 Export GIF'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
