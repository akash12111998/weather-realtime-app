const form = document.getElementById("search-form");
const input = document.getElementById("location-input");
const resultsList = document.getElementById("results-list");
const weatherSection = document.getElementById("weather-section");
const selectedLocation = document.getElementById("selected-location");
const weatherGrid = document.getElementById("weather-grid");
const forecastGrid = document.getElementById("forecast-grid");
const sunUvGrid = document.getElementById("sun-uv-grid");
const aqiGrid = document.getElementById("aqi-grid");
const alertsPanel = document.getElementById("alerts-panel");
const hourlyChart = document.getElementById("hourly-chart");
const hourlyMeta = document.getElementById("hourly-meta");
const globeView = document.getElementById("globe-view");
const pinnedCoords = document.getElementById("pinned-coords");
const globeStyleSelect = document.getElementById("globe-style-select");
const resetGlobeViewBtn = document.getElementById("reset-globe-view-btn");
const currentLocationBtn = document.getElementById("current-location-btn");
const globeStyleStatus = document.getElementById("globe-style-status");
const statusMessage = document.getElementById("status-message");
const appVersionLabel = document.getElementById("app-version");
const updatedAt = document.getElementById("updated-at");
const tempUnitSelect = document.getElementById("temp-unit-select");
const windUnitSelect = document.getElementById("wind-unit-select");
const precipUnitSelect = document.getElementById("precip-unit-select");
const pressureUnitSelect = document.getElementById("pressure-unit-select");

let lastSelectedLocation = null;
let globe = null;
let latestPinRequestId = 0;
let latestStyleRequestId = 0;
let borderDataPromise = null;

const countryBordersGeoJsonUrl = "https://unpkg.com/globe.gl/example/datasets/ne_110m_admin_0_countries.geojson";
const domesticBordersGeoJsonUrl = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson";
const airQualityApiUrl = "https://air-quality-api.open-meteo.com/v1/air-quality";
const defaultOverlayState = { countries: [], domesticPaths: [], countryLabels: [], stateLabels: [] };
const APP_VERSION = "v1.5.0";

const weatherCodeMap = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail"
};

const globeStyles = {
  satellite: {
    globeImageUrl: "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
    bumpImageUrl: "",
    backgroundImageUrl: "",
    backgroundColor: "#081227",
    atmosphereColor: "#93c5fd",
    atmosphereAltitude: 0.2,
    overlayMode: "none"
  },
  satellite_labels: {
    globeImageUrl: "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
    bumpImageUrl: "",
    backgroundImageUrl: "",
    backgroundColor: "#081227",
    atmosphereColor: "#93c5fd",
    atmosphereAltitude: 0.2,
    overlayMode: "labels_only"
  },
  topographic: {
    globeImageUrl: "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
    bumpImageUrl: "https://unpkg.com/three-globe/example/img/earth-topology.png",
    backgroundImageUrl: "",
    backgroundColor: "#060b1f",
    atmosphereColor: "#7dd3fc",
    atmosphereAltitude: 0.24,
    overlayMode: "none"
  },
  night: {
    globeImageUrl: "https://unpkg.com/three-globe/example/img/earth-night.jpg",
    bumpImageUrl: "",
    backgroundImageUrl: "https://unpkg.com/three-globe/example/img/night-sky.png",
    backgroundColor: "#020617",
    atmosphereColor: "#67e8f9",
    atmosphereAltitude: 0.18,
    overlayMode: "none"
  },
  borders: {
    globeImageUrl: "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
    bumpImageUrl: "https://unpkg.com/three-globe/example/img/earth-topology.png",
    backgroundImageUrl: "",
    backgroundColor: "#050d24",
    atmosphereColor: "#a5f3fc",
    atmosphereAltitude: 0.22,
    overlayMode: "full_borders"
  },
  cartographic_light: {
    globeImageUrl: "https://unpkg.com/three-globe/example/img/earth-topology.png",
    bumpImageUrl: "",
    backgroundImageUrl: "",
    backgroundColor: "#dbeafe",
    atmosphereColor: "#93c5fd",
    atmosphereAltitude: 0.16,
    overlayMode: "full_borders_light"
  },
  cartographic_dark: {
    globeImageUrl: "https://unpkg.com/three-globe/example/img/earth-topology.png",
    bumpImageUrl: "",
    backgroundImageUrl: "",
    backgroundColor: "#020617",
    atmosphereColor: "#60a5fa",
    atmosphereAltitude: 0.16,
    overlayMode: "full_borders_dark"
  }
};

function setStatus(message) {
  statusMessage.textContent = message;
}

function setGlobeStyleStatus(message, isError = false) {
  if (!globeStyleStatus) {
    return;
  }

  if (!message) {
    globeStyleStatus.textContent = "";
    globeStyleStatus.classList.add("hidden");
    globeStyleStatus.style.color = "";
    return;
  }

  globeStyleStatus.textContent = message;
  globeStyleStatus.classList.remove("hidden");
  globeStyleStatus.style.color = isError ? "#fca5a5" : "";
}

function formatCoordinate(value) {
  return Number(value).toFixed(2);
}

function getLocationText(place) {
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

function getCoordinateSummary(lat, lng) {
  return `Lat ${formatCoordinate(lat)}, Lon ${formatCoordinate(lng)}`;
}

function clearGlobePin() {
  if (!globe) {
    return;
  }

  globe.pointsData([]);
  globe.ringsData([]);
  pinnedCoords.textContent = "Pinned location: none";
}

function coordsToLatLngPairs(lineCoords) {
  return lineCoords.map(([lng, lat]) => ({ lat, lng }));
}

function getFeatureName(properties, keys) {
  for (const key of keys) {
    const value = properties?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function getRingCentroid(ring) {
  if (!Array.isArray(ring) || ring.length === 0) {
    return null;
  }

  const total = ring.reduce(
    (acc, coord) => {
      const [lng, lat] = coord;
      return {
        lat: acc.lat + lat,
        lng: acc.lng + lng
      };
    },
    { lat: 0, lng: 0 }
  );

  return {
    lat: total.lat / ring.length,
    lng: total.lng / ring.length
  };
}

function getGeometryCentroid(geometry) {
  if (!geometry) {
    return null;
  }

  if (geometry.type === "Polygon") {
    return getRingCentroid(geometry.coordinates?.[0] || []);
  }

  if (geometry.type === "MultiPolygon") {
    return getRingCentroid(geometry.coordinates?.[0]?.[0] || []);
  }

  if (geometry.type === "LineString") {
    return getRingCentroid(geometry.coordinates || []);
  }

  if (geometry.type === "MultiLineString") {
    return getRingCentroid(geometry.coordinates?.[0] || []);
  }

  return null;
}

function getColorFromName(name) {
  const palette = [
    "rgba(14, 165, 233, 0.28)",
    "rgba(99, 102, 241, 0.25)",
    "rgba(16, 185, 129, 0.24)",
    "rgba(234, 179, 8, 0.22)",
    "rgba(249, 115, 22, 0.24)",
    "rgba(236, 72, 153, 0.22)",
    "rgba(168, 85, 247, 0.22)",
    "rgba(34, 197, 94, 0.22)"
  ];
  let hash = 0;
  const normalized = name || "default";
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

function extractDomesticPaths(geoJson) {
  const paths = [];

  geoJson.features.forEach((feature) => {
    const geometry = feature.geometry;
    if (!geometry) {
      return;
    }

    if (geometry.type === "LineString") {
      paths.push({ coords: coordsToLatLngPairs(geometry.coordinates) });
      return;
    }

    if (geometry.type === "MultiLineString") {
      geometry.coordinates.forEach((line) => {
        paths.push({ coords: coordsToLatLngPairs(line) });
      });
      return;
    }

    if (geometry.type === "Polygon") {
      (geometry.coordinates || []).forEach((ring) => {
        paths.push({ coords: coordsToLatLngPairs(ring) });
      });
      return;
    }

    if (geometry.type === "MultiPolygon") {
      (geometry.coordinates || []).forEach((polygon) => {
        (polygon || []).forEach((ring) => {
          paths.push({ coords: coordsToLatLngPairs(ring) });
        });
      });
    }
  });

  return paths;
}

async function ensureBorderDataLoaded() {
  if (borderDataPromise) {
    return borderDataPromise;
  }

  borderDataPromise = (async () => {
    try {
      const [countryResponse, domesticResponse] = await Promise.all([
        fetch(countryBordersGeoJsonUrl),
        fetch(domesticBordersGeoJsonUrl)
      ]);

      if (!countryResponse.ok || !domesticResponse.ok) {
        return defaultOverlayState;
      }

      const [countryGeoJson, domesticGeoJson] = await Promise.all([
        countryResponse.json(),
        domesticResponse.json()
      ]);

      const countries = (countryGeoJson.features || []).map((feature) => {
        const countryName = getFeatureName(feature.properties, ["NAME", "ADMIN", "SOVEREIGNT"]);
        return {
          ...feature,
          properties: {
            ...feature.properties,
            __countryColor: getColorFromName(countryName)
          }
        };
      });

      const countryLabels = countries
        .map((feature) => {
          const centroid = getGeometryCentroid(feature.geometry);
          const label = getFeatureName(feature.properties, ["NAME", "ADMIN", "SOVEREIGNT"]);
          if (!centroid || !label) {
            return null;
          }
          return {
            lat: centroid.lat,
            lng: centroid.lng,
            text: label,
            size: 0.75,
            color: "#fefce8"
          };
        })
        .filter(Boolean);

      const stateLabels = (domesticGeoJson.features || [])
        .map((feature) => {
          const centroid = getGeometryCentroid(feature.geometry);
          const stateName = getFeatureName(feature.properties, ["name", "name_en", "name_local", "postal"]);
          if (!centroid || !stateName) {
            return null;
          }
          return {
            lat: centroid.lat,
            lng: centroid.lng,
            text: stateName,
            size: 0.52,
            color: "#c7d2fe"
          };
        })
        .filter(Boolean);

      return {
        countries,
        domesticPaths: extractDomesticPaths(domesticGeoJson),
        countryLabels,
        stateLabels
      };
    } catch {
      return defaultOverlayState;
    }
  })();

  return borderDataPromise;
}

function clearBorderOverlays() {
  if (!globe) {
    return;
  }

  globe.polygonsData([]);
  globe.pathsData([]);
  globe.labelsData([]);
}

async function applyGlobeStyle(styleKey) {
  if (!globe) {
    return;
  }

  const styleRequestId = ++latestStyleRequestId;
  const style = globeStyles[styleKey] || globeStyles.topographic;
  globe.globeImageUrl(style.globeImageUrl);
  globe.bumpImageUrl(style.bumpImageUrl);
  globe.backgroundImageUrl(style.backgroundImageUrl);
  globe.backgroundColor(style.backgroundColor);
  globe.atmosphereColor(style.atmosphereColor);
  globe.atmosphereAltitude(style.atmosphereAltitude);

  clearBorderOverlays();

  if (style.overlayMode === "none") {
    setGlobeStyleStatus("");
    return;
  }

  setGlobeStyleStatus("Loading borders...");
  const overlayData = await ensureBorderDataLoaded();
  if (styleRequestId !== latestStyleRequestId) {
    return;
  }

  if (overlayData.countries.length === 0 && overlayData.domesticPaths.length === 0) {
    setGlobeStyleStatus("Borders unavailable right now.", true);
    return;
  }

  const allLabels = [...overlayData.countryLabels, ...overlayData.stateLabels];
  const labelSubset = [...overlayData.countryLabels, ...overlayData.stateLabels.slice(0, 130)];

  if (style.overlayMode === "labels_only") {
    globe
      .labelText("text")
      .labelLat("lat")
      .labelLng("lng")
      .labelSize("size")
      .labelColor("color")
      .labelAltitude(0.01)
      .labelDotRadius(0)
      .labelsData(labelSubset);

    setGlobeStyleStatus("Labels loaded.");
    return;
  }

  const isLight = style.overlayMode === "full_borders_light";
  const isDark = style.overlayMode === "full_borders_dark";
  const countryStrokeColor = isLight
    ? "rgba(37, 99, 235, 0.8)"
    : isDark
      ? "rgba(147, 197, 253, 0.9)"
      : "rgba(14, 165, 233, 0.95)";
  const domesticLineColor = isLight
    ? "rgba(30, 64, 175, 0.45)"
    : isDark
      ? "rgba(248, 250, 252, 0.58)"
      : "rgba(251, 191, 36, 0.88)";
  const labelColor = isLight ? "#1e3a8a" : "#f8fafc";
  const styledLabels = allLabels.map((label) => ({ ...label, color: labelColor }));

  globe
    .polygonCapColor((feature) => {
      if (isLight) {
        return "rgba(59, 130, 246, 0.14)";
      }
      if (isDark) {
        return "rgba(96, 165, 250, 0.12)";
      }
      return feature.properties?.__countryColor || "rgba(14, 165, 233, 0.25)";
    })
    .polygonSideColor(() => "rgba(0,0,0,0)")
    .polygonStrokeColor(() => countryStrokeColor)
    .polygonAltitude(0.004)
    .polygonsData(overlayData.countries)
    .pathColor(() => domesticLineColor)
    .pathStroke(0.4)
    .pathAltitude(0.006)
    .pathResolution(2)
    .pathPoints("coords")
    .pathsData(overlayData.domesticPaths)
    .labelText("text")
    .labelLat("lat")
    .labelLng("lng")
    .labelSize("size")
    .labelColor("color")
    .labelAltitude(0.01)
    .labelDotRadius(0)
    .labelsData(styledLabels);

  setGlobeStyleStatus("Borders loaded.");
}

function setGlobePin(lat, lng) {
  if (!globe) {
    return;
  }

  globe.pointsData([{
    lat,
    lng,
    size: 0.05,
    color: "#ff2d55"
  }]);

  globe.ringsData([
    {
      lat,
      lng,
      color: "rgba(255, 255, 255, 0.9)",
      maxRadius: 2.8,
      propagationSpeed: 2,
      repeatPeriod: 1200
    },
    {
      lat,
      lng,
      color: "rgba(255, 45, 85, 0.72)",
      maxRadius: 4.5,
      propagationSpeed: 1.6,
      repeatPeriod: 1650
    }
  ]);

  const controls = globe.controls();
  controls.autoRotate = false;

  pinnedCoords.textContent = `Pinned location: ${getCoordinateSummary(lat, lng)}`;
}

function setPinnedLabel(place) {
  pinnedCoords.textContent = `Pinned location: ${getLocationText(place)}`;
}

async function handlePinAtCoordinates(coords) {
  if (!coords || typeof coords.lat !== "number" || typeof coords.lng !== "number") {
    return;
  }

  const pinRequestId = ++latestPinRequestId;
  const pinnedPlace = {
    name: "Pinned Location",
    admin1: "",
    country: getCoordinateSummary(coords.lat, coords.lng),
    latitude: coords.lat,
    longitude: coords.lng
  };

  setGlobePin(coords.lat, coords.lng);
  lastSelectedLocation = pinnedPlace;
  fetchWeather(pinnedPlace);

  const resolvedPlace = await reverseGeocodePlace(pinnedPlace);
  if (pinRequestId !== latestPinRequestId) {
    return;
  }

  lastSelectedLocation = resolvedPlace;
  setPinnedLabel(resolvedPlace);
  selectedLocation.textContent = getLocationText(resolvedPlace);
}

async function reverseGeocodePlace(place) {
  try {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.searchParams.set("latitude", place.latitude);
    url.searchParams.set("longitude", place.longitude);
    url.searchParams.set("localityLanguage", "en");

    const response = await fetch(url.toString());
    if (!response.ok) {
      return place;
    }

    const data = await response.json();
    const name = data.city || data.locality || place.name;
    const admin1 = data.principalSubdivision || "";
    const country = data.countryName || place.country;

    return {
      ...place,
      name,
      admin1,
      country
    };
  } catch {
    return place;
  }
}

function initializeGlobe() {
  if (typeof Globe !== "function" || !globeView) {
    return;
  }

  globe = Globe()(globeView)
    .globeImageUrl(globeStyles.topographic.globeImageUrl)
    .bumpImageUrl(globeStyles.topographic.bumpImageUrl)
    .backgroundColor(globeStyles.topographic.backgroundColor)
    .showAtmosphere(true)
    .atmosphereColor(globeStyles.topographic.atmosphereColor)
    .atmosphereAltitude(globeStyles.topographic.atmosphereAltitude)
    .pointLat("lat")
    .pointLng("lng")
    .pointAltitude("size")
    .pointRadius(0.5)
    .pointColor("color")
    .pointsData([])
    .ringLat("lat")
    .ringLng("lng")
    .ringColor("color")
    .ringMaxRadius("maxRadius")
    .ringPropagationSpeed("propagationSpeed")
    .ringRepeatPeriod("repeatPeriod")
    .ringsData([])
    .onGlobeClick((coords) => {
      handlePinAtCoordinates(coords);
    })
    // Border overlays can capture pointer events, so support pinning on those layers too.
    .onPolygonClick((_polygon, _event, coords) => {
      handlePinAtCoordinates(coords);
    })
    .onPathClick((path, _event) => {
      const coords = path?.coords?.[0];
      handlePinAtCoordinates(coords);
    });

  function syncGlobeSize() {
    globe.width(globeView.clientWidth);
    globe.height(globeView.clientHeight);
  }

  syncGlobeSize();
  window.addEventListener("resize", syncGlobeSize);

  // Start from a centered global view.
  globe.pointOfView({ lat: 0, lng: 0, altitude: 2.1 });
  const renderer = globe.renderer();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const controls = globe.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;
  // Prevent camera from clipping into the globe at extreme zoom.
  controls.minDistance = 120;
  controls.maxDistance = 760;
  controls.zoomSpeed = 0.8;

  if (globeStyleSelect) {
    globeStyleSelect.value = "topographic";
    globeStyleSelect.addEventListener("change", () => {
      applyGlobeStyle(globeStyleSelect.value);
    });
  }

  if (resetGlobeViewBtn) {
    resetGlobeViewBtn.addEventListener("click", () => {
      globe.pointOfView({ lat: 0, lng: 0, altitude: 2.1 }, 900);
      const controlsAfterReset = globe.controls();
      controlsAfterReset.autoRotate = true;
      setStatus("Globe view reset. Auto-rotate resumed.");
    });
  }
}

function renderResults(results) {
  resultsList.innerHTML = "";

  if (!results || results.length === 0) {
    setStatus("No matching locations found. Try a broader name.");
    return;
  }

  setStatus("Choose one of the matching locations.");

  results.forEach((place) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.className = "result-btn";
    button.type = "button";

    const title = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
    const subtitle = `Lat ${place.latitude.toFixed(2)}, Lon ${place.longitude.toFixed(2)} | ${place.timezone}`;

    button.innerHTML = `<strong>${title}</strong><div class="result-sub">${subtitle}</div>`;
    button.addEventListener("click", () => {
      clearGlobePin();
      lastSelectedLocation = place;
      fetchWeather(place);
    });

    li.appendChild(button);
    resultsList.appendChild(li);
  });
}

function getSpeedUnit() {
  return windUnitSelect.value;
}

function getPrecipitationUnit() {
  return precipUnitSelect.value;
}

function getPressureUnit() {
  return pressureUnitSelect.value;
}

function toInHg(hPa) {
  return hPa * 0.0295299831;
}

function formatPressure(value, unit) {
  if (unit === "inhg") {
    return `${toInHg(value).toFixed(2)} inHg`;
  }
  return `${Math.round(value)} hPa`;
}

function getAqiBand(usAqi) {
  if (usAqi <= 50) return { label: "Good", color: "#4ade80" };
  if (usAqi <= 100) return { label: "Moderate", color: "#facc15" };
  if (usAqi <= 150) return { label: "Unhealthy (Sensitive)", color: "#fb923c" };
  if (usAqi <= 200) return { label: "Unhealthy", color: "#f87171" };
  if (usAqi <= 300) return { label: "Very Unhealthy", color: "#c084fc" };
  return { label: "Hazardous", color: "#ef4444" };
}

function createCard(label, value) {
  return `
    <article class="card">
      <p class="card-label">${label}</p>
      <p class="card-value">${value}</p>
    </article>
  `;
}

function renderWeather(place, payload) {
  const current = payload.current;
  const currentUnits = payload.current_units;
  const locationText = getLocationText(place);
  const weatherDescription = weatherCodeMap[current.weather_code] || "Unknown";
  const pressureDisplay = formatPressure(current.surface_pressure, getPressureUnit());

  selectedLocation.textContent = locationText;
  weatherGrid.innerHTML = [
    createCard("Condition", weatherDescription),
    createCard("Temperature", `${current.temperature_2m}${currentUnits.temperature_2m}`),
    createCard("Feels Like", `${current.apparent_temperature}${currentUnits.apparent_temperature}`),
    createCard("Humidity", `${current.relative_humidity_2m}${currentUnits.relative_humidity_2m}`),
    createCard("Wind Speed", `${current.wind_speed_10m} ${currentUnits.wind_speed_10m}`),
    createCard("Pressure", pressureDisplay),
    createCard("Precipitation", `${current.precipitation} ${currentUnits.precipitation}`),
    createCard("Cloud Cover", `${current.cloud_cover}${currentUnits.cloud_cover}`)
  ].join("");

  weatherSection.classList.remove("hidden");
  updatedAt.textContent = `Updated: ${new Date(current.time).toLocaleString()} (${payload.timezone})`;
}

function formatDay(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function renderForecast(payload) {
  const daily = payload.daily;
  const dailyUnits = payload.daily_units;

  if (!daily || !daily.time || daily.time.length === 0) {
    forecastGrid.innerHTML = "<p class=\"forecast-sub\">No forecast data available.</p>";
    return;
  }

  forecastGrid.innerHTML = daily.time.map((day, index) => {
    const code = daily.weather_code[index];
    const condition = weatherCodeMap[code] || "Unknown";
    return `
      <article class="forecast-card">
        <p class="forecast-day">${formatDay(day)}</p>
        <p class="forecast-sub">${condition}</p>
        <p class="forecast-sub">High: ${daily.temperature_2m_max[index]}${dailyUnits.temperature_2m_max}</p>
        <p class="forecast-sub">Low: ${daily.temperature_2m_min[index]}${dailyUnits.temperature_2m_min}</p>
        <p class="forecast-sub">Rain chance: ${daily.precipitation_probability_max[index]}${dailyUnits.precipitation_probability_max}</p>
      </article>
    `;
  }).join("");

  setStatus("Weather and 7-day forecast loaded successfully.");
}

function renderSunAndUv(payload) {
  const daily = payload.daily;
  const dailyUnits = payload.daily_units;
  if (!daily || !daily.time || daily.time.length === 0) {
    sunUvGrid.innerHTML = [
      createCard("Sunrise", "Unavailable"),
      createCard("Sunset", "Unavailable"),
      createCard("UV Max", "Unavailable")
    ].join("");
    return;
  }

  const sunrise = daily.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString() : "Unavailable";
  const sunset = daily.sunset?.[0] ? new Date(daily.sunset[0]).toLocaleTimeString() : "Unavailable";
  const uvMax = daily.uv_index_max?.[0] !== undefined
    ? `${daily.uv_index_max[0]} ${dailyUnits.uv_index_max || ""}`.trim()
    : "Unavailable";

  sunUvGrid.innerHTML = [
    createCard("Sunrise", sunrise),
    createCard("Sunset", sunset),
    createCard("UV Max", uvMax)
  ].join("");
}

function renderAqi(aqiPayload) {
  if (!aqiPayload?.current) {
    aqiGrid.innerHTML = [
      createCard("US AQI", "Unavailable"),
      createCard("PM2.5", "Unavailable"),
      createCard("PM10", "Unavailable"),
      createCard("Ozone", "Unavailable")
    ].join("");
    return;
  }
  const current = aqiPayload.current;
  const units = aqiPayload.current_units || {};
  const band = getAqiBand(current.us_aqi);
  aqiGrid.innerHTML = [
    createCard("US AQI", `${current.us_aqi} (${band.label})`),
    createCard("PM2.5", `${current.pm2_5} ${units.pm2_5 || ""}`.trim()),
    createCard("PM10", `${current.pm10} ${units.pm10 || ""}`.trim()),
    createCard("Ozone", `${current.ozone} ${units.ozone || ""}`.trim())
  ].join("");
  const first = aqiGrid.querySelector(".card-value");
  if (first) {
    first.style.color = band.color;
  }
}

function renderAlerts(payload, aqiPayload) {
  const alerts = [];
  const current = payload.current;
  const daily = payload.daily;

  if (current.wind_speed_10m >= 45) {
    alerts.push("High wind advisory");
  }
  if ([65, 67, 82, 86, 95, 96, 99].includes(current.weather_code)) {
    alerts.push("Severe precipitation/storm risk");
  }
  if (daily?.uv_index_max?.[0] >= 8) {
    alerts.push("High UV warning");
  }
  if (aqiPayload?.current?.us_aqi >= 151) {
    alerts.push("Poor air quality warning");
  }

  if (alerts.length === 0) {
    alertsPanel.classList.remove("hidden");
    alertsPanel.innerHTML = "<span class=\"alert-pill info\">No active alerts</span>";
    return;
  }

  alertsPanel.classList.remove("hidden");
  alertsPanel.innerHTML = alerts.map((alert) => `<span class="alert-pill">${alert}</span>`).join("");
}

function renderHourlyChart(payload) {
  const hourly = payload.hourly;
  const units = payload.hourly_units || {};
  if (!hourly?.time?.length) {
    hourlyChart.innerHTML = "";
    hourlyMeta.textContent = "";
    return;
  }

  const temps = hourly.temperature_2m.slice(0, 24);
  const times = hourly.time.slice(0, 24);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = Math.max(max - min, 1);
  const chartWidth = 720;
  const chartHeight = 220;
  const padX = 24;
  const padY = 26;

  const points = temps
    .map((temp, i) => {
      const x = padX + (i * (chartWidth - padX * 2)) / Math.max(temps.length - 1, 1);
      const y = chartHeight - padY - ((temp - min) / range) * (chartHeight - padY * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const gradientId = "tempGradient";
  hourlyChart.innerHTML = `
    <defs>
      <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.95" />
        <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.2" />
      </linearGradient>
    </defs>
    <polyline fill="none" stroke="#38bdf8" stroke-width="4" points="${points}" />
    ${temps
      .map((temp, i) => {
        const x = padX + (i * (chartWidth - padX * 2)) / Math.max(temps.length - 1, 1);
        const y = chartHeight - padY - ((temp - min) / range) * (chartHeight - padY * 2);
        return `<circle cx="${x}" cy="${y}" r="3.3" fill="url(#${gradientId})" />`;
      })
      .join("")}
  `;

  const start = new Date(times[0]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const end = new Date(times[Math.min(times.length - 1, 23)]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  hourlyMeta.textContent = `24h temperature trend (${start} - ${end}) in ${units.temperature_2m || "deg"}`;
}

async function fetchWeather(place) {
  try {
    setStatus("Loading weather, AQI, hourly chart, and alerts...");

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", place.latitude);
    url.searchParams.set("longitude", place.longitude);
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m");
    url.searchParams.set("hourly", "temperature_2m,precipitation_probability,wind_speed_10m");
    url.searchParams.set("forecast_hours", "24");
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("temperature_unit", tempUnitSelect.value);
    url.searchParams.set("wind_speed_unit", getSpeedUnit());
    url.searchParams.set("precipitation_unit", getPrecipitationUnit());

    const aqiUrl = new URL(airQualityApiUrl);
    aqiUrl.searchParams.set("latitude", place.latitude);
    aqiUrl.searchParams.set("longitude", place.longitude);
    aqiUrl.searchParams.set("current", "us_aqi,pm2_5,pm10,ozone");
    aqiUrl.searchParams.set("timezone", "auto");

    const [response, aqiResponse] = await Promise.all([fetch(url.toString()), fetch(aqiUrl.toString())]);
    if (!response.ok) {
      throw new Error("Weather API request failed.");
    }

    const [data, aqiData] = await Promise.all([
      response.json(),
      aqiResponse.ok ? aqiResponse.json() : Promise.resolve(null)
    ]);
    if (!data.current) {
      throw new Error("No weather data returned.");
    }

    renderWeather(place, data);
    renderSunAndUv(data);
    renderHourlyChart(data);
    renderAqi(aqiData);
    renderAlerts(data, aqiData);
    renderForecast(data);
  } catch (error) {
    setStatus(`Unable to load weather: ${error.message}`);
  }
}

async function searchLocations(query) {
  try {
    setStatus("Searching locations...");
    weatherSection.classList.add("hidden");
    resultsList.innerHTML = "";

    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", query);
    url.searchParams.set("count", "10");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error("Location search request failed.");
    }

    const data = await response.json();
    renderResults(data.results || []);
  } catch (error) {
    setStatus(`Unable to search locations: ${error.message}`);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();

  if (!query) {
    setStatus("Please enter a location name.");
    return;
  }

  searchLocations(query);
});

if (currentLocationBtn) {
  currentLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setStatus("Geolocation is not supported by your browser.");
      return;
    }

    setStatus("Detecting your location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const place = {
          name: "Current Location",
          admin1: "",
          country: getCoordinateSummary(position.coords.latitude, position.coords.longitude),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        lastSelectedLocation = place;
        clearGlobePin();
        fetchWeather(place);
      },
      (error) => {
        setStatus(`Unable to access your location: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

[windUnitSelect, precipUnitSelect, pressureUnitSelect].forEach((control) => {
  control.addEventListener("change", () => {
    if (lastSelectedLocation) {
      fetchWeather(lastSelectedLocation);
    }
  });
});

// Backwards compatibility for older snapshots where only one select existed.
const unitSelect = document.getElementById("unit-select");
if (unitSelect) {
  unitSelect.addEventListener("change", () => {
    if (lastSelectedLocation) {
      fetchWeather(lastSelectedLocation);
    }
  });
}

if (!tempUnitSelect.value) tempUnitSelect.value = "celsius";
if (!windUnitSelect.value) windUnitSelect.value = "kmh";
if (!precipUnitSelect.value) precipUnitSelect.value = "mm";
if (!pressureUnitSelect.value) pressureUnitSelect.value = "hpa";

if (tempUnitSelect.value === "fahrenheit") {
  windUnitSelect.value = "mph";
  precipUnitSelect.value = "inch";
}

tempUnitSelect.addEventListener("change", () => {
  if (tempUnitSelect.value === "fahrenheit") {
    if (windUnitSelect.value === "kmh") {
      windUnitSelect.value = "mph";
    }
    if (precipUnitSelect.value === "mm") {
      precipUnitSelect.value = "inch";
    }
  }
  if (lastSelectedLocation) {
    fetchWeather(lastSelectedLocation);
  }
});

initializeGlobe();

if (appVersionLabel) {
  appVersionLabel.textContent = `Version: ${APP_VERSION}`;
}
