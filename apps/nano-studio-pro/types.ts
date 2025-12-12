
export enum PresetType {
  GHOST_MANNEQUIN = 'GHOST_MANNEQUIN',
  LIFESTYLE = 'LIFESTYLE',
  ANGLES = 'ANGLES',
  BG_REMOVE_REPAIR = 'BG_REMOVE_REPAIR'
}

export interface Preset {
  id: PresetType;
  label: string;
  description: string;
  icon: string;
  promptTemplate: string;
}

export interface ProcessedImage {
  url: string;
  filename: string;
}

export interface ProcessingState {
  isProcessing: boolean;
  statusMessage?: string;
  error: string | null;
  processedImages: ProcessedImage[];
}

export interface SourceImage {
  id: string;
  file: File;           // The current version (potentially cropped) sent to API
  originalFile: File;   // The original uploaded file (for re-cropping)
  preview: string;      // Preview of the current version
  originalPreview: string; // Preview of the original
  label: string;
}

export interface SavedStyle {
  id: string;
  name: string;
  imageData: string; // Base64
  timestamp: number;
}

export const IMAGE_LABELS = [
  'Front View',
  'Back View',
  'Side View',
  'Top View',
  'Detail Shot',
  'Model Shot',
  'Other'
];

export const AVAILABLE_ANGLES = [
  "Front View",
  "Side View", 
  "Back View",
  "3/4 Perspective View",
  "Top Down View (Flat Lay)",
  "Close-up Detail",
  "Front & Back Composite"
];
