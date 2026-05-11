export type RGBA = [number, number, number, number];

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  pixels: (string | null)[][];
}

export interface Frame {
  id: string;
  layers: Layer[];
}

export type Tool = 'pen' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle' | 'eyedropper' | 'move' | 'select';

export interface EditorState {
  width: number;
  height: number;
  frames: Frame[];
  currentFrameIndex: number;
  currentLayerIndex: number;
  currentColor: string;
  currentTool: Tool;
  brushSize: number;
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  onionSkin: boolean;
}

export interface HistoryEntry {
  frames: Frame[];
  currentFrameIndex: number;
  currentLayerIndex: number;
}
