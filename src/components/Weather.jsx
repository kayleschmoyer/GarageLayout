import React, { useEffect, useRef, useState } from "react";

const Weather = ({ address }) => {
    const [weatherData, setWeatherData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const debounceTimerRef = useRef(null);
    const abortRef = useRef(null);

    // Simple in-memory caches (per session)
    const geoCacheRef = useRef(new Map());
    const weatherCacheRef = useRef(new Map());

    const normalizeKey = (value) => value.trim().toLowerCase();

    const getWeatherIcon = (code) => {
        if (code === 0) return "☀️";
        if (code <= 3) return "⛅";
        if (code <= 48) return "🌫️";
        if (code <= 67) return "🌧️";
        if (code <= 77) return "🌨️";
        if (code <= 82) return "🌦️";
        if (code <= 86) return "🌨️";
        return "⛈️";
    };

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const fetchWithRetry = async (url, opts, { retries = 2 } = {}) => {
        let lastErr = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const res = await fetch(url, opts);

                // Retry only on transient throttling/outage scenarios
                if (res.status === 429 || res.status === 503) {
                    if (attempt < retries) {
                        await sleep(250 * Math.pow(2, attempt)); // 250ms, 500ms, ...
                        continue;
                    }
                }

                return res;
            } catch (e) {
                lastErr = e;
                if (attempt < retries) {
                    await sleep(250 * Math.pow(2, attempt));
                    continue;
                }
            }
        }

        throw lastErr ?? new Error("Network request failed");
    };

    const geocodeOpenMeteo = async (query, signal) => {
        const url =
            `https://geocoding-api.open-meteo.com/v1/search` +
            `?name=${encodeURIComponent(query)}` +
            `&count=1&language=en&format=json`;

        const res = await fetchWithRetry(url, { signal }, { retries: 1 });
        if (!res.ok) return null;

        const data = await res.json();
        const top = data?.results?.[0];
        if (!top) return null;

        const locationName =
            [top.name, top.admin1, top.country].filter(Boolean).join(", ") || query;

        return {
            latitude: top.latitude,
            longitude: top.longitude,
            locationName
        };
    };

    const geocodeNominatim = async (query, signal) => {
        // NOTE:
        // - In browser JS you cannot reliably set User-Agent; Nominatim expects identification.
        // - Include "email=" per Nominatim docs for larger volumes; for light use, still helpful. :contentReference[oaicite:2]{index=2}
        // - Consider proxying + caching server-side for production use. :contentReference[oaicite:3]{index=3}
        const url =
            `https://nominatim.openstreetmap.org/search` +
            `?q=${encodeURIComponent(query)}` +
            `&format=jsonv2&limit=1&addressdetails=0` +
            `&email=${encodeURIComponent("you@example.com")}`;

        const res = await fetchWithRetry(
            url,
            {
                signal,
                headers: {
                    // These are allowed browser headers; "User-Agent" is not reliably settable in fetch().
                    "Accept": "application/json"
                }
            },
            { retries: 2 }
        );

        if (!res.ok) return null;

        const data = await res.json();
        const top = data?.[0];
        if (!top) return null;

        return {
            latitude: Number(top.lat),
            longitude: Number(top.lon),
            locationName: (top.display_name || query).split(",")[0]
        };
    };

    useEffect(() => {
        const raw = address ?? "";
        const trimmed = raw.trim();

        if (!trimmed) {
            setWeatherData(null);
            setError(null);
            setLoading(false);
            return;
        }

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

        debounceTimerRef.current = setTimeout(async () => {
            if (abortRef.current) abortRef.current.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            setLoading(true);
            setError(null);

            const key = normalizeKey(trimmed);

            try {
                // Weather cache
                const cachedWeather = weatherCacheRef.current.get(key);
                if (cachedWeather) {
                    setWeatherData(cachedWeather);
                    return;
                }

                // Geocode cache
                let geo = geoCacheRef.current.get(key);

                if (!geo) {
                    // Try Open-Meteo first (best for city/postal searches) :contentReference[oaicite:4]{index=4}
                    geo = await geocodeOpenMeteo(trimmed, controller.signal);

                    // Fallback to Nominatim for street-address geocoding
                    if (!geo) {
                        geo = await geocodeNominatim(trimmed, controller.signal);
                    }

                    if (!geo) {
                        throw new Error(
                            "Location not found. Try adding City + State or ZIP (e.g., “123 Main St, Allentown, PA 18104”)."
                        );
                    }

                    geoCacheRef.current.set(key, geo);
                }

                // Weather
                const weatherUrl =
                    `https://api.open-meteo.com/v1/forecast` +
                    `?latitude=${geo.latitude}&longitude=${geo.longitude}` +
                    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
                    `&temperature_unit=fahrenheit&wind_speed_unit=mph`;

                const weatherRes = await fetchWithRetry(
                    weatherUrl,
                    { signal: controller.signal },
                    { retries: 1 }
                );

                if (!weatherRes.ok) {
                    throw new Error(`Weather fetch failed (${weatherRes.status})`);
                }

                const weatherInfo = await weatherRes.json();
                const current = weatherInfo?.current;

                if (!current) {
                    throw new Error("Weather data unavailable");
                }

                const payload = {
                    temperature: Math.round(current.temperature_2m),
                    humidity: current.relative_humidity_2m,
                    windSpeed: Math.round(current.wind_speed_10m),
                    weatherCode: current.weather_code,
                    location: geo.locationName
                };

                weatherCacheRef.current.set(key, payload);
                setWeatherData(payload);
            } catch (err) {
                if (err?.name !== "AbortError") {
                    console.error("Weather Error:", err);
                    setError(err?.message || "Weather failed");
                    setWeatherData(null);
                }
            } finally {
                setLoading(false);
            }
        }, 450);

        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            if (abortRef.current) abortRef.current.abort();
        };
    }, [address]);

    if (loading) {
        return (
            <div className="status-badge" style={{ opacity: 0.65 }} title="Loading weather">
                <span>⏳</span>
                <span>Loading...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="status-badge" style={{ opacity: 0.65 }} title={error}>
                <span>⚠️</span>
                <span style={{ fontSize: 12 }}>Weather unavailable</span>
            </div>
        );
    }

    if (!weatherData) return null;

    return (
        <div className="status-badge" title={`Weather at ${weatherData.location}`}>
            <span>{getWeatherIcon(weatherData.weatherCode)}</span>
            <span>{weatherData.temperature}°F</span>
            <span style={{ opacity: 0.55, fontSize: 11 }}>{weatherData.location}</span>
        </div>
    );
};

export default Weather;