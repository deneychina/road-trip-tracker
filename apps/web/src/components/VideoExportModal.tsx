import { useEffect, useRef, useState, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { loadAMap } from '../lib/amap-loader';
import type { RoutePlan } from '@road-trip/shared';

interface VideoExportModalProps {
  route: RoutePlan;
  tripName: string;
  onClose: () => void;
}

type ExportStatus = 'initializing' | 'ready' | 'recording' | 'encoding' | 'done' | 'error';

const DOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <defs>
    <filter id="ds" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <circle cx="12" cy="12" r="8" fill="#3b82f6" filter="url(#ds)" stroke="#fff" stroke-width="2"/>
</svg>`;

const FPS = 30;

function calcBearing(from: [number, number], to: [number, number]): number {
  const lat1 = (from[1] * Math.PI) / 180;
  const lat2 = (to[1] * Math.PI) / 180;
  const dLng = ((to[0] - from[0]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function calcPathDistanceKm(path: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversine(path[i - 1], path[i]);
  }
  return total / 1000;
}

function calcDurationFromSpeed(path: [number, number][], speedKmh: number): number {
  const minSpeed = 10;
  const maxSpeed = 120;
  const minDuration = 5;
  const maxDuration = 60;
  const ratio = (speedKmh - minSpeed) / (maxSpeed - minSpeed);
  return minDuration + ratio * (maxDuration - minDuration);
}

export default function VideoExportModal({ route, tripName, onClose }: VideoExportModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMap.Map | null>(null);
  const routePolylineRef = useRef<AMap.Polyline | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animStartRef = useRef(0);
  const framesRef = useRef<Blob[]>([]);
  const capturingRef = useRef(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [status, setStatus] = useState<ExportStatus>('initializing');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [speedKmh, setSpeedKmh] = useState(100);
  const [encodeProgress, setEncodeProgress] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  const getPointAtFraction = useCallback(
    (fraction: number, path: [number, number][]): [number, number] => {
      if (path.length === 0) return [0, 0];
      const idx = fraction * (path.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.min(lo + 1, path.length - 1);
      const t = idx - lo;
      return [
        path[lo][0] + (path[hi][0] - path[lo][0]) * t,
        path[lo][1] + (path[hi][1] - path[lo][1]) * t,
      ];
    },
    []
  );

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (mapRef.current) {
      mapRef.current.destroy();
      mapRef.current = null;
    }
  }, []);

  const encodeVideo = useCallback(
    async (frames: Blob[]) => {
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      ffmpeg.on('progress', ({ progress: p }) => {
        setEncodeProgress(Math.round(p * 100));
      });

      setStatus('encoding');
      setEncodeProgress(0);

      try {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        for (let i = 0; i < frames.length; i++) {
          const data = await frames[i].arrayBuffer();
          await ffmpeg.writeFile(`frame_${String(i).padStart(5, '0')}.jpg`, new Uint8Array(data));
          frames[i] = null as unknown as Blob;
        }

        await ffmpeg.exec([
          '-framerate', String(FPS),
          '-i', 'frame_%05d.jpg',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-crf', '18',
          '-preset', 'medium',
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
          'output.mp4',
        ]);

        const data = await ffmpeg.readFile('output.mp4');
        const blob = new Blob([data as Uint8Array], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tripName || 'route-animation'}.mp4`;
        a.click();
        URL.revokeObjectURL(url);

        await ffmpeg.terminate();
        ffmpegRef.current = null;
        setStatus('done');
      } catch (err) {
        console.error('encode error:', err);
        setErrorMsg(`编码失败：${err instanceof Error ? err.message : String(err)}`);
        setStatus('error');
        try { await ffmpeg.terminate(); } catch { /* ignore */ }
        ffmpegRef.current = null;
      }
    },
    [tripName]
  );

  const startAnimation = useCallback(
    (
      map: AMap.Map,
      path: [number, number][],
      durationMs: number,
      canvas: HTMLCanvasElement,
      onComplete?: (frames: Blob[]) => void
    ) => {
      const dotMarker = new AMap.Marker({
        position: getPointAtFraction(0, path),
        content: `<div style="transform-origin:center center">${DOT_SVG}</div>`,
        offset: new AMap.Pixel(-12, -12),
        zIndex: 200,
      });
      dotMarker.setMap(map);

      const traveled = new AMap.Polyline({
        path: [path[0]],
        strokeColor: '#3b82f6',
        strokeWeight: 5,
        strokeOpacity: 1,
        lineJoin: 'round',
        zIndex: 100,
      });
      traveled.setMap(map);

      map.setPitch(60);
      map.setZoom(7);

      const cameraTarget = {
        center: [...path[0]] as [number, number],
        rotation: 0,
      };

      animStartRef.current = Date.now();
      framesRef.current = [];
      capturingRef.current = true;
      setFrameCount(0);

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - animStartRef.current;
        const fraction = Math.min(elapsed / durationMs, 1);
        setProgress(fraction);

        const currentPos = getPointAtFraction(fraction, path);
        dotMarker.setPosition(currentPos);

        const idx = Math.floor(fraction * (path.length - 1));
        const nextIdx = Math.min(idx + 1, path.length - 1);
        let bearing = 0;
        if (idx < nextIdx) {
          bearing = calcBearing(path[idx], path[nextIdx]);
        }

        traveled.setPath([...path.slice(0, idx + 1), currentPos]);

        const centerLerp = 0.15;
        const rotationLerp = 0.02;
        const targetRotation = -bearing;
        let rotationDiff = targetRotation - cameraTarget.rotation;
        while (rotationDiff > 180) rotationDiff -= 360;
        while (rotationDiff < -180) rotationDiff += 360;
        cameraTarget.rotation += rotationDiff * rotationLerp;
        cameraTarget.center = [
          cameraTarget.center[0] + (currentPos[0] - cameraTarget.center[0]) * centerLerp,
          cameraTarget.center[1] + (currentPos[1] - cameraTarget.center[1]) * centerLerp,
        ];

        map.setCenter(cameraTarget.center);
        map.setRotation(cameraTarget.rotation);

        if (capturingRef.current) {
          capturingRef.current = false;
          canvas.toBlob(
            (blob) => {
              if (blob) {
                framesRef.current.push(blob);
                setFrameCount(framesRef.current.length);
              }
              capturingRef.current = true;
            },
            'image/jpeg',
            0.9
          );
        }

        if (fraction >= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          dotMarker.setMap(null);
          traveled.setMap(null);
          if (routePolylineRef.current) {
            routePolylineRef.current.setMap(mapRef.current);
          }
          capturingRef.current = false;
          onComplete?.(framesRef.current);
        }
      }, 1000 / FPS);
    },
    [getPointAtFraction]
  );

  const handleStart = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const mapCanvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!mapCanvas) {
      setErrorMsg('无法获取地图画布');
      setStatus('error');
      return;
    }

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
    }

    map.setPitch(60);
    map.setZoom(7);
    map.setCenter(route.path[0]);

    setStatus('recording');
    setProgress(0);
    setFrameCount(0);

    const durationSec = calcDurationFromSpeed(route.path, speedKmh);
    startAnimation(map, route.path, durationSec * 1000, mapCanvas, (frames) => {
      encodeVideo(frames);
    });
  }, [route.path, speedKmh, startAnimation, encodeVideo]);

  const handleStop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    capturingRef.current = false;
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(mapRef.current);
    }
    const frames = framesRef.current;
    framesRef.current = [];
    if (frames.length > 10) {
      encodeVideo(frames);
    } else {
      setStatus('done');
    }
  }, [encodeVideo]);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    loadAMap().then((AMap) => {
      if (cancelled || !containerRef.current) return;

      const map = new AMap.Map(containerRef.current, {
        zoom: 7,
        center: route.path[0] || [104.0, 35.0],
        viewMode: '3D',
        pitch: 60,
        terrain: true,
        resizeEnable: true,
        preserveDrawingBuffer: true,
      });
      mapRef.current = map;

      map.on('complete', () => {
        if (cancelled) return;
        const routePolyline = new AMap.Polyline({
          path: route.path,
          strokeColor: '#3b82f6',
          strokeWeight: 4,
          strokeOpacity: 0.9,
          lineJoin: 'round',
          zIndex: 50,
        });
        routePolyline.setMap(map);
        routePolylineRef.current = routePolyline;
        setStatus('ready');
      });
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [route, cleanup]);

  const handleClose = useCallback(() => {
    cleanup();
    if (ffmpegRef.current) {
      ffmpegRef.current.terminate().catch(() => {});
    }
    onClose();
  }, [cleanup, onClose]);

  const durationSec = calcDurationFromSpeed(route.path, speedKmh);

  return (
    <div className="video-modal-overlay">
      <div className="video-modal">
        <div className="video-modal-header">
          <h3>导出视频 (9:16)</h3>
          <button className="video-modal-close" onClick={handleClose}>
            &times;
          </button>
        </div>
        <div className="video-preview-container">
          <div ref={containerRef} className="video-preview-map" />
          {status === 'initializing' && (
            <div className="video-status-overlay">初始化地图...</div>
          )}
          {status === 'error' && (
            <div className="video-status-overlay error">{errorMsg}</div>
          )}
        </div>
        <div className="video-modal-footer">
          {status === 'ready' && (
            <>
              <div className="speed-row">
                <label className="speed-label">行进速度</label>
                <input
                  type="range"
                  className="speed-slider"
                  min={10}
                  max={120}
                  step={10}
                  value={speedKmh}
                  onChange={(e) => setSpeedKmh(Number(e.target.value))}
                />
              </div>
              <div className="video-duration-preview">
                预计时长: {durationSec.toFixed(0)}秒
              </div>
              <button className="btn-primary" onClick={handleStart}>
                开始录制
              </button>
            </>
          )}
          {status === 'recording' && (
            <div className="video-recording-status">
              <div className="recording-header">
                <span className="recording-dot-active" />
                录制中 {Math.round(progress * 100)}% ({frameCount} 帧)
              </div>
              <div className="video-progress-bar">
                <div
                  className="video-progress-fill"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="recording-controls">
                <button className="btn-control btn-stop" onClick={handleStop}>
                  ⏹ 停止并编码
                </button>
              </div>
            </div>
          )}
          {status === 'encoding' && (
            <div className="video-recording-status">
              <div className="recording-header">
                编码中... {encodeProgress}%
              </div>
              <div className="recording-subheader">
                共 {frameCount} 帧，正在生成 MP4 视频
              </div>
              <div className="video-progress-bar">
                <div
                  className="video-progress-fill"
                  style={{ width: `${encodeProgress}%` }}
                />
              </div>
            </div>
          )}
          {status === 'done' && (
            <div className="video-done-status">
              录制完成，视频已开始下载
              <button className="btn-primary" onClick={handleClose} style={{ marginTop: 8 }}>
                关闭
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
