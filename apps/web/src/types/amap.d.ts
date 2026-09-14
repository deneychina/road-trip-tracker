declare namespace AMap {
  class Map {
    constructor(el: HTMLElement, opts?: Record<string, unknown>);
    setFitView(overlays?: unknown[], immediately?: boolean, avoid?: number[]): void;
    add(overlays: unknown | unknown[]): void;
    remove(overlays: unknown | unknown[]): void;
    clearMap(): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    off(event: string, handler: (...args: unknown[]) => void): void;
    setCenter(center: [number, number]): void;
    setZoom(zoom: number): void;
    getZoom(): number;
    setRotation(rotation: number): void;
    getRotation(): number;
    setPitch(pitch: number): void;
    getPitch(): number;
    getCenter(): LngLat;
    plugin(plugins: string | string[], callback: () => void): void;
    destroy(): void;
  }

  class Marker {
    constructor(opts?: Record<string, unknown>);
    setMap(map: Map | null): void;
    setPosition(lnglat: [number, number]): void;
    moveAlong(path: [number, number][], speed: number, opts?: Record<string, unknown>): void;
    moveTo(lnglat: [number, number], opts?: Record<string, unknown>): void;
    stopMove(): void;
    pauseMove(): void;
    resumeMove(): void;
    on(event: string, handler: (e: Record<string, unknown>) => void): void;
    off(event: string, handler: (e: Record<string, unknown>) => void): void;
    setAngle(angle: number): void;
    setIcon(icon: string | Icon): void;
    setContent(content: string | HTMLElement): void;
    getPosition(): LngLat;
    getOffset(): Pixel;
  }

  class Polyline {
    constructor(opts?: Record<string, unknown>);
    setMap(map: Map | null): void;
    setPath(path: [number, number][]): void;
    getPath(): LngLat[];
    setOptions(opts: Record<string, unknown>): void;
    show(): void;
    hide(): void;
  }

  class InfoWindow {
    constructor(opts?: Record<string, unknown>);
    open(map: Map, position?: [number, number]): void;
    close(): void;
    setContent(content: string | HTMLElement): void;
  }

  class Icon {
    constructor(opts?: Record<string, unknown>);
  }

  class LngLat {
    constructor(lng: number, lat: number);
    getLng(): number;
    getLat(): number;
    distance(lnglat: LngLat): number;
  }

  class Pixel {
    constructor(x: number, y: number);
    getX(): number;
    getY(): number;
  }

  class Driving {
    constructor(opts?: Record<string, unknown>);
    search(
      origin: [number, number],
      destination: [number, number],
      waypoints: [number, number][],
      callback: (status: string, result: DrivingResult) => void
    ): void;
    clear(): void;
  }

  class PlaceSearch {
    constructor(opts?: Record<string, unknown>);
    search(keyword: string, callback: (status: string, result: Record<string, unknown>) => void): void;
    autoComplete(keyword: string, callback: (status: string, result: Record<string, unknown>) => void): void;
  }

  class AutoComplete {
    constructor(opts?: Record<string, unknown>);
    search(keyword: string, callback: (status: string, result: Record<string, unknown>) => void): void;
  }

  class Geocoder {
    constructor(opts?: Record<string, unknown>);
    getAddress(
      location: [number, number] | [number, number][],
      callback: (status: string, result: Record<string, unknown>) => void
    ): void;
  }

  class MouseTool {
    constructor(map: Map, opts?: Record<string, unknown>);
    on(event: string, handler: (e: Record<string, unknown>) => void): void;
    close(): void;
  }

  enum DrivingPolicy {
    LEAST_DISTANCE = 0,
    LEAST_TIME = 1,
    LEAST_FEE = 2,
    AVOID_HIGHWAY = 3,
    REAL_TRAFFIC = 4,
  }
}

interface DrivingResult {
  info: string;
  routes: DrivingRoute[];
}

interface DrivingRoute {
  distance: number;
  time: number;
  steps: DrivingStep[];
}

interface DrivingStep {
  instruction: string;
  road: string;
  distance: number;
  time: number;
  path: AMap.LngLat[];
  action: string;
  orientation: string;
}

interface Window {
  _AMapSecurityConfig: {
    securityJsCode: string;
  };
}
