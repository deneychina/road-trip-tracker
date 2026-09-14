import { useStore } from 'zustand';
import { createTripStore, type TripStore } from '@road-trip/shared';
import { idbStorageAdapter } from '../lib/storage';

type TripState = ReturnType<TripStore['getState']>;

const store = createTripStore(idbStorageAdapter);

export function useTripStore(): TripState;
export function useTripStore<T>(selector: (state: TripState) => T): T;
export function useTripStore<T>(selector?: (state: TripState) => T): T | TripState {
  if (selector) {
    return useStore(store, selector);
  }
  return useStore(store);
}
