export function computeWaypoints(
  path: [number, number][],
  maxCount: number = 6,
  intervalMeters: number = 50000
): [number, number][] {
  if (path.length < 2) return [];

  const totalDist = calcPathLength(path);
  if (totalDist < intervalMeters) return [];

  const count = Math.min(maxCount, Math.floor(totalDist / intervalMeters));
  if (count === 0) return [];

  const segmentLen = totalDist / (count + 1);
  const waypoints: [number, number][] = [];

  for (let i = 1; i <= count; i++) {
    const targetDist = segmentLen * i;
    const point = getPointAtDistance(path, targetDist);
    if (point) waypoints.push(point);
  }

  return waypoints;
}

export function mergeDraggedWaypoint(
  path: [number, number][],
  draggedLoc: [number, number],
  maxCount: number = 6,
  intervalMeters: number = 50000
): [number, number][] {
  const computed = computeWaypoints(path, maxCount, intervalMeters);
  if (computed.length === 0) return computed;

  const snapped = snapToPath(draggedLoc, path, 5000);

  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < computed.length; i++) {
    const dist = haversine(computed[i], snapped);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIdx = i;
    }
  }

  const result = [...computed];
  result[nearestIdx] = snapped;
  return result;
}

export function snapToPath(
  point: [number, number],
  path: [number, number][],
  maxDistanceMeters: number = 500
): [number, number] {
  if (path.length < 2) return point;

  let minDist = Infinity;
  let nearestPoint = point;

  for (let i = 1; i < path.length; i++) {
    const snapped = snapToSegment(point, path[i - 1], path[i]);
    const dist = haversine(point, snapped);
    if (dist < minDist) {
      minDist = dist;
      nearestPoint = snapped;
    }
  }

  return minDist <= maxDistanceMeters ? nearestPoint : point;
}

function snapToSegment(
  point: [number, number],
  segStart: [number, number],
  segEnd: [number, number]
): [number, number] {
  const dx = segEnd[0] - segStart[0];
  const dy = segEnd[1] - segStart[1];
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return segStart;

  let t = ((point[0] - segStart[0]) * dx + (point[1] - segStart[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return [segStart[0] + t * dx, segStart[1] + t * dy];
}

function calcPathLength(path: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversine(path[i - 1], path[i]);
  }
  return total;
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

function getPointAtDistance(
  path: [number, number][],
  targetDist: number
): [number, number] | null {
  let accum = 0;
  for (let i = 1; i < path.length; i++) {
    const segLen = haversine(path[i - 1], path[i]);
    if (accum + segLen >= targetDist) {
      const ratio = (targetDist - accum) / segLen;
      return [
        path[i - 1][0] + (path[i][0] - path[i - 1][0]) * ratio,
        path[i - 1][1] + (path[i][1] - path[i - 1][1]) * ratio,
      ];
    }
    accum += segLen;
  }
  return null;
}

export function findClosestPathIndex(
  path: [number, number][],
  point: [number, number]
): number {
  let minDist = Infinity;
  let idx = 0;
  for (let i = 0; i < path.length; i++) {
    const dist = haversine(path[i], point);
    if (dist < minDist) {
      minDist = dist;
      idx = i;
    }
  }
  return idx;
}

export function calcPathDistance(path: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversine(path[i - 1], path[i]);
  }
  return total;
}
