import type { RoutePlan, RouteStep } from '@road-trip/shared';

export type DrivingPolicy = 0 | 1 | 2 | 3 | 4;
export type RoadType = 'highway' | 'national';

const DRIVING_API = 'https://restapi.amap.com/v5/direction/driving';

interface AMapRoute {
  distance: string;
  duration: string;
  steps: Array<{
    instruction: string;
    road: string;
    distance: string;
    polyline: string;
  }>;
}

interface AMapDrivingResponse {
  status: string;
  info: string;
  route?: {
    paths: AMapRoute[];
  };
}

function decodePolyline(str: string): [number, number][] {
  if (!str) return [];
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < str.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push([lng / 1e6, lat / 1e6]);
  }

  return points;
}

function buildQueryParams(
  origin: [number, number],
  destination: [number, number],
  waypoints: [number, number][],
  policy: DrivingPolicy
): URLSearchParams {
  const params = new URLSearchParams({
    key: import.meta.env.VITE_AMAP_KEY as string,
    origin: `${origin[0]},${origin[1]}`,
    destination: `${destination[0]},${destination[1]}`,
    strategy: String(policy),
    output: 'json',
  });

  if (waypoints.length > 0) {
    const wpStr = waypoints.map((w) => `${w[0]},${w[1]}`).join('|');
    params.set('waypoints', wpStr);
  }

  return params;
}

async function fetchDrivingRoute(
  origin: [number, number],
  destination: [number, number],
  waypoints: [number, number][],
  policy: DrivingPolicy
): Promise<RoutePlan> {
  const url = `${DRIVING_API}?${buildQueryParams(origin, destination, waypoints, policy).toString()}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`AMap API error: ${resp.status} ${resp.statusText}`);
  }

  const data: AMapDrivingResponse = await resp.json();

  if (data.status !== '1') {
    throw new Error(data.info || 'Route planning failed');
  }

  if (!data.route || !data.route.paths || data.route.paths.length === 0) {
    throw new Error('No route found');
  }

  const path = data.route.paths[0];
  const steps: RouteStep[] = path.steps.map((s) => ({
    instruction: s.instruction,
    road: s.road || '',
    distance: parseInt(s.distance, 10) || 0,
    path: decodePolyline(s.polyline),
  }));

  const fullPath: [number, number][] = [];
  for (const step of steps) {
    for (const point of step.path) {
      const last = fullPath[fullPath.length - 1];
      if (!last || last[0] !== point[0] || last[1] !== point[1]) {
        fullPath.push(point);
      }
    }
  }

  return {
    distance: parseInt(path.distance, 10) || 0,
    time: parseInt(path.duration, 10) || 0,
    path: fullPath,
    steps,
  };
}

export async function planRouteSegmented(
  origin: [number, number],
  destination: [number, number],
  waypoints: [number, number][],
  _policy: DrivingPolicy = 0,
  roadType: RoadType = 'highway'
): Promise<RoutePlan> {
  const effectivePolicy = roadType === 'highway' ? 0 : 3;

  if (waypoints.length === 0) {
    return fetchDrivingRoute(origin, destination, [], effectivePolicy);
  }

  const allPoints = [origin, ...waypoints, destination];
  const segments = allPoints.slice(0, -1).map((point, i) => ({
    origin: point as [number, number],
    dest: allPoints[i + 1] as [number, number],
  }));

  const results: RoutePlan[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    results[i] = await fetchDrivingRoute(seg.origin, seg.dest, [], effectivePolicy);
    if (i < segments.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  const combinedPath: [number, number][] = [];
  let totalDistance = 0;
  let totalTime = 0;
  const combinedSteps: RouteStep[] = [];

  for (const result of results) {
    for (const point of result.path) {
      const last = combinedPath[combinedPath.length - 1];
      if (!last || last[0] !== point[0] || last[1] !== point[1]) {
        combinedPath.push(point);
      }
    }
    totalDistance += result.distance;
    totalTime += result.time;
    combinedSteps.push(...result.steps);
  }

  return {
    distance: totalDistance,
    time: totalTime,
    path: combinedPath,
    steps: combinedSteps,
  };
}

export async function planRoute(
  origin: [number, number],
  destination: [number, number],
  waypoints: [number, number][] = [],
  _policy: DrivingPolicy = 0,
  roadType: RoadType = 'highway'
): Promise<RoutePlan> {
  const effectivePolicy = roadType === 'highway' ? 0 : 3;
  return fetchDrivingRoute(origin, destination, waypoints, effectivePolicy);
}
