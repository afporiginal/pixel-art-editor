import React, { useEffect, useCallback } from 'react';
import { usePixelEditor } from './hooks/usePixelEditor';
import { CanvasRenderer } from './components/CanvasRenderer';
import { Toolbar } from './components/Toolbar';
import { ColorPalette } from './components/ColorPalette';
import { LayersPanel } from './components/LayersPanel';
import { FramesPanel } from './components/FramesPanel';
import { ExportPanel } from './components/ExportPanel';
import { Tool } from './types';

const App: React.FC = () => {
  const editor = usePixelEditor(32, 32);
  const { state } = editor;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          editor.redo();
        } else {
          editor.undo();
        }
        return;
      }
      if (e.key === 'y') {
        e.preventDefault();
        editor.redo();
        return;
      }
    }

    const toolMap: Record<string, Tool> = {
      'b': 'pen',
      'e': 'eraser',
      'g': 'fill',
      'l': 'line',
      'r': 'rect',
      'c': 'circle',
      'i': 'eyedropper',
    };

    const key = e.key.toLowerCase();
    if (toolMap[key]) {
      editor.setTool(toolMap[key]);
    }

    if (key === '[') editor.setBrushSize(Math.max(1, state.brushSize - 1));
    if (key === ']') editor.setBrushSize(Math.min(16, state.brushSize + 1));

    if (key === '+' || key === '=') editor.setZoom(state.zoom + Math.max(1, Math.floor(state.zoom / 4)));
    if (key === '-') editor.setZoom(state.zoom - Math.max(1, Math.floor(state.zoom / 4)));
  }, [editor, state.brushSize, state.zoom]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const centerX = (window.innerWidth - 56 - 240) / 2 - (state.width * state.zoom) / 2;
    const centerY = (window.innerHeight - 80) / 2 - (state.height * state.zoom) / 2;
    editor.setPan(centerX, centerY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentFrame = state.frames[state.currentFrameIndex];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a1a] text-white overflow-hidden select-none">
      <div className="h-10 bg-[#16213e] border-b border-[#0f3460] flex items-center px-4 gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎨</span>
          <h1 className="text-sm font-bold tracking-wider bg-gradient-to-r from-[#e94560] to-[#533483] bg-clip-text text-transparent">
            PIXEL ART EDITOR
          </h1>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span>{state.width}×{state.height}</span>
          <span>•</span>
          <span>Frame {state.currentFrameIndex + 1}/{state.frames.length}</span>
          <span>•</span>
          <span>Layer: {currentFrame.layers[state.currentLayerIndex]?.name}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Toolbar
          currentTool={state.currentTool}
          brushSize={state.brushSize}
          showGrid={state.showGrid}
          onionSkin={state.onionSkin}
          setTool={editor.setTool}
          setBrushSize={editor.setBrushSize}
          setShowGrid={editor.setShowGrid}
          setOnionSkin={editor.setOnionSkin}
          undo={editor.undo}
          redo={editor.redo}
          clearLayer={editor.clearLayer}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <CanvasRenderer
            state={state}
            setPixel={editor.setPixel}
            setPixelsBatch={editor.setPixelsBatch}
            floodFill={editor.floodFill}
            saveHistory={editor.saveHistory}
            startBatch={editor.startBatch}
            endBatch={editor.endBatch}
            setColor={editor.setColor}
            setZoom={editor.setZoom}
            setPan={editor.setPan}
          />

          <FramesPanel
            state={state}
            setCurrentFrame={editor.setCurrentFrame}
            addFrame={editor.addFrame}
            duplicateFrame={editor.duplicateFrame}
            removeFrame={editor.removeFrame}
          />
        </div>

        <div className="w-60 flex flex-col bg-[#16213e] border-l border-[#0f3460] overflow-y-auto flex-shrink-0">
          <ColorPalette
            currentColor={state.currentColor}
            setColor={editor.setColor}
          />
          <LayersPanel
            frame={currentFrame}
            currentLayerIndex={state.currentLayerIndex}
            setCurrentLayer={editor.setCurrentLayer}
            addLayer={editor.addLayer}
            removeLayer={editor.removeLayer}
            toggleLayerVisibility={editor.toggleLayerVisibility}
            setLayerOpacity={editor.setLayerOpacity}
            renameLayer={editor.renameLayer}
            moveLayer={editor.moveLayer}
          />
          <ExportPanel
            state={state}
            resizeCanvas={editor.resizeCanvas}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
