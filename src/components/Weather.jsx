import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";

const DEBOUNCE_DELAY_MS = 450;
const RETRY_BASE_DELAY_MS = 250;
const MAX_CACHE_SIZE = 100;
const CACHE_TTL_MS = 15 * 60 * 1000;

const DEFAULT_STATE = Object.freeze({
    data: null,
    loading: false,
    error: null
});

const validateWeatherData = (data) => {
    if (!data || typeof data !== 'object') return null;
    const current = data.current;
    if (!current || typeof current !== 'object') return null;
    if (typeof current.temperature_2m !== 'number') return null;
    return current;
};

const sanitizeNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const normalizeKey = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
};

const getWeatherIcon = (code) => {
    const numCode = sanitizeNumber(code, -1);
    if (numCode === 0) return "☀️";
    if (numCode <= 3) return "⛅";
    if (numCode <= 48) return "🌫️";
    if (numCode <= 67) return "🌧️";
    if (numCode <= 77) return "🌨️";
    if (numCode <= 82) return "🌦️";
    if (numCode <= 86) return "🌨️";
    return "⛈️";
};

const sleep = (ms) => new Promise((resolve) => {
    const id = setTimeout(resolve, Math.max(0, ms));
    return () => clearTimeout(id);
});

const pruneCache = (cache, maxSize) => {
    if (cache.size <= maxSize) return;
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
    const toRemove = entries.slice(0, entries.length - maxSize);
    toRemove.forEach(([key]) => cache.delete(key));
};

const isCacheValid = (entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (!entry.timestamp) return false;
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
};

const fetchWithRetry = async (url, opts = {}, config = {}) => {
    const { retries = 2, timeoutMs = 10000 } = config;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const timeoutController = new AbortController();
        const combinedSignal = opts.signal;

        const timeoutId = setTimeout(() => {
            timeoutController.abort();
        }, timeoutMs);

        try {
            if (combinedSignal?.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }

            const fetchPromise = fetch(url, {
                ...opts,
                signal: timeoutController.signal
            });

            const abortPromise = combinedSignal ? new Promise((_, reject) => {
                combinedSignal.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            }) : null;

            const res = await (abortPromise
                ? Promise.race([fetchPromise, abortPromise])
                : fetchPromise);

            clearTimeout(timeoutId);

            if (res.status === 429 || res.status === 503) {
                if (attempt < retries) {
                    await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
                    continue;
                }
            }

            return res;
        } catch (err) {
            clearTimeout(timeoutId);
            lastError = err;

            if (err?.name === 'AbortError') {
                throw err;
            }

            if (attempt < retries) {
                await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
                continue;
            }
        }
    }

    throw lastError ?? new Error("Network request failed");
};

const geocodeOpenMeteo = async (query, signal) => {
    if (!query || typeof query !== 'string') return null;

    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;

    try {
        const res = await fetchWithRetry(url, { signal }, { retries: 1, timeoutMs: 8000 });

        if (!res.ok) return null;

        const data = await res.json();

        if (!data || typeof data !== 'object') return null;

        const results = Array.isArray(data.results) ? data.results : [];
        const top = results[0];

        if (!top || typeof top !== 'object') return null;
        if (typeof top.latitude !== 'number' || typeof top.longitude !== 'number') return null;

        const nameParts = [top.name, top.admin1, top.country].filter(
            part => typeof part === 'string' && part.trim()
        );
        const locationName = nameParts.length > 0 ? nameParts.join(", ") : query;

        return {
            latitude: top.latitude,
            longitude: top.longitude,
            locationName
        };
    } catch (err) {
        if (err?.name === 'AbortError') throw err;
        return null;
    }
};

const geocodeNominatim = async (query, signal) => {
    if (!query || typeof query !== 'string') return null;

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&addressdetails=0`;

    try {
        const res = await fetchWithRetry(
            url,
            {
                signal,
                headers: {
                    "Accept": "application/json"
                }
            },
            { retries: 2, timeoutMs: 10000 }
        );

        if (!res.ok) return null;

        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) return null;

        const top = data[0];

        if (!top || typeof top !== 'object') return null;

        const lat = Number(top.lat);
        const lon = Number(top.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        const displayName = typeof top.display_name === 'string' ? top.display_name : query;
        const locationName = displayName.split(",")[0] || query;

        return {
            latitude: lat,
            longitude: lon,
            locationName
        };
    } catch (err) {
        if (err?.name === 'AbortError') throw err;
        return null;
    }
};

const Weather = React.memo(({ address }) => {
    const [state, setState] = useState(DEFAULT_STATE);

    const debounceTimerRef = useRef(null);
    const abortControllerRef = useRef(null);
    const geoCacheRef = useRef(new Map());
    const weatherCacheRef = useRef(new Map());
    const mountedRef = useRef(true);

    const safeSetState = useCallback((updater) => {
        if (mountedRef.current) {
            setState(prev => typeof updater === 'function' ? updater(prev) : updater);
        }
    }, []);

    const clearPendingRequests = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
            clearPendingRequests();
        };
    }, [clearPendingRequests]);

    useEffect(() => {
        const rawAddress = typeof address === 'string' ? address : '';
        const trimmedAddress = rawAddress.trim();

        if (!trimmedAddress) {
            safeSetState(DEFAULT_STATE);
            clearPendingRequests();
            return;
        }

        clearPendingRequests();

        debounceTimerRef.current = setTimeout(async () => {
            const controller = new AbortController();
            abortControllerRef.current = controller;

            safeSetState({
                data: null,
                loading: true,
                error: null
            });

            const cacheKey = normalizeKey(trimmedAddress);

            try {
                const cachedWeather = weatherCacheRef.current.get(cacheKey);
                if (cachedWeather && isCacheValid(cachedWeather)) {
                    safeSetState({
                        data: cachedWeather.data,
                        loading: false,
                        error: null
                    });
                    return;
                }

                let geo = geoCacheRef.current.get(cacheKey);

                if (!geo || !isCacheValid(geo)) {
                    geo = await geocodeOpenMeteo(trimmedAddress, controller.signal);

                    if (!geo) {
                        geo = await geocodeNominatim(trimmedAddress, controller.signal);
                    }

                    if (!geo) {
                        throw new Error("Location not found. Try adding City + State or ZIP.");
                    }

                    geoCacheRef.current.set(cacheKey, {
                        ...geo,
                        timestamp: Date.now()
                    });

                    pruneCache(geoCacheRef.current, MAX_CACHE_SIZE);
                }

                const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`;

                const weatherRes = await fetchWithRetry(
                    weatherUrl,
                    { signal: controller.signal },
                    { retries: 1, timeoutMs: 8000 }
                );

                if (!weatherRes.ok) {
                    throw new Error(`Weather fetch failed (${weatherRes.status})`);
                }

                const weatherInfo = await weatherRes.json();
                const currentWeather = validateWeatherData(weatherInfo);

                if (!currentWeather) {
                    throw new Error("Weather data unavailable");
                }

                const payload = {
                    temperature: Math.round(sanitizeNumber(currentWeather.temperature_2m, 0)),
                    humidity: sanitizeNumber(currentWeather.relative_humidity_2m, 0),
                    windSpeed: Math.round(sanitizeNumber(currentWeather.wind_speed_10m, 0)),
                    weatherCode: sanitizeNumber(currentWeather.weather_code, 0),
                    location: geo.locationName || trimmedAddress
                };

                weatherCacheRef.current.set(cacheKey, {
                    data: payload,
                    timestamp: Date.now()
                });

                pruneCache(weatherCacheRef.current, MAX_CACHE_SIZE);

                safeSetState({
                    data: payload,
                    loading: false,
                    error: null
                });
            } catch (err) {
                if (err?.name === 'AbortError') {
                    return;
                }

                safeSetState({
                    data: null,
                    loading: false,
                    error: typeof err?.message === 'string' ? err.message : "Weather failed"
                });
            }
        }, DEBOUNCE_DELAY_MS);

        return clearPendingRequests;
    }, [address, safeSetState, clearPendingRequests]);

    const weatherIcon = useMemo(() => {
        if (!state.data) return null;
        return getWeatherIcon(state.data.weatherCode);
    }, [state.data]);

    if (state.loading) {
        return (
            <div className="status-badge" style={{ opacity: 0.65 }} title="Loading weather">
                <span>⏳</span>
                <span>Loading...</span>
            </div>
        );
    }

    if (state.error) {
        return (
            <div className="status-badge" style={{ opacity: 0.65 }} title={state.error}>
                <span>⚠️</span>
                <span style={{ fontSize: 12 }}>Weather unavailable</span>
            </div>
        );
    }

    if (!state.data) {
        // Show placeholder when no address is provided
        const rawAddress = typeof address === 'string' ? address.trim() : '';
        if (!rawAddress) {
            return (
                <div className="status-badge" style={{ opacity: 0.5 }} title="Add an address to show weather">
                    <span>🌡️</span>
                    <span style={{ fontSize: 12 }}>No location set</span>
                </div>
            );
        }
        return null;
    }

    return (
        <div className="status-badge" title={`Weather at ${state.data.location || 'Unknown'}`}>
            <span>{weatherIcon}</span>
            <span>{state.data.temperature}°F</span>
            <span style={{ opacity: 0.55, fontSize: 11 }}>{state.data.location || ''}</span>
        </div>
    );
});

Weather.displayName = 'Weather';

export default Weather;