import { useRef, useCallback, useEffect, useState } from 'react';
import { useMap } from '../../hooks/useMap';
import type { Trip } from '@road-trip/shared';
import type { HighwayRoute } from '@road-trip/shared';

interface MapViewProps {
  trip: Trip | undefined;
  onSetOrigin: (loc: [number, number]) => void;
  onSetDest: (loc: [number, number]) => void;
  originMarker: [number, number] | null;
  destMarker: [number, number] | null;
  onOriginDrag?: (loc: [number, number]) => void;
  onDestDrag?: (loc: [number, number]) => void;
  waypoints?: [number, number][];
  onWaypointDrag?: (index: number, newLoc: [number, number]) => void;
  animationOverlays?: {
    traveled: [number, number][];
    remaining: [number, number][];
    carPos: [number, number] | null;
  } | null;
  onMapReady?: (map: AMap.Map) => void;
  highwayRoute?: HighwayRoute | null;
}

export default function MapView({
  trip,
  onSetOrigin,
  onSetDest,
  originMarker,
  destMarker,
  onOriginDrag,
  onDestDrag,
  waypoints,
  onWaypointDrag,
  animationOverlays,
  onMapReady,
  highwayRoute,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, ready } = useMap(containerRef);
  const overlaysRef = useRef<AMap.Polyline[]>([]);
  const markersRef = useRef<AMap.Marker[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    loc: [number, number];
  } | null>(null);

  const clearOverlays = useCallback(() => {
    if (!map) return;
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  }, [map]);

  useEffect(() => {
    if (ready && map && onMapReady) {
      onMapReady(map);
    }
  }, [ready, map, onMapReady]);

  useEffect(() => {
    if (!ready || !map) return;
    clearOverlays();

    const polylines: AMap.Polyline[] = [];

    if (animationOverlays) {
      if (animationOverlays.traveled.length > 1) {
        const traveled = new AMap.Polyline({
          path: animationOverlays.traveled,
          strokeColor: '#3b82f6',
          strokeWeight: 5,
          strokeOpacity: 1,
          lineJoin: 'round',
          zIndex: 100,
        });
        traveled.setMap(map);
        polylines.push(traveled);
      }
      if (animationOverlays.remaining.length > 1) {
        const remaining = new AMap.Polyline({
          path: animationOverlays.remaining,
          strokeColor: '#9ca3af',
          strokeWeight: 3,
          strokeOpacity: 0.6,
          strokeStyle: 'dashed',
          lineJoin: 'round',
          zIndex: 99,
        });
        remaining.setMap(map);
        polylines.push(remaining);
      }
      overlaysRef.current = polylines;
      return;
    }

    if (highwayRoute && highwayRoute.segments.length > 0) {
      for (const seg of highwayRoute.segments) {
        if (seg.length < 2) continue;
        const pl = new AMap.Polyline({
          path: seg,
          strokeColor: '#ef4444',
          strokeWeight: 4,
          strokeOpacity: 0.85,
          lineJoin: 'round',
          zIndex: 50,
        });
        pl.setMap(map);
        polylines.push(pl);
      }
      overlaysRef.current = polylines;
      if (polylines.length > 0) {
        map.setFitView(polylines, false, [50, 50, 50, 50]);
      }
      return;
    }

    if (trip?.route?.path && trip.route.path.length > 1) {
      const pl = new AMap.Polyline({
        path: trip.route.path,
        strokeColor: '#3b82f6',
        strokeWeight: 4,
        strokeOpacity: 0.9,
        lineJoin: 'round',
        zIndex: 50,
      });
      pl.setMap(map);
      polylines.push(pl);
    }

    overlaysRef.current = polylines;

    if (polylines.length > 0) {
      map.setFitView(polylines, false, [50, 50, 50, 50]);
    }
  }, [ready, map, trip, animationOverlays, clearOverlays, highwayRoute]);

  useEffect(() => {
    if (!ready || !map) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const markers: AMap.Marker[] = [];

    if (originMarker) {
      const m = new AMap.Marker({
        position: originMarker,
        content:
          '<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))"><svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26s16-15.5 16-26C32 7.163 24.837 0 16 0z" fill="#22c55e"/><circle cx="16" cy="15" r="7" fill="#fff"/><text x="16" y="19" text-anchor="middle" font-size="11" font-weight="bold" fill="#22c55e">A</text></svg></div>',
        offset: new AMap.Pixel(-16, -42),
        draggable: true,
        zIndex: 120,
      });
      m.setMap(map);
      if (onOriginDrag) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        m.on('dragend', (e: any) => {
          const lnglat = e.lnglat as AMap.LngLat;
          if (lnglat) {
            onOriginDrag([lnglat.getLng(), lnglat.getLat()]);
          }
        });
      }
      markers.push(m);
    }

    if (destMarker) {
      const m = new AMap.Marker({
        position: destMarker,
        content:
          '<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))"><svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26s16-15.5 16-26C32 7.163 24.837 0 16 0z" fill="#ef4444"/><circle cx="16" cy="15" r="7" fill="#fff"/><text x="16" y="19" text-anchor="middle" font-size="11" font-weight="bold" fill="#ef4444">B</text></svg></div>',
        offset: new AMap.Pixel(-16, -42),
        draggable: true,
        zIndex: 120,
      });
      m.setMap(map);
      if (onDestDrag) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        m.on('dragend', (e: any) => {
          const lnglat = e.lnglat as AMap.LngLat;
          if (lnglat) {
            onDestDrag([lnglat.getLng(), lnglat.getLat()]);
          }
        });
      }
      markers.push(m);
    }

    if (waypoints && waypoints.length > 0 && onWaypointDrag) {
      waypoints.forEach((wp, idx) => {
        const m = new AMap.Marker({
          position: wp,
          content:
            '<div style="background:#f59e0b;color:#fff;border-radius:50%;width:11px;height:11px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:grab"></div>',
          offset: new AMap.Pixel(-6, -6),
          draggable: true,
          zIndex: 115,
        });
        m.setMap(map);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        m.on('dragend', (e: any) => {
          const lnglat = e.lnglat as AMap.LngLat;
          if (lnglat) {
            onWaypointDrag(idx, [lnglat.getLng(), lnglat.getLat()]);
          }
        });
        markers.push(m);
      });
    }

    if (highwayRoute && !originMarker && !destMarker) {
      const startM = new AMap.Marker({
        position: highwayRoute.start,
        content:
          '<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))"><svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26s16-15.5 16-26C32 7.163 24.837 0 16 0z" fill="#22c55e"/><circle cx="16" cy="15" r="7" fill="#fff"/><text x="16" y="19" text-anchor="middle" font-size="10" font-weight="bold" fill="#22c55e">起</text></svg></div>',
        offset: new AMap.Pixel(-16, -42),
        zIndex: 120,
      });
      startM.setMap(map);
      markers.push(startM);

      const endM = new AMap.Marker({
        position: highwayRoute.end,
        content:
          '<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))"><svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26s16-15.5 16-26C32 7.163 24.837 0 16 0z" fill="#ef4444"/><circle cx="16" cy="15" r="7" fill="#fff"/><text x="16" y="19" text-anchor="middle" font-size="10" font-weight="bold" fill="#ef4444">终</text></svg></div>',
        offset: new AMap.Pixel(-16, -42),
        zIndex: 120,
      });
      endM.setMap(map);
      markers.push(endM);
    }

    markersRef.current = markers;
  }, [ready, map, originMarker, destMarker, waypoints, onWaypointDrag, onOriginDrag, onDestDrag, highwayRoute]);

  useEffect(() => {
    if (!ready || !map) return;

    const closeMenu = () => setContextMenu(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleRightClick = (e: any) => {
      const lnglat = e.lnglat as AMap.LngLat;
      if (!lnglat) return;
      const pixel = map.lngLatToContainer(lnglat);
      setContextMenu({
        x: pixel.getX(),
        y: pixel.getY(),
        loc: [lnglat.getLng(), lnglat.getLat()],
      });
    };

    map.on('rightclick', handleRightClick);
    map.on('click', closeMenu);
    map.on('movestart', closeMenu);

    return () => {
      map.off('rightclick', handleRightClick);
      map.off('click', closeMenu);
      map.off('movestart', closeMenu);
    };
  }, [ready, map]);

  return (
    <div className="map-container">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!ready && <div className="map-loading">地图加载中...</div>}
      {contextMenu && (
        <div
          className="map-context-menu"
          style={{
            position: 'absolute',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 200,
          }}
        >
          <button
            onClick={() => {
              onSetOrigin(contextMenu.loc);
              setContextMenu(null);
            }}
          >
            设为起点
          </button>
          <button
            onClick={() => {
              onSetDest(contextMenu.loc);
              setContextMenu(null);
            }}
          >
            设为终点
          </button>
        </div>
      )}
      <div className="map-hint">右键点击地图设置起点或终点</div>
    </div>
  );
}
