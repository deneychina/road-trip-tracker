export interface RouteStep {
  instruction: string;
  road: string;
  distance: number;
  path: [number, number][];
}

export interface RoutePlan {
  distance: number;
  time: number;
  path: [number, number][];
  steps: RouteStep[];
}

export interface TripLocation {
  name: string;
  loc: [number, number];
}

export type TripMode = 'planned' | 'recorded';

export interface Trip {
  id: string;
  name: string;
  mode: TripMode;
  createdAt: number;
  origin?: TripLocation;
  dest?: TripLocation;
  waypoints?: TripLocation[];
  route?: RoutePlan;
  distance: number;
  duration: number;
  policy?: number;
}
