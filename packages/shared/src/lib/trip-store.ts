import { createStore } from 'zustand/vanilla';
import type { Trip } from '../types/trip';
import type { StorageAdapter } from './storage-adapter';

interface TripState {
  trips: Trip[];
  currentId: string | null;
  loading: boolean;
  load: () => Promise<void>;
  addTrip: (trip: Trip) => Promise<void>;
  updateTrip: (id: string, patch: Partial<Trip>) => Promise<void>;
  removeTrip: (id: string) => Promise<void>;
  setCurrentId: (id: string | null) => void;
  currentTrip: () => Trip | undefined;
}

export function createTripStore(adapter: StorageAdapter) {
  const store = createStore<TripState>((set, get) => ({
    trips: [],
    currentId: null,
    loading: false,

    load: async () => {
      set({ loading: true });
      const trips = await adapter.getAllTrips();
      set({ trips, loading: false });
    },

    addTrip: async (trip) => {
      await adapter.saveTrip(trip);
      set((s) => ({ trips: [trip, ...s.trips], currentId: trip.id }));
    },

    updateTrip: async (id, patch) => {
      const { trips } = get();
      const idx = trips.findIndex((t) => t.id === id);
      if (idx === -1) return;
      const updated = { ...trips[idx], ...patch };
      await adapter.saveTrip(updated);
      const newTrips = [...trips];
      newTrips[idx] = updated;
      set({ trips: newTrips });
    },

    removeTrip: async (id) => {
      await adapter.deleteTrip(id);
      set((s) => ({
        trips: s.trips.filter((t) => t.id !== id),
        currentId: s.currentId === id ? null : s.currentId,
      }));
    },

    setCurrentId: (id) => set({ currentId: id }),

    currentTrip: () => {
      const { trips, currentId } = get();
      return trips.find((t) => t.id === currentId);
    },
  }));

  return store;
}

export type TripStore = ReturnType<typeof createTripStore>;
