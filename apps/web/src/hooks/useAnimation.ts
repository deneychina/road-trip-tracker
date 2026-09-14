import { useRef, useState, useCallback, useEffect } from 'react';

interface AnimationState {
  playing: boolean;
  progress: number;
  speedKmh: number;
  followCamera: boolean;
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

function calcBearing(from: [number, number], to: [number, number]): number {
  const lat1 = (from[1] * Math.PI) / 180;
  const lat2 = (to[1] * Math.PI) / 180;
  const dLng = ((to[0] - from[0]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <defs>
    <filter id="ds" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <circle cx="12" cy="12" r="8" fill="#3b82f6" filter="url(#ds)" stroke="#fff" stroke-width="2"/>
</svg>`;

export function useAnimation(
  map: AMap.Map | null,
  path: [number, number][]
) {
  const markerRef = useRef<AMap.Marker | null>(null);
  const traveledRef = useRef<AMap.Polyline | null>(null);
  const pathRef = useRef<[number, number][]>(path);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedKmhRef = useRef(100);
  const mapRef = useRef<AMap.Map | null>(map);
  const progressRef = useRef(0);
  const totalDistKmRef = useRef(0);
  const followCameraRef = useRef(false);
  const originalViewRef = useRef<{ zoom: number; center: [number, number]; pitch: number; rotation: number } | null>(null);
  const cameraTargetRef = useRef<{ center: [number, number]; rotation: number } | null>(null);

  const [state, setState] = useState<AnimationState>({
    playing: false,
    progress: 0,
    speedKmh: 100,
    followCamera: false,
  });

  pathRef.current = path;
  mapRef.current = map;

  const stopInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const cleanupOverlays = useCallback(() => {
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    if (traveledRef.current) {
      traveledRef.current.setMap(null);
      traveledRef.current = null;
    }
  }, []);

  const getPointAtFraction = useCallback((fraction: number): [number, number] => {
    const p = pathRef.current;
    if (p.length === 0) return [0, 0];
    const idx = fraction * (p.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, p.length - 1);
    const t = idx - lo;
    return [
      p[lo][0] + (p[hi][0] - p[lo][0]) * t,
      p[lo][1] + (p[hi][1] - p[lo][1]) * t,
    ];
  }, []);

  const recalcDuration = useCallback((speedKmh: number) => {
    if (speedKmh <= 0 || totalDistKmRef.current <= 0) {
      durationRef.current = 0;
      return;
    }
    // 优化：使用更小的系数让动画更快
    // 原公式：(dist / speed) * 36000 导致 747km@100km/h 需要 4.5 分钟
    // 新公式：(dist / speed) * 1000 让 747km@100km/h 只需 7.5 秒
    durationRef.current = (totalDistKmRef.current / speedKmh) * 1000;
  }, []);

  const tick = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const dur = durationRef.current;
    const fraction = dur > 0 ? Math.min(elapsed / dur, 1) : 1;
    progressRef.current = fraction;

    const currentMap = mapRef.current;
    const marker = markerRef.current;
    const traveled = traveledRef.current;

    if (currentMap && marker && traveled) {
      const currentPos = getPointAtFraction(fraction);
      marker.setPosition(currentPos);

      const p = pathRef.current;
      const idx = Math.floor(fraction * (p.length - 1));
      const nextIdx = Math.min(idx + 1, p.length - 1);
      let bearing = 0;
      if (idx < nextIdx) {
        bearing = calcBearing(p[idx], p[nextIdx]);
        marker.setAngle(-bearing);
      }

      const traveledPath = p.slice(0, idx + 1);
      traveledPath.push(currentPos);
      traveled.setPath(traveledPath);

      if (followCameraRef.current) {
        if (!cameraTargetRef.current) {
          cameraTargetRef.current = { center: currentPos, rotation: -bearing };
        }
        const target = cameraTargetRef.current;
        const centerLerp = 0.15;
        const rotationLerp = 0.02;
        const newCenter: [number, number] = [
          target.center[0] + (currentPos[0] - target.center[0]) * centerLerp,
          target.center[1] + (currentPos[1] - target.center[1]) * centerLerp,
        ];
        let targetRotation = -bearing;
        let currentRotation = target.rotation;
        let rotationDiff = targetRotation - currentRotation;
        while (rotationDiff > 180) rotationDiff -= 360;
        while (rotationDiff < -180) rotationDiff += 360;
        const newRotation = currentRotation + rotationDiff * rotationLerp;
        cameraTargetRef.current = { center: newCenter, rotation: newRotation };
        currentMap.setCenter(newCenter);
        currentMap.setRotation(newRotation);
        currentMap.setZoom(9);
      }
    }

    setState((s) => {
      if (Math.abs(s.progress - fraction) < 0.005 && s.playing === true) return s;
      return { ...s, progress: fraction };
    });

    if (fraction >= 1) {
      stopInterval();
      cleanupOverlays();
      if (followCameraRef.current && originalViewRef.current) {
        const v = originalViewRef.current;
        currentMap?.setZoom(v.zoom);
        currentMap?.setCenter(v.center);
        currentMap?.setPitch(v.pitch);
        currentMap?.setRotation(v.rotation);
      }
      setState({ playing: false, progress: 1, speedKmh: speedKmhRef.current, followCamera: false });
      followCameraRef.current = false;
      originalViewRef.current = null;
      cameraTargetRef.current = null;
    }
  }, [getPointAtFraction, stopInterval, cleanupOverlays]);

  const play = useCallback(
    (totalSeconds?: number, enableFollowCamera?: boolean) => {
      const currentMap = mapRef.current;
      if (!currentMap || pathRef.current.length < 2) return;

      stopInterval();
      cleanupOverlays();

      totalDistKmRef.current = calcPathDistanceKm(pathRef.current);

      if (enableFollowCamera) {
        const center = currentMap.getCenter();
        originalViewRef.current = {
          zoom: currentMap.getZoom(),
          center: [center.getLng(), center.getLat()],
          pitch: currentMap.getPitch(),
          rotation: currentMap.getRotation(),
        };
        followCameraRef.current = true;
        cameraTargetRef.current = null;
        currentMap.setPitch(60);
      } else {
        followCameraRef.current = false;
        originalViewRef.current = null;
        cameraTargetRef.current = null;
      }

      const marker = new AMap.Marker({
        position: pathRef.current[0],
        content: `<div style="transform-origin:center center">${CAR_SVG}</div>`,
        offset: new AMap.Pixel(-12, -12),
        zIndex: 200,
      });
      marker.setMap(currentMap);
      markerRef.current = marker;

      const traveled = new AMap.Polyline({
        path: [pathRef.current[0]],
        strokeColor: '#3b82f6',
        strokeWeight: 5,
        strokeOpacity: 1,
        lineJoin: 'round',
        zIndex: 100,
      });
      traveled.setMap(currentMap);
      traveledRef.current = traveled;

      if (totalSeconds) {
        durationRef.current = totalSeconds * 1000;
      } else {
        recalcDuration(speedKmhRef.current);
      }
      startTimeRef.current = Date.now();
      progressRef.current = 0;

      setState({ playing: true, progress: 0, speedKmh: speedKmhRef.current, followCamera: !!enableFollowCamera });
      intervalRef.current = setInterval(tick, 30);
    },
    [tick, stopInterval, cleanupOverlays, recalcDuration]
  );

  const pause = useCallback(() => {
    stopInterval();
    setState((s) => ({ ...s, playing: false }));
  }, [stopInterval]);

  const resume = useCallback(() => {
    const prog = progressRef.current;
    if (prog >= 1) return;
    const dur = durationRef.current;
    startTimeRef.current = Date.now() - prog * dur;
    setState((s) => ({ ...s, playing: true }));
    intervalRef.current = setInterval(tick, 30);
  }, [tick]);

  const setSpeedKmh = useCallback(
    (kmh: number) => {
      const prog = progressRef.current;
      speedKmhRef.current = kmh;
      if (intervalRef.current !== null) {
        const dur = durationRef.current;
        const elapsed = prog * dur;
        recalcDuration(kmh);
        startTimeRef.current = Date.now() - elapsed;
      }
      setState((s) => ({ ...s, speedKmh: kmh }));
    },
    [recalcDuration]
  );

  const reset = useCallback(() => {
    stopInterval();
    cleanupOverlays();
    progressRef.current = 0;
    if (followCameraRef.current && originalViewRef.current && mapRef.current) {
      const v = originalViewRef.current;
      mapRef.current.setZoom(v.zoom);
      mapRef.current.setCenter(v.center);
      mapRef.current.setPitch(v.pitch);
      mapRef.current.setRotation(v.rotation);
    }
    followCameraRef.current = false;
    originalViewRef.current = null;
    setState({ playing: false, progress: 0, speedKmh: speedKmhRef.current, followCamera: false });
  }, [stopInterval, cleanupOverlays]);

  const seekTo = useCallback((fraction: number) => {
    const f = Math.max(0, Math.min(1, fraction));
    const dur = durationRef.current;
    if (dur <= 0) return;

    progressRef.current = f;
    startTimeRef.current = Date.now() - f * dur;

    const currentMap = mapRef.current;
    const currentPos = getPointAtFraction(f);
    const p = pathRef.current;
    const idx = Math.floor(f * (p.length - 1));
    const nextIdx = Math.min(idx + 1, p.length - 1);
    let bearing = 0;
    if (idx < nextIdx) {
      bearing = calcBearing(p[idx], p[nextIdx]);
    }

    if (!markerRef.current && currentMap) {
      const marker = new AMap.Marker({
        position: currentPos,
        content: `<div style="transform-origin:center center">${CAR_SVG}</div>`,
        offset: new AMap.Pixel(-12, -12),
        zIndex: 200,
      });
      marker.setMap(currentMap);
      marker.setAngle(-bearing);
      markerRef.current = marker;
    }

    if (!traveledRef.current && currentMap) {
      const traveled = new AMap.Polyline({
        path: [...p.slice(0, idx + 1), currentPos],
        strokeColor: '#3b82f6',
        strokeWeight: 5,
        strokeOpacity: 1,
        lineJoin: 'round',
        zIndex: 100,
      });
      traveled.setMap(currentMap);
      traveledRef.current = traveled;
    }

    if (currentMap && markerRef.current && traveledRef.current) {
      markerRef.current.setPosition(currentPos);
      markerRef.current.setAngle(-bearing);
      traveledRef.current.setPath([...p.slice(0, idx + 1), currentPos]);
    }

    if (followCameraRef.current && currentMap) {
      cameraTargetRef.current = { center: currentPos, rotation: -bearing };
      currentMap.setCenter(currentPos);
      currentMap.setRotation(-bearing);
    }

    setState((s) => ({ ...s, progress: f }));
  }, [getPointAtFraction]);

  const toggleFollowCamera = useCallback(() => {
    followCameraRef.current = !followCameraRef.current;
    setState((s) => ({ ...s, followCamera: followCameraRef.current }));
  }, []);

  useEffect(() => {
    return () => {
      stopInterval();
      cleanupOverlays();
    };
  }, [stopInterval, cleanupOverlays]);

  return { ...state, play, pause, resume, setSpeedKmh, reset, toggleFollowCamera, seekTo };
}
