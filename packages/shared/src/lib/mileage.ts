import type { RouteStep } from '../types/trip';

export type RoadType = 'expressway' | 'national' | 'provincial' | 'other';

export function classifyRoad(road: string): RoadType {
  if (!road) return 'other';
  if (/高速/.test(road) || /^G\d/.test(road)) return 'expressway';
  if (/^G\d{3}/.test(road) || /国道/.test(road)) return 'national';
  if (/^S\d/.test(road) || /省道/.test(road)) return 'provincial';
  return 'other';
}

export const ROAD_COLORS: Record<RoadType, string> = {
  expressway: '#16a34a',
  national: '#2563eb',
  provincial: '#ea580c',
  other: '#6b7280',
};

export const ROAD_WEIGHTS: Record<RoadType, number> = {
  expressway: 4,
  national: 4,
  provincial: 4,
  other: 4,
};

export function groupStepsByRoadType(steps: RouteStep[]): { type: RoadType; path: [number, number][] }[] {
  const groups: { type: RoadType; path: [number, number][] }[] = [];

  for (const step of steps) {
    const type = classifyRoad(step.road);
    const last = groups[groups.length - 1];
    if (last && last.type === type) {
      const lastPoint = last.path[last.path.length - 1];
      const firstPoint = step.path[0];
      if (lastPoint && firstPoint && (lastPoint[0] !== firstPoint[0] || lastPoint[1] !== firstPoint[1])) {
        last.path.push(firstPoint);
      }
      last.path.push(...step.path.slice(1));
    } else {
      groups.push({ type, path: [...step.path] });
    }
  }

  return groups;
}
