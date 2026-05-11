import React, { useRef, useEffect, useCallback, useState } from 'react';
import { EditorState } from '../types';

interface Props {
  state: EditorState;
  setPixel: (x: number, y: number, color: string | null) => void;
  setPixelsBatch: (pixels: { x: number; y: number; color: string | null }[]) => void;
  floodFill: (x: number, y: number, color: string | null) => void;
  saveHistory: () => void;
  startBatch: () => void;
  endBatch: () => void;
  setColor: (color: string) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
}

function bresenhamLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return points;
}

function getBrushPixels(cx: number, cy: number, size: number): [number, number][] {
  const pixels: [number, number][] = [];
  const half = Math.floor(size / 2);
  for (let dy = -half; dy < size - half; dy++) {
    for (let dx = -half; dx < size - half; dx++) {
      pixels.push([cx + dx, cy + dy]);
    }
  }
  return pixels;
}

const CHECKER_LIGHT = '#ffffff';
const CHECKER_DARK = '#e0e0e0';
const CHECKER_SIZE = 8;

export const CanvasRenderer: React.FC<Props> = ({
  state,
  setPixel,
  setPixelsBatch,
  floodFill,
  saveHistory,
  startBatch,
  endBatch,
  setColor,
  setZoom,
  setPan,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const lastPixelRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const lineStartRef = useRef<{ x: number; y: number } | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [previewPixels, setPreviewPixels] = useState<[number, number][]>([]);

  const { width, height, zoom, panX, panY, showGrid, currentTool, currentColor, brushSize, onionSkin } = state;
  const frame = state.frames[state.currentFrameIndex];

  const getPixelCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;
    const x = Math.floor((canvasX - panX) / zoom);
    const y = Math.floor((canvasY - panY) / zoom);
    return { x, y };
  }, [zoom, panX, panY]);

  // Main render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.translate(panX, panY);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = x * zoom;
        const py = y * zoom;
        const checkerX = Math.floor(px / CHECKER_SIZE);
        const checkerY = Math.floor(py / CHECKER_SIZE);
        ctx.fillStyle = (checkerX + checkerY) % 2 === 0 ? CHECKER_LIGHT : CHECKER_DARK;
        ctx.fillRect(px, py, zoom, zoom);
      }
    }

    if (onionSkin && state.currentFrameIndex > 0) {
      const prevFrame = state.frames[state.currentFrameIndex - 1];
      ctx.globalAlpha = 0.2;
      for (const layer of prevFrame.layers) {
        if (!layer.visible) continue;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const color = layer.pixels[y][x];
            if (color) {
              ctx.fillStyle = color;
              ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
            }
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    for (const layer of frame.layers) {
      if (!layer.visible) continue;
      ctx.globalAlpha = layer.opacity;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const color = layer.pixels[y][x];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
          }
        }
      }
    }
    ctx.globalAlpha = 1;

    if (showGrid && zoom >= 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * zoom, 0);
        ctx.lineTo(x * zoom, height * zoom);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * zoom);
        ctx.lineTo(width * zoom, y * zoom);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width * zoom, height * zoom);

    ctx.restore();
  }, [state, panX, panY, zoom, width, height, showGrid, frame, onionSkin]);

  // Overlay render
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (hoverPos && hoverPos.x >= 0 && hoverPos.x < width && hoverPos.y >= 0 && hoverPos.y < height) {
      ctx.save();
      ctx.translate(panX, panY);

      const brushPixels = getBrushPixels(hoverPos.x, hoverPos.y, brushSize);
      ctx.fillStyle = currentTool === 'eraser' ? 'rgba(255,0,0,0.3)' : `${currentColor}44`;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      for (const [bx, by] of brushPixels) {
        if (bx >= 0 && bx < width && by >= 0 && by < height) {
          ctx.fillRect(bx * zoom, by * zoom, zoom, zoom);
          ctx.strokeRect(bx * zoom, by * zoom, zoom, zoom);
        }
      }

      if (previewPixels.length > 0) {
        ctx.fillStyle = currentTool === 'eraser' ? 'rgba(255,0,0,0.4)' : `${currentColor}88`;
        for (const [px, py] of previewPixels) {
          if (px >= 0 && px < width && py >= 0 && py < height) {
            ctx.fillRect(px * zoom, py * zoom, zoom, zoom);
          }
        }
      }

      ctx.restore();
    }
  }, [hoverPos, previewPixels, panX, panY, zoom, width, height, brushSize, currentColor, currentTool]);

  // Resize canvas on container resize
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!container || !canvas || !overlay) return;

    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width: cw, height: ch } = entry.contentRect;
        const dpr = 1;
        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
        overlay.width = cw * dpr;
        overlay.height = ch * dpr;
        canvas.style.width = cw + 'px';
        canvas.style.height = ch + 'px';
        overlay.style.width = cw + 'px';
        overlay.style.height = ch + 'px';
      }
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  const applyToolAtPixel = useCallback((x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const color = currentTool === 'eraser' ? null : currentColor;
    if (brushSize <= 1) {
      setPixel(x, y, color);
    } else {
      const pixels = getBrushPixels(x, y, brushSize).map(([bx, by]) => ({ x: bx, y: by, color }));
      setPixelsBatch(pixels);
    }
  }, [width, height, currentTool, currentColor, brushSize, setPixel, setPixelsBatch]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
      return;
    }

    if (e.button !== 0) return;

    const { x, y } = getPixelCoords(e.clientX, e.clientY);

    if (currentTool === 'eyedropper') {
      for (let i = frame.layers.length - 1; i >= 0; i--) {
        const layer = frame.layers[i];
        if (!layer.visible) continue;
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const color = layer.pixels[y][x];
          if (color) {
            setColor(color);
            return;
          }
        }
      }
      return;
    }

    if (currentTool === 'fill') {
      floodFill(x, y, currentColor);
      return;
    }

    if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') {
      lineStartRef.current = { x, y };
      isDrawingRef.current = true;
      return;
    }

    startBatch();
    isDrawingRef.current = true;
    lastPixelRef.current = { x, y };
    applyToolAtPixel(x, y);
  }, [getPixelCoords, currentTool, currentColor, frame, width, height, setColor, floodFill, startBatch, applyToolAtPixel, panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { x, y } = getPixelCoords(e.clientX, e.clientY);
    setHoverPos({ x, y });

    if (isPanningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy);
      return;
    }

    if (!isDrawingRef.current) {
      setPreviewPixels([]);
      return;
    }

    if (currentTool === 'line' && lineStartRef.current) {
      const pts = bresenhamLine(lineStartRef.current.x, lineStartRef.current.y, x, y);
      if (brushSize > 1) {
        const all: [number, number][] = [];
        for (const [px, py] of pts) {
          all.push(...getBrushPixels(px, py, brushSize));
        }
        setPreviewPixels(all);
      } else {
        setPreviewPixels(pts);
      }
      return;
    }

    if (currentTool === 'rect' && lineStartRef.current) {
      const sx = lineStartRef.current.x;
      const sy = lineStartRef.current.y;
      const pts: [number, number][] = [];
      const minX = Math.min(sx, x), maxX = Math.max(sx, x);
      const minY = Math.min(sy, y), maxY = Math.max(sy, y);
      for (let px = minX; px <= maxX; px++) {
        pts.push([px, minY], [px, maxY]);
      }
      for (let py = minY + 1; py < maxY; py++) {
        pts.push([minX, py], [maxX, py]);
      }
      setPreviewPixels(pts);
      return;
    }

    if (currentTool === 'circle' && lineStartRef.current) {
      const sx = lineStartRef.current.x;
      const sy = lineStartRef.current.y;
      const rx = Math.abs(x - sx);
      const ry = Math.abs(y - sy);
      const pts: [number, number][] = [];
      for (let angle = 0; angle < 360; angle += 0.5) {
        const rad = (angle * Math.PI) / 180;
        const px = Math.round(sx + rx * Math.cos(rad));
        const py = Math.round(sy + ry * Math.sin(rad));
        pts.push([px, py]);
      }
      const unique = Array.from(new Set(pts.map(p => `${p[0]},${p[1]}`))).map(s => s.split(',').map(Number) as [number, number]);
      setPreviewPixels(unique);
      return;
    }

    if ((currentTool === 'pen' || currentTool === 'eraser') && lastPixelRef.current) {
      const pts = bresenhamLine(lastPixelRef.current.x, lastPixelRef.current.y, x, y);
      const color = currentTool === 'eraser' ? null : currentColor;
      if (brushSize > 1) {
        const allPixels: { x: number; y: number; color: string | null }[] = [];
        for (const [px, py] of pts) {
          for (const [bx, by] of getBrushPixels(px, py, brushSize)) {
            allPixels.push({ x: bx, y: by, color });
          }
        }
        setPixelsBatch(allPixels);
      } else {
        for (const [px, py] of pts) {
          setPixel(px, py, color);
        }
      }
      lastPixelRef.current = { x, y };
    }
  }, [getPixelCoords, currentTool, currentColor, brushSize, setPixel, setPixelsBatch, setPan]);

  const handleMouseUp = useCallback((_e: React.MouseEvent) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      return;
    }

    if (!isDrawingRef.current) return;

    if ((currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') && lineStartRef.current) {
      saveHistory();
      const color = currentColor;
      if (previewPixels.length > 0) {
        setPixelsBatch(previewPixels.map(([px, py]) => ({ x: px, y: py, color })));
      }
      setPreviewPixels([]);
      lineStartRef.current = null;
    }

    if (currentTool === 'pen' || currentTool === 'eraser') {
      endBatch();
    }

    isDrawingRef.current = false;
    lastPixelRef.current = null;
  }, [currentTool, currentColor, previewPixels, saveHistory, setPixelsBatch, endBatch]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const oldZoom = zoom;
    const newZoom = Math.max(1, Math.min(64, zoom + delta * Math.max(1, Math.floor(zoom / 4))));
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const newPanX = mouseX - (mouseX - panX) * (newZoom / oldZoom);
    const newPanY = mouseY - (mouseY - panY) * (newZoom / oldZoom);
    
    setZoom(newZoom);
    setPan(newPanX, newPanY);
  }, [zoom, panX, panY, setZoom, setPan]);

  const handleMouseLeave = useCallback(() => {
    setHoverPos(null);
    setPreviewPixels([]);
  }, []);

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#1a1a2e] cursor-crosshair">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0"
      />
      <canvas
        ref={overlayCanvasRef}
        className="absolute top-0 left-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={e => e.preventDefault()}
      />
      {hoverPos && (
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
          {hoverPos.x}, {hoverPos.y} | Zoom: {zoom}x
        </div>
      )}
    </div>
  );
};
