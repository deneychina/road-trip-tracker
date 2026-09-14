import AMapLoader from '@amap/amap-jsapi-loader';

let amapPromise: Promise<typeof AMap> | null = null;

export function loadAMap(): Promise<typeof AMap> {
  if (amapPromise) return amapPromise;

  window._AMapSecurityConfig = {
    securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE,
  };

  amapPromise = AMapLoader.load({
    key: import.meta.env.VITE_AMAP_KEY as string,
    version: '2.0',
    plugins: [
      'AMap.Driving',
      'AMap.Geocoder',
      'AMap.PlaceSearch',
      'AMap.AutoComplete',
      'AMap.Marker',
    ],
  }) as Promise<typeof AMap>;

  return amapPromise;
}
