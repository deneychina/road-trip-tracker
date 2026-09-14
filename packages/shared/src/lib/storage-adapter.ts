import type { Trip } from '../types/trip';

export interface StorageAdapter {
  getTrip(id: string): Promise<Trip | undefined>;
  getAllTrips(): Promise<Trip[]>;
  saveTrip(trip: Trip): Promise<void>;
  deleteTrip(id: string): Promise<void>;
}
