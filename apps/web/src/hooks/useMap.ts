import { useEffect, useRef, useState } from 'react';
import { loadAMap } from '../lib/amap-loader';

export function useMap(containerRef: React.RefObject<HTMLDivElement | null>) {
  const mapRef = useRef<AMap.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    loadAMap().then((AMap) => {
      if (destroyed || !containerRef.current) return;

      const map = new AMap.Map(containerRef.current, {
        zoom: 5,
        center: [104.0, 35.0],
        viewMode: '3D',
        pitch: 50,
        terrain: true,
        resizeEnable: true,
      });

      mapRef.current = map;
      setReady(true);
    });

    return () => {
      destroyed = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [containerRef]);

  return { map: mapRef.current, ready };
}
