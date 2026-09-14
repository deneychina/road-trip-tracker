import { useState, useCallback, useEffect } from 'react';
import MapView from './components/MapView/MapView';
import Sidebar from './components/Sidebar/Sidebar';
import VideoExportModal from './components/VideoExportModal';
import { useTripStore } from './store/trip-store';
import { useAnimation } from './hooks/useAnimation';
import { planRoute, planRouteSegmented, type DrivingPolicy, type RoadType } from './lib/driving';
import { computeWaypoints, snapToPath, findClosestPathIndex, calcPathDistance } from '@road-trip/shared';
import { queryHighway, type HighwayRoute } from '@road-trip/shared';
import type { PresetRoute } from '@road-trip/shared';
import type { Trip } from '@road-trip/shared';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function reverseGeocode(loc: [number, number]): Promise<string> {
  return new Promise((resolve) => {
    const geocoder = new AMap.Geocoder();
    geocoder.getAddress(loc, (status: string, result: Record<string, unknown>) => {
      if (status === 'complete' && result.regeocode) {
        resolve(result.regeocode.formattedAddress as string);
      } else {
        resolve(`${loc[1].toFixed(4)}, ${loc[0].toFixed(4)}`);
      }
    });
  });
}

function geocode(name: string): Promise<[number, number] | null> {
  return new Promise((resolve) => {
    const geocoder = new AMap.Geocoder();
    geocoder.getLocation(name, (status: string, result: Record<string, unknown>) => {
      if (status === 'complete' && result.geocodes && (result.geocodes as any[]).length > 0) {
        const loc = (result.geocodes as any[])[0].location;
        resolve([loc.lng, loc.lat]);
      } else {
        resolve(null);
      }
    });
  });
}

export default function App() {
  const {
    trips,
    currentId,
    currentTrip,
    load,
    addTrip,
    updateTrip,
    removeTrip,
    setCurrentId,
  } = useTripStore();

  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const [dest, setDest] = useState<[number, number] | null>(null);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animationOverlays, setAnimationOverlays] = useState<{
    traveled: [number, number][];
    remaining: [number, number][];
    carPos: [number, number] | null;
  } | null>(null);
  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  const [policy, setPolicy] = useState<DrivingPolicy>(0);
  const [roadType, setRoadType] = useState<RoadType>('highway');
  const [originName, setOriginName] = useState('');
  const [destName, setDestName] = useState('');

  const [mapInstance, setMapInstance] = useState<AMap.Map | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [highwayRoute, setHighwayRoute] = useState<HighwayRoute | null>(null);
  const [highwayLoading, setHighwayLoading] = useState(false);
  const [plannerWaypoints, setPlannerWaypoints] = useState<{ name: string; loc: [number, number] }[]>([]);

  const trip = currentTrip();
  const routePath = trip?.route?.path ?? [];

  const animation = useAnimation(mapInstance, routePath);

  useEffect(() => {
    load();
  }, [load]);

  const handleSetOrigin = useCallback(async (loc: [number, number]) => {
    setOrigin(loc);
    setError(null);
    const name = await reverseGeocode(loc);
    setOriginName(name);
    if (dest) {
      setPlanning(true);
      try {
        const route = await planRoute(loc, dest, waypoints, policy, roadType);
        const computedWps = computeWaypoints(route.path);
        const newTrip: Trip = {
          id: generateId(),
          name: `行程 ${trips.length + 1}`,
          mode: 'planned',
          createdAt: Date.now(),
          origin: { name, loc },
          dest: { name: destName || `${dest[1].toFixed(4)}, ${dest[0].toFixed(4)}`, loc: dest },
          waypoints: computedWps.map((l) => ({ name: '', loc: l })),
          policy,
          route,
          distance: route.distance,
          duration: route.time,
        };
        setWaypoints(computedWps);
        await addTrip(newTrip);
      } catch (e) {
        setError(e instanceof Error ? e.message : '路线规划失败');
      } finally {
        setPlanning(false);
      }
    }
  }, [dest, destName, waypoints, policy, roadType, trips.length, addTrip]);

  const handleSetDest = useCallback(async (loc: [number, number]) => {
    setDest(loc);
    setError(null);
    const name = await reverseGeocode(loc);
    setDestName(name);
    if (origin) {
      setPlanning(true);
      try {
        const route = await planRoute(origin, loc, waypoints, policy, roadType);
        const computedWps = computeWaypoints(route.path);
        const newTrip: Trip = {
          id: generateId(),
          name: `行程 ${trips.length + 1}`,
          mode: 'planned',
          createdAt: Date.now(),
          origin: { name: originName || `${origin[1].toFixed(4)}, ${origin[0].toFixed(4)}`, loc: origin },
          dest: { name, loc },
          waypoints: computedWps.map((l) => ({ name: '', loc: l })),
          policy,
          route,
          distance: route.distance,
          duration: route.time,
        };
        setWaypoints(computedWps);
        await addTrip(newTrip);
      } catch (e) {
        setError(e instanceof Error ? e.message : '路线规划失败');
      } finally {
        setPlanning(false);
      }
    }
  }, [origin, originName, waypoints, policy, roadType, trips.length, addTrip]);

  const handleOriginSelect = useCallback((name: string, loc: [number, number]) => {
    setOriginName(name);
    setOrigin(loc);
    setError(null);
  }, []);

  const handleDestSelect = useCallback((name: string, loc: [number, number]) => {
    setDestName(name);
    setDest(loc);
    setError(null);
  }, []);

  const handlePlanRoute = useCallback(async () => {
    let startLoc = origin;
    let endLoc = dest;

    // 如果坐标未设置，尝试通过地名解析
    if (!startLoc && originName) {
      startLoc = await geocode(originName);
      if (startLoc) setOrigin(startLoc);
    }
    if (!endLoc && destName) {
      endLoc = await geocode(destName);
      if (endLoc) setDest(endLoc);
    }

    if (!startLoc || !endLoc) {
      setError('请先输入或选择起点和终点');
      return;
    }
    setPlanning(true);
    setError(null);

    try {
      const plannerWpsCoords = plannerWaypoints.filter(wp => wp.loc[0] !== 0 || wp.loc[1] !== 0).map(wp => wp.loc);
      const route = await planRoute(startLoc, endLoc, plannerWpsCoords, policy, roadType);
      const computedWaypoints = computeWaypoints(route.path);
      const newTrip: Trip = {
        id: generateId(),
        name: `行程 ${trips.length + 1}`,
        mode: 'planned',
        createdAt: Date.now(),
        origin: { name: originName || `${startLoc[1].toFixed(4)}, ${startLoc[0].toFixed(4)}`, loc: startLoc },
        dest: { name: destName || `${endLoc[1].toFixed(4)}, ${endLoc[0].toFixed(4)}`, loc: endLoc },
        waypoints: computedWaypoints.map((loc) => ({ name: '', loc })),
        policy,
        route,
        distance: route.distance,
        duration: route.time,
      };
      setWaypoints(computedWaypoints);
      await addTrip(newTrip);
    } catch (e) {
      setError(e instanceof Error ? e.message : '路线规划失败');
    } finally {
      setPlanning(false);
    }
  }, [origin, dest, originName, destName, plannerWaypoints, policy, roadType, trips.length, addTrip]);

  const handleWaypointDrag = useCallback(
    async (index: number, newLoc: [number, number]) => {
      const o = origin || trip?.origin?.loc;
      const d = dest || trip?.dest?.loc;
      const currentPath = trip?.route?.path;
      if (!o || !d || !currentPath || currentPath.length < 2) return;

      const snappedLoc = snapToPath(newLoc, currentPath, 10000);
      const newWaypoints = [...waypoints];
      newWaypoints[index] = snappedLoc;
      setWaypoints(newWaypoints);
      setPlanning(true);
      setError(null);

      try {
        const prevLoc = index > 0 ? waypoints[index - 1] : o;
        const nextLoc = index < waypoints.length - 1 ? waypoints[index + 1] : d;

        const seg1 = await planRoute(prevLoc, snappedLoc, [], policy, roadType);
        const seg2 = await planRoute(snappedLoc, nextLoc, [], policy, roadType);

        const prevIdx = findClosestPathIndex(currentPath, prevLoc);
        const nextIdx = findClosestPathIndex(currentPath, nextLoc);

        const before = currentPath.slice(0, prevIdx + 1);
        const middle = [...seg1.path, ...seg2.path.slice(1)];
        const after = currentPath.slice(nextIdx);

        const fullPath: [number, number][] = [];
        for (const section of [before, middle, after]) {
          for (const pt of section) {
            const last = fullPath[fullPath.length - 1];
            if (!last || last[0] !== pt[0] || last[1] !== pt[1]) {
              fullPath.push(pt);
            }
          }
        }

        const totalDist = calcPathDistance(fullPath);
        const updatedRoute = { ...trip!.route, path: fullPath, distance: totalDist };
        if (currentId) {
          await updateTrip(currentId, {
            waypoints: newWaypoints.map((loc) => ({ name: '', loc })),
            route: updatedRoute,
            distance: totalDist,
          });
        }

        const computed = computeWaypoints(fullPath);
        setWaypoints(computed);
      } catch (e) {
        setError(e instanceof Error ? e.message : '路线规划失败');
      } finally {
        setPlanning(false);
      }
    },
    [origin, dest, trip, waypoints, policy, roadType, currentId, updateTrip]
  );

  const rePlanRoute = useCallback(
    async (o: [number, number], d: [number, number], wps: [number, number][]) => {
      setPlanning(true);
      setError(null);
      try {
        const route = await planRoute(o, d, wps, policy, roadType);
        if (currentId) {
          await updateTrip(currentId, {
            route,
            distance: route.distance,
            duration: route.time,
          });
        }
        const computed = computeWaypoints(route.path);
        setWaypoints(computed);
      } catch (e) {
        setError(e instanceof Error ? e.message : '路线规划失败');
      } finally {
        setPlanning(false);
      }
    },
    [policy, roadType, currentId, updateTrip]
  );

  const handleOriginDrag = useCallback(
    (newLoc: [number, number]) => {
      const d = dest || trip?.dest?.loc;
      if (!d) {
        setOrigin(newLoc);
        return;
      }
      setOrigin(newLoc);
      rePlanRoute(newLoc, d, waypoints);
    },
    [dest, trip, waypoints, rePlanRoute]
  );

  const handleDestDrag = useCallback(
    (newLoc: [number, number]) => {
      const o = origin || trip?.origin?.loc;
      if (!o) {
        setDest(newLoc);
        return;
      }
      setDest(newLoc);
      rePlanRoute(o, newLoc, waypoints);
    },
    [origin, trip, waypoints, rePlanRoute]
  );

  const handlePresetSelect = useCallback(
    async (preset: PresetRoute) => {
      const o = preset.origin.loc;
      const d = preset.dest.loc;
      const wps = preset.waypoints.map((w) => w.loc);
      setOrigin(o);
      setDest(d);
      setOriginName(preset.origin.name);
      setDestName(preset.dest.name);
      setWaypoints(wps);
      setPlanning(true);
      setError(null);
      try {
        const route = await planRouteSegmented(o, d, wps, 3, 'national');
        const newTrip: Trip = {
          id: generateId(),
          name: `${preset.name} ${preset.description}`,
          mode: 'planned',
          createdAt: Date.now(),
          origin: { name: preset.origin.name, loc: o },
          dest: { name: preset.dest.name, loc: d },
          waypoints: wps.map((loc) => ({ name: '', loc })),
          policy,
          route,
          distance: route.distance,
          duration: route.time,
        };
        const computed = computeWaypoints(route.path);
        setWaypoints(computed);
        await addTrip(newTrip);
      } catch (e) {
        setError(e instanceof Error ? e.message : '路线规划失败');
      } finally {
        setPlanning(false);
      }
    },
    [policy, roadType, addTrip]
  );

  const handlePolicyChange = useCallback((newPolicy: DrivingPolicy) => {
    setPolicy(newPolicy);
    if (trip?.origin?.loc && trip?.dest?.loc) {
      setPlanning(true);
      setError(null);
      planRoute(trip.origin.loc, trip.dest.loc, waypoints, newPolicy, roadType)
        .then((route) => {
          if (currentId) {
            updateTrip(currentId, { route, policy: newPolicy, distance: route.distance, duration: route.time });
          }
          const computed = computeWaypoints(route.path);
          setWaypoints(computed);
        })
        .catch((e) => setError(e instanceof Error ? e.message : '路线规划失败'))
        .finally(() => setPlanning(false));
    }
  }, [trip, waypoints, roadType, currentId, updateTrip]);

  const handleRoadTypeChange = useCallback((newRoadType: RoadType) => {
    setRoadType(newRoadType);
    if (trip?.origin?.loc && trip?.dest?.loc) {
      setPlanning(true);
      setError(null);
      planRoute(trip.origin.loc, trip.dest.loc, waypoints, policy, newRoadType)
        .then((route) => {
          if (currentId) {
            updateTrip(currentId, { route, distance: route.distance, duration: route.time });
          }
          const computed = computeWaypoints(route.path);
          setWaypoints(computed);
        })
        .catch((e) => setError(e instanceof Error ? e.message : '路线规划失败'))
        .finally(() => setPlanning(false));
    }
  }, [trip, waypoints, policy, currentId, updateTrip]);

  const handleSelectTrip = useCallback(
    (id: string) => {
      setCurrentId(id);
      animation.reset();
      setAnimationOverlays(null);
      const selected = trips.find((t) => t.id === id);
      if (selected?.waypoints) {
        setWaypoints(selected.waypoints.map((w) => w.loc));
      } else {
        setWaypoints([]);
      }
    },
    [setCurrentId, animation, trips]
  );

  const handleDeleteTrip = useCallback(
    async (id: string) => {
      await removeTrip(id);
      animation.reset();
      setAnimationOverlays(null);
    },
    [removeTrip, animation]
  );

  const handleNewTrip = useCallback(() => {
    setCurrentId(null);
    setOrigin(null);
    setDest(null);
    setOriginName('');
    setDestName('');
    animation.reset();
    setAnimationOverlays(null);
  }, [setCurrentId, animation]);

  const handleHighwayQuery = useCallback(async (ref: string) => {
    setHighwayLoading(true);
    setError(null);
    try {
      const route = await queryHighway(ref);
      setHighwayRoute(route);
    } catch (e) {
      setHighwayRoute(null);
      setError(e instanceof Error ? e.message : '国道查询失败');
    } finally {
      setHighwayLoading(false);
    }
  }, []);

  const handlePlay = useCallback(() => {
    animation.play(undefined, animation.followCamera);
  }, [animation]);

  const handleMapReady = useCallback((map: AMap.Map) => {
    setMapInstance(map);
  }, []);

  const handleExportVideo = useCallback(() => {
    if (trip?.route) {
      setShowVideoModal(true);
    }
  }, [trip]);

  return (
    <div className="app-layout">
      <Sidebar
        trips={trips}
        currentId={currentId}
        currentTrip={trip}
        onPlanRoute={handlePlanRoute}
        planning={planning}
        distance={trip?.distance ?? null}
        duration={trip?.duration ?? null}
        policy={policy}
        onPolicyChange={handlePolicyChange}
        roadType={roadType}
        onRoadTypeChange={handleRoadTypeChange}
        onOriginSelect={handleOriginSelect}
        onDestSelect={handleDestSelect}
        onPresetSelect={handlePresetSelect}
        onHighwayQuery={handleHighwayQuery}
        highwayLoading={highwayLoading}
        highwayRoute={highwayRoute}
        originName={originName || trip?.origin?.name || ''}
        destName={destName || trip?.dest?.name || ''}
        onExportVideo={handleExportVideo}
        animation={{
          ...animation,
          play: handlePlay,
        }}
        onSelectTrip={handleSelectTrip}
        onDeleteTrip={handleDeleteTrip}
        onNewTrip={handleNewTrip}
        plannerWaypoints={plannerWaypoints}
        onPlannerWaypointsChange={setPlannerWaypoints}
      />

      <main className="main-content">
        {error && <div className="error-banner">{error}</div>}
        <MapView
          trip={trip}
          onSetOrigin={handleSetOrigin}
          onSetDest={handleSetDest}
          originMarker={origin}
          destMarker={dest}
          onOriginDrag={handleOriginDrag}
          onDestDrag={handleDestDrag}
          animationOverlays={animationOverlays}
          waypoints={waypoints}
          onWaypointDrag={handleWaypointDrag}
          onMapReady={handleMapReady}
          highwayRoute={highwayRoute}
        />
      </main>

      {showVideoModal && trip?.route && (
        <VideoExportModal
          route={trip.route}
          tripName={trip.name}
          onClose={() => setShowVideoModal(false)}
        />
      )}
    </div>
  );
}
