import { useState, useCallback, useRef } from 'react';
import { EditorState, Frame, Layer, HistoryEntry, Tool } from '../types';

function createEmptyPixels(w: number, h: number): (string | null)[][] {
  return Array.from({ length: h }, () => Array(w).fill(null));
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function createLayer(name: string, w: number, h: number): Layer {
  return {
    id: generateId(),
    name,
    visible: true,
    opacity: 1,
    pixels: createEmptyPixels(w, h),
  };
}

function createFrame(w: number, h: number): Frame {
  return {
    id: generateId(),
    layers: [createLayer('Layer 1', w, h)],
  };
}

function deepCloneFrames(frames: Frame[]): Frame[] {
  return frames.map(f => ({
    ...f,
    layers: f.layers.map(l => ({
      ...l,
      pixels: l.pixels.map(row => [...row]),
    })),
  }));
}

const MAX_HISTORY = 100;

export function usePixelEditor(initialWidth = 32, initialHeight = 32) {
  const [state, setState] = useState<EditorState>(() => ({
    width: initialWidth,
    height: initialHeight,
    frames: [createFrame(initialWidth, initialHeight)],
    currentFrameIndex: 0,
    currentLayerIndex: 0,
    currentColor: '#000000',
    currentTool: 'pen',
    brushSize: 1,
    zoom: 16,
    panX: 0,
    panY: 0,
    showGrid: true,
    onionSkin: false,
  }));

  const historyRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  const batchingRef = useRef(false);

  const saveHistory = useCallback(() => {
    if (batchingRef.current) return;
    setState(s => {
      historyRef.current.push({
        frames: deepCloneFrames(s.frames),
        currentFrameIndex: s.currentFrameIndex,
        currentLayerIndex: s.currentLayerIndex,
      });
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.shift();
      }
      futureRef.current = [];
      return s;
    });
  }, []);

  const startBatch = useCallback(() => {
    setState(s => {
      historyRef.current.push({
        frames: deepCloneFrames(s.frames),
        currentFrameIndex: s.currentFrameIndex,
        currentLayerIndex: s.currentLayerIndex,
      });
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.shift();
      }
      futureRef.current = [];
      batchingRef.current = true;
      return s;
    });
  }, []);

  const endBatch = useCallback(() => {
    batchingRef.current = false;
  }, []);

  const undo = useCallback(() => {
    setState(s => {
      if (historyRef.current.length === 0) return s;
      const entry = historyRef.current.pop()!;
      futureRef.current.push({
        frames: deepCloneFrames(s.frames),
        currentFrameIndex: s.currentFrameIndex,
        currentLayerIndex: s.currentLayerIndex,
      });
      return {
        ...s,
        frames: entry.frames,
        currentFrameIndex: entry.currentFrameIndex,
        currentLayerIndex: entry.currentLayerIndex,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(s => {
      if (futureRef.current.length === 0) return s;
      const entry = futureRef.current.pop()!;
      historyRef.current.push({
        frames: deepCloneFrames(s.frames),
        currentFrameIndex: s.currentFrameIndex,
        currentLayerIndex: s.currentLayerIndex,
      });
      return {
        ...s,
        frames: entry.frames,
        currentFrameIndex: entry.currentFrameIndex,
        currentLayerIndex: entry.currentLayerIndex,
      };
    });
  }, []);

  const setPixel = useCallback((x: number, y: number, color: string | null) => {
    setState(s => {
      if (x < 0 || x >= s.width || y < 0 || y >= s.height) return s;
      const frame = s.frames[s.currentFrameIndex];
      const layer = frame.layers[s.currentLayerIndex];
      if (layer.pixels[y][x] === color) return s;
      const newFrames = deepCloneFrames(s.frames);
      newFrames[s.currentFrameIndex].layers[s.currentLayerIndex].pixels[y][x] = color;
      return { ...s, frames: newFrames };
    });
  }, []);

  const setPixelsBatch = useCallback((pixels: { x: number; y: number; color: string | null }[]) => {
    setState(s => {
      const newFrames = deepCloneFrames(s.frames);
      const layer = newFrames[s.currentFrameIndex].layers[s.currentLayerIndex];
      for (const p of pixels) {
        if (p.x >= 0 && p.x < s.width && p.y >= 0 && p.y < s.height) {
          layer.pixels[p.y][p.x] = p.color;
        }
      }
      return { ...s, frames: newFrames };
    });
  }, []);

  const floodFill = useCallback((startX: number, startY: number, fillColor: string | null) => {
    saveHistory();
    setState(s => {
      if (startX < 0 || startX >= s.width || startY < 0 || startY >= s.height) return s;
      const newFrames = deepCloneFrames(s.frames);
      const layer = newFrames[s.currentFrameIndex].layers[s.currentLayerIndex];
      const targetColor = layer.pixels[startY][startX];
      if (targetColor === fillColor) return s;

      const stack: [number, number][] = [[startX, startY]];
      const visited = new Set<string>();

      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        if (x < 0 || x >= s.width || y < 0 || y >= s.height) continue;
        if (layer.pixels[y][x] !== targetColor) continue;

        visited.add(key);
        layer.pixels[y][x] = fillColor;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }

      return { ...s, frames: newFrames };
    });
  }, [saveHistory]);

  const addLayer = useCallback(() => {
    saveHistory();
    setState(s => {
      const newFrames = deepCloneFrames(s.frames);
      const frame = newFrames[s.currentFrameIndex];
      const newLayer = createLayer(`Layer ${frame.layers.length + 1}`, s.width, s.height);
      frame.layers.push(newLayer);
      return { ...s, frames: newFrames, currentLayerIndex: frame.layers.length - 1 };
    });
  }, [saveHistory]);

  const removeLayer = useCallback((index: number) => {
    saveHistory();
    setState(s => {
      const frame = s.frames[s.currentFrameIndex];
      if (frame.layers.length <= 1) return s;
      const newFrames = deepCloneFrames(s.frames);
      newFrames[s.currentFrameIndex].layers.splice(index, 1);
      const newIndex = Math.min(s.currentLayerIndex, newFrames[s.currentFrameIndex].layers.length - 1);
      return { ...s, frames: newFrames, currentLayerIndex: newIndex };
    });
  }, [saveHistory]);

  const toggleLayerVisibility = useCallback((index: number) => {
    setState(s => {
      const newFrames = deepCloneFrames(s.frames);
      const layer = newFrames[s.currentFrameIndex].layers[index];
      layer.visible = !layer.visible;
      return { ...s, frames: newFrames };
    });
  }, []);

  const setLayerOpacity = useCallback((index: number, opacity: number) => {
    setState(s => {
      const newFrames = deepCloneFrames(s.frames);
      newFrames[s.currentFrameIndex].layers[index].opacity = opacity;
      return { ...s, frames: newFrames };
    });
  }, []);

  const renameLayer = useCallback((index: number, name: string) => {
    setState(s => {
      const newFrames = deepCloneFrames(s.frames);
      newFrames[s.currentFrameIndex].layers[index].name = name;
      return { ...s, frames: newFrames };
    });
  }, []);

  const moveLayer = useCallback((fromIndex: number, toIndex: number) => {
    saveHistory();
    setState(s => {
      const newFrames = deepCloneFrames(s.frames);
      const layers = newFrames[s.currentFrameIndex].layers;
      const [layer] = layers.splice(fromIndex, 1);
      layers.splice(toIndex, 0, layer);
      let newCurrentIndex = s.currentLayerIndex;
      if (s.currentLayerIndex === fromIndex) newCurrentIndex = toIndex;
      return { ...s, frames: newFrames, currentLayerIndex: newCurrentIndex };
    });
  }, [saveHistory]);

  const addFrame = useCallback(() => {
    saveHistory();
    setState(s => {
      const newFrames = deepCloneFrames(s.frames);
      newFrames.push(createFrame(s.width, s.height));
      return { ...s, frames: newFrames, currentFrameIndex: newFrames.length - 1, currentLayerIndex: 0 };
    });
  }, [saveHistory]);

  const duplicateFrame = useCallback(() => {
    saveHistory();
    setState(s => {
      const newFrames = deepCloneFrames(s.frames);
      const dup = deepCloneFrames([s.frames[s.currentFrameIndex]])[0];
      dup.id = generateId();
      newFrames.splice(s.currentFrameIndex + 1, 0, dup);
      return { ...s, frames: newFrames, currentFrameIndex: s.currentFrameIndex + 1 };
    });
  }, [saveHistory]);

  const removeFrame = useCallback((index: number) => {
    saveHistory();
    setState(s => {
      if (s.frames.length <= 1) return s;
      const newFrames = deepCloneFrames(s.frames);
      newFrames.splice(index, 1);
      const newIndex = Math.min(s.currentFrameIndex, newFrames.length - 1);
      return { ...s, frames: newFrames, currentFrameIndex: newIndex, currentLayerIndex: 0 };
    });
  }, [saveHistory]);

  const setTool = useCallback((tool: Tool) => {
    setState(s => ({ ...s, currentTool: tool }));
  }, []);

  const setColor = useCallback((color: string) => {
    setState(s => ({ ...s, currentColor: color }));
  }, []);

  const setBrushSize = useCallback((size: number) => {
    setState(s => ({ ...s, brushSize: size }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setState(s => ({ ...s, zoom: Math.max(1, Math.min(64, zoom)) }));
  }, []);

  const setPan = useCallback((x: number, y: number) => {
    setState(s => ({ ...s, panX: x, panY: y }));
  }, []);

  const setShowGrid = useCallback((show: boolean) => {
    setState(s => ({ ...s, showGrid: show }));
  }, []);

  const setOnionSkin = useCallback((on: boolean) => {
    setState(s => ({ ...s, onionSkin: on }));
  }, []);

  const setCurrentFrame = useCallback((index: number) => {
    setState(s => ({ ...s, currentFrameIndex: index, currentLayerIndex: Math.min(s.currentLayerIndex, s.frames[index].layers.length - 1) }));
  }, []);

  const setCurrentLayer = useCallback((index: number) => {
    setState(s => ({ ...s, currentLayerIndex: index }));
  }, []);

  const clearLayer = useCallback(() => {
    saveHistory();
    setState(s => {
      const newFrames = deepCloneFrames(s.frames);
      newFrames[s.currentFrameIndex].layers[s.currentLayerIndex].pixels = createEmptyPixels(s.width, s.height);
      return { ...s, frames: newFrames };
    });
  }, [saveHistory]);

  const resizeCanvas = useCallback((newWidth: number, newHeight: number) => {
    saveHistory();
    setState(s => {
      const newFrames = s.frames.map(frame => ({
        ...frame,
        layers: frame.layers.map(layer => {
          const newPixels = createEmptyPixels(newWidth, newHeight);
          for (let y = 0; y < Math.min(s.height, newHeight); y++) {
            for (let x = 0; x < Math.min(s.width, newWidth); x++) {
              newPixels[y][x] = layer.pixels[y][x];
            }
          }
          return { ...layer, pixels: newPixels };
        }),
      }));
      return { ...s, width: newWidth, height: newHeight, frames: newFrames };
    });
  }, [saveHistory]);

  return {
    state,
    setPixel,
    setPixelsBatch,
    floodFill,
    saveHistory,
    startBatch,
    endBatch,
    undo,
    redo,
    addLayer,
    removeLayer,
    toggleLayerVisibility,
    setLayerOpacity,
    renameLayer,
    moveLayer,
    addFrame,
    duplicateFrame,
    removeFrame,
    setTool,
    setColor,
    setBrushSize,
    setZoom,
    setPan,
    setShowGrid,
    setOnionSkin,
    setCurrentFrame,
    setCurrentLayer,
    clearLayer,
    resizeCanvas,
    historyLength: historyRef.current.length,
    futureLength: futureRef.current.length,
  };
}
