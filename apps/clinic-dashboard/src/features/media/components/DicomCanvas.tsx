import { useEffect, useRef } from 'react';
import { useMediaBlobUrl } from '../hooks/useMedia';

interface DicomCanvasProps {
  mediaId: string;
  windowWidth: number;
  windowCenter: number;
  scale: number;
}

export function DicomCanvas({ mediaId, windowWidth, windowCenter, scale }: DicomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { url, loading } = useMediaBlobUrl(mediaId, 'original');

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    let cancelled = false;

    async function render() {
      const res = await fetch(url!);
      const buffer = await res.arrayBuffer();
      const dicomParser = await import('dicom-parser');
      const dataSet = dicomParser.parseDicom(new Uint8Array(buffer));
      const rows = dataSet.uint16('x00280010') ?? 256;
      const cols = dataSet.uint16('x00280011') ?? 256;
      const pixelDataElement = dataSet.elements.x7fe00010;
      if (!pixelDataElement || cancelled || !canvasRef.current) return;

      const canvas = canvasRef.current;
      canvas.width = cols;
      canvas.height = rows;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bytes = new Uint8Array(buffer, pixelDataElement.dataOffset, pixelDataElement.length);
      const imageData = ctx.createImageData(cols, rows);
      const low = windowCenter - windowWidth / 2;
      const high = windowCenter + windowWidth / 2;

      for (let i = 0; i < cols * rows; i++) {
        const raw = bytes[i] ?? 0;
        let v = ((raw - low) / (high - low)) * 255;
        v = Math.max(0, Math.min(255, v));
        const o = i * 4;
        imageData.data[o] = imageData.data[o + 1] = imageData.data[o + 2] = v;
        imageData.data[o + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    void render();
    return () => { cancelled = true; };
  }, [url, windowWidth, windowCenter]);

  if (loading) return <div aria-busy="true" />;

  return (
    <canvas
      ref={canvasRef}
      style={{ transform: `scale(${scale})`, imageRendering: 'pixelated' }}
    />
  );
}
