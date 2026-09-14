import { get, set, del, keys } from 'idb-keyval';
import type { Trip, StorageAdapter } from '@road-trip/shared';

const TRIP_PREFIX = 'trip:';

export const idbStorageAdapter: StorageAdapter = {
  async getTrip(id: string): Promise<Trip | undefined> {
    return await get(TRIP_PREFIX + id);
  },

  async getAllTrips(): Promise<Trip[]> {
    const allKeys = await keys();
    const tripKeys = allKeys.filter((k) => String(k).startsWith(TRIP_PREFIX));
    const trips: Trip[] = [];
    for (const key of tripKeys) {
      const trip = await get(key);
      if (trip) trips.push(trip);
    }
    return trips.sort((a, b) => b.createdAt - a.createdAt);
  },

  async saveTrip(trip: Trip): Promise<void> {
    await set(TRIP_PREFIX + trip.id, trip);
  },

  async deleteTrip(id: string): Promise<void> {
    await del(TRIP_PREFIX + id);
  },
};
