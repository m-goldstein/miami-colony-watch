// NWS outlooks belong to the area, never to the Arduino's local rain probe.
const POINT = '25.7650,-80.1340';
const headers = { 'User-Agent': 'ColonyWatch-local-prototype/1.0', Accept: 'application/geo+json' };
export function createWeatherService(fetcher = fetch, now = Date.now) {
  let cached, pending;
  async function get(url) {
    const response = await fetcher(url, { headers, signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error('NWS outlook is temporarily unavailable.');
    return response.json();
  }
  return async function outlook() {
    if (cached && now() - Date.parse(cached.retrievedAt) < 600000) return cached;
    if (pending) return pending;
    pending = (async () => {
      const point = await get(`https://api.weather.gov/points/${POINT}`);
      const forecastUrl = point.properties?.forecast;
      if (typeof forecastUrl !== 'string' || !forecastUrl.startsWith('https://api.weather.gov/gridpoints/')) throw new Error('NWS forecast location is unavailable.');
      const [forecast, alertsResult] = await Promise.all([
        get(forecastUrl),
        get(`https://api.weather.gov/alerts/active?point=${POINT}`).then(data => ({ data })).catch(() => ({ data: null }))
      ]);
      const periods = (forecast.properties?.periods || []).filter(p => Date.parse(p.endTime) > now()).slice(0, 6).map(p => ({
        name: p.name, startTime: p.startTime, endTime: p.endTime, temperature: p.temperature, temperatureUnit: p.temperatureUnit,
        rainChance: p.probabilityOfPrecipitation?.value ?? null, wind: p.windSpeed, summary: p.shortForecast, detail: p.detailedForecast
      }));
      if (!periods.length || !Number.isFinite(Date.parse(forecast.properties?.updateTime))) throw new Error('NWS forecast periods are unavailable.');
      const alerts = (alertsResult.data?.features || []).map(({ properties: p }) => ({
        event: p.event, severity: p.severity, headline: p.headline, expires: p.expires
      }));
      cached = { source: 'National Weather Service', location: 'South Beach / South Point Park area',
        sourceUrl: 'https://www.weather.gov/mfl/', updatedAt: forecast.properties.updateTime,
        retrievedAt: new Date(now()).toISOString(), periods, alerts, alertsAvailable: !!alertsResult.data };
      return cached;
    })();
    try { return await pending; } finally { pending = null; }
  };
}
