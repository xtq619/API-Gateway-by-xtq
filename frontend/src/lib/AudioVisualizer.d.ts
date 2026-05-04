export default class AudioVisualizer {
  constructor(options: {
    container: HTMLElement;
    width?: number;
    height?: number;
    colors?: string[];
    fftSize?: number;
    smoothingFactor?: number;
    baseRadius?: number;
  });
  loadFile(file: File | string): void;
  play(): void;
  pause(): void;
  start(): void;
  stop(): void;
  startRecord(): void;
  stopRecord(): Promise<Blob | null>;
  getDownloadURL(blob: Blob): string;
  destroy(): void;
}
