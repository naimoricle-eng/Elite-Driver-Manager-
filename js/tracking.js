// ======================
// TRACKING SYSTEM (Updated)
// ======================


import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let watchID = null;
let lastLat = null;
let lastLon = null;
let lastSaveTs = 0; // ms since epoch of last saved point

// Default movement threshold in meters. Change as needed.
const DEFAULT_MOVE_THRESHOLD_METERS = 10; // reduce so small moves are captured

// Default minimum interval between saves (ms). Force a save at least this often even if move < threshold.
const DEFAULT_MIN_INTERVAL_MS = 30000; // 30 seconds

// Default geolocation options
const DEFAULT_GEO_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10000
};

// ======================
// DISTANCE CALCULATOR
// ======================

function distance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // metres

  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ======================
// START TRACKING
// ======================

// startTracking(attendanceID, options)
// options:{ threshold: number (meters), minIntervalMs: number (ms), enableHighAccuracy: boolean, timeout: number, maximumAge: number }
export function startTracking(attendanceID, options = {}) {
  if (watchID !== null) {
    console.warn('startTracking: already tracking.');
    return;
  }

  if (!attendanceID) {
    console.error("startTracking: attendanceID is not set or falsy. Tracking will not start.");
    return;
  }

  // Determine threshold: prefer explicit numeric value in options, otherwise default
  const threshold = (options && typeof options.threshold === 'number' && !isNaN(options.threshold))
    ? options.threshold
    : DEFAULT_MOVE_THRESHOLD_METERS;

  const minIntervalMs = (options && typeof options.minIntervalMs === 'number' && !isNaN(options.minIntervalMs))
    ? options.minIntervalMs
    : DEFAULT_MIN_INTERVAL_MS;

  // Geolocation options (allow overriding defaults)
  const geoOptions = {
    enableHighAccuracy: (options && typeof options.enableHighAccuracy === 'boolean')
      ? options.enableHighAccuracy
      : DEFAULT_GEO_OPTIONS.enableHighAccuracy,
    maximumAge: (options && typeof options.maximumAge === 'number')
      ? options.maximumAge
      : DEFAULT_GEO_OPTIONS.maximumAge,
    timeout: (options && typeof options.timeout === 'number')
      ? options.timeout
      : DEFAULT_GEO_OPTIONS.timeout
  };

  console.log("Starting tracking for attendanceID:", attendanceID, "threshold(m):", threshold, "minIntervalMs:", minIntervalMs, "geoOptions:", geoOptions);

  if (!('geolocation' in navigator)) {
    console.error('Geolocation is not available in this browser.');
    return;
  }

  console.log("START WATCH GPS");

watchID = navigator.geolocation.watchPosition(
    async (position) => {
      console.log("GPS UPDATE MASUK");
      try {
        const lat = position?.coords?.latitude;
        const lon = position?.coords?.longitude;

        if (typeof lat !== 'number' || typeof lon !== 'number') {
          console.warn('Invalid position received, skipping.');
          return;
        }

        const now = Date.now();
        let moved = Infinity;

        if (lastLat !== null && lastLon !== null) {
          moved = distance(lastLat, lastLon, lat, lon);
        }

        const timeSinceLastSave = now - (lastSaveTs || 0);

        // Only save if moved enough OR enough time passed since last save
        if (lastLat !== null && lastLon !== null) {
          if (moved < threshold && timeSinceLastSave < minIntervalMs) {
            // not enough movement and not enough time passed
            // console.debug('Move below threshold and interval not reached:', moved, timeSinceLastSave);
            return;
          }
        }

        // Update last known coords
        lastLat = lat;
        lastLon = lon;

        // Reverse-geocode the place name. Wrap in try/catch so failures don't stop tracking.
        let place = 'Unknown';
        try {
          place = await getPlaceName(lat, lon);
        } catch (err) {
          console.warn('getPlaceName failed, using Unknown:', err);
          place = 'Unknown';
        }

        const colRef = collection(db, 'attendance', attendanceID, 'tracking');
        console.log('Writing tracking document to:', `attendance/${attendanceID}/tracking`, { lat, lon, place, moved, timeSinceLastSave });

        try {
          await addDoc(colRef, {
            attendanceID,
            latitude: lat,
            longitude: lon,
            location: place,
            movedMeters: isFinite(moved) ? Math.round(moved) : null,
            time: serverTimestamp()
          });

          lastSaveTs = Date.now();
          console.log('Tracking saved', place, 'moved:', moved);
        } catch (err) {
          console.error('Failed to save tracking to Firestore:', err);
        }

      } catch (err) {
        console.error('Unexpected error in watchPosition callback:', err);
      }
    },
    (error) => {
      console.error('GPS error', error);
    },
    geoOptions
  );
}

// ======================
// STOP TRACKING
// ======================

export function stopTracking() {
  if (watchID !== null) {
    navigator.geolocation.clearWatch(watchID);
    watchID = null;
  }

  lastLat = null;
  lastLon = null;
  lastSaveTs = 0;

  console.log('Tracking stopped');
}

// ======================
// REVERSE LOCATION
// ======================

async function getPlaceName(lat, lon) {
  // Use Nominatim reverse geocoding. Add an identifying parameter where possible.
  // Note: Browsers prevent setting the User-Agent header. Nominatim accepts the Referer header sent by browsers.
  // If you have an email for identification, append &email=youremail@example.com to the URL.

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;

  const res = await fetch(url, {
    // Do not set User-Agent in browsers; keep default. You can set other headers if required.
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error(`Nominatim response not ok: ${res.status}`);
  }

  const data = await res.json();
  return data.display_name || 'Unknown';
}
