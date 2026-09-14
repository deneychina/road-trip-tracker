export type { RouteStep, RoutePlan, TripLocation, TripMode, Trip } from './types/trip';

export {
  computeWaypoints,
  mergeDraggedWaypoint,
  snapToPath,
  findClosestPathIndex,
  calcPathDistance,
} from './lib/waypoints';

export {
  classifyRoad,
  ROAD_COLORS,
  ROAD_WEIGHTS,
  groupStepsByRoadType,
} from './lib/mileage';
export type { RoadType as MileageRoadType } from './lib/mileage';

export { PRESET_ROUTES } from './lib/preset-routes';
export type { PresetRoute } from './lib/preset-routes';

export { queryHighway } from './lib/highway-query';
export type { HighwayRoute } from './lib/highway-query';

export type { StorageAdapter } from './lib/storage-adapter';

export { createTripStore } from './lib/trip-store';
export type { TripStore } from './lib/trip-store';
