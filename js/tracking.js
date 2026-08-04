// ======================
// TRACKING SYSTEM
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

// Movement threshold in meters. Lowered to 50m so small tests will record; change as needed.
const MOVE_THRESHOLD_METERS = 50;

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

export function startTracking(attendanceID) {
  if (watchID !== null) return;

  if (!attendanceID) {
    console.error("startTracking: attendanceID is not set or falsy. Tracking will not start.");
    return;
  }

  console.log("Starting tracking for attendanceID:", attendanceID);

  if (!('geolocation' in navigator)) {
    console.error('Geolocation is not available in this browser.');
    return;
  }

  watchID = navigator.geolocation.watchPosition(
    async (position) => {
      try {
        const lat = position?.coords?.latitude;
        const lon = position?.coords?.longitude;

        if (typeof lat !== 'number' || typeof lon !== 'number') {
          console.warn('Invalid position received, skipping.');
          return;
        }

        if (lastLat !== null && lastLon !== null) {
          const move = distance(lastLat, lastLon, lat, lon);
          // ignore insignificant moves
          if (move < MOVE_THRESHOLD_METERS) {
            // console.debug('Move below threshold:', move);
            return;
          }
        }

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
        console.log('Writing tracking document to:', `attendance/${attendanceID}/tracking`, { lat, lon, place });

        try {
          await addDoc(colRef, {
            attendanceID,
            latitude: lat,
            longitude: lon,
            location: place,
            createdAt: serverTimestamp()
          });

          console.log('Tracking saved', place);
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
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
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
