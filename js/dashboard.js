import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  startTracking,
  stopTracking
} from "./tracking.js";

// ===============================
// GLOBAL VARIABLES
// ===============================
let currentUser = null;
let driverName = "";
let driverPosition = "";
let driverEmail = "";
let userRole = "driver";
let otRate = 20;
let selfieFile = null;
let userReady = false;
let currentStatus = "Driving";

// Pending check-in payload (location + selfie must be provided before sliding)
const pendingCheckin = {
  lat: null,
  lon: null,
  place: null,
  selfie: null
};

// Helpers: guarded DOM accessor
const $ = id => document.getElementById(id);

// Safe text setter
function setText(id, text) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
}

// Toast helper (non-blocking)
function showToast(message, timeout = 3000) {
  const t = $("toast");
  if (!t) {
    try { alert(message); } catch (e) { console.log(message); }
    return;
  }
  t.textContent = message;
  t.style.display = "block";
  clearTimeout(t._hideTimeout);
  t._hideTimeout = setTimeout(() => {
    t.style.display = "none";
  }, timeout);
}

// Greeting helper
function showGreeting(name) {
  const g = $("greeting");
  if (!g) return;
  if (name && name.length) {
    g.textContent = `Welcome, ${name}`;
    g.style.display = "block";
  } else {
    g.style.display = "none";
  }
}

// ===============================
// LOAD USER
// ===============================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "login.html";
    return;
  }

  currentUser = user;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      driverName = data.name || "";
      driverPosition = data.position || "";
      driverEmail = data.email || "";
      userRole = data.role || "driver";
      otRate = data.otRate || 20;

      userReady = true;
      await loadAttendanceStatus();

      if (localStorage.getItem("status") === "Driving") {
        showGreeting(driverName);
      }
    }
  } catch (err) {
    console.error("Failed to load user:", err);
  }
});

// ===============================
// UPDATE STATUS UI
// ===============================
function updateStatus(status) {
  currentStatus = status;
  setText("status", status);
  setText("dashStatus", status);
  const btnCheckin = $("btn-checkin");
  if (btnCheckin) btnCheckin.setAttribute("aria-pressed", String(status === "Driving"));

  localStorage.setItem("status", status);
}

// ===============================
// GET LOCATION NAME (reverse geocode)
// ===============================
async function getLocationName(lat, lon) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
    if (!response.ok) throw new Error("Geocoding failed");
    const data = await response.json();
    return data.display_name || "Lokasi tidak diketahui";
  } catch (error) {
    console.warn("Reverse geocode error:", error);
    return "Lokasi tidak diketahui";
  }
}

// ===============================
// CONVERT TO BASE64 (accepts File/Blob)
// ===============================
async function convertToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

// ===============================
// COMPRESS IMAGE (returns Blob)
// ===============================
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const MAX_SIZE = 800;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/jpeg", 0.7);
    };

    reader.readAsDataURL(file);
  });
}

// ===============================
// SAVE FIRST TRACK
// ===============================
async function saveTracking(lat, lon, status) {
  const attendanceID = localStorage.getItem("attendanceID");
  if (!attendanceID) return;
  const place = await getLocationName(lat, lon);
  try {
    await addDoc(collection(db, "attendance", attendanceID, "tracking"), {
      latitude: lat,
      longitude: lon,
      place: place,
      status: status,
      time: serverTimestamp()
    });
  } catch (err) {
    console.error("Failed to save tracking:", err);
  }
}

// ===============================
// CHECK IN
// ===============================
function initCheckinHandler() {
  const btnCheckin = $("btn-checkin");
  const selfieInput = $("selfieInput");
  const slideConfirm = $("slideConfirm");
  const slideTrack = $("slideTrack");
  const sliderKnob = $("sliderKnob");

  if (!btnCheckin || !selfieInput || !slideConfirm || !slideTrack || !sliderKnob) return;

  function showSlideConfirm() {
    slideConfirm.style.display = "flex";
    slideConfirm.setAttribute("aria-hidden", "false");
    sliderKnob.style.left = "6px";
    sliderKnob._confirmed = false;
  }

  function hideSlideConfirm() {
    slideConfirm.style.display = "none";
    slideConfirm.setAttribute("aria-hidden", "true");
  }

  // Slide logic
  let dragging = false;
  let startX = 0;
  let knobStartLeft = 6;
  sliderKnob.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    sliderKnob.setPointerCapture(ev.pointerId);
    dragging = true;
    startX = ev.clientX;
    const leftPx = parseInt(getComputedStyle(sliderKnob).left, 10) || 6;
    knobStartLeft = leftPx;
  });

  window.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    ev.preventDefault();
    const trackRect = slideTrack.getBoundingClientRect();
    const knobWidth = sliderKnob.offsetWidth;
    const minLeft = 6;
    const maxLeft = trackRect.width - knobWidth - 6;
    const delta = ev.clientX - startX;
    let newLeft = knobStartLeft + delta;
    if (newLeft < minLeft) newLeft = minLeft;
    if (newLeft > maxLeft) newLeft = maxLeft;
    sliderKnob.style.left = `${newLeft}px`;
    if (newLeft >= maxLeft * 0.85) {
      sliderKnob._confirmed = true;
      sliderKnob.style.left = `${maxLeft}px`;
    } else {
      sliderKnob._confirmed = false;
    }
  });

  window.addEventListener("pointerup", (ev) => {
    if (!dragging) return;
    dragging = false;
    try { sliderKnob.releasePointerCapture(ev.pointerId); } catch (e) {}
    if (sliderKnob._confirmed) {
      hideSlideConfirm();
      // finalise check-in using pendingCheckin
      doFinalCheckin();
    } else {
      sliderKnob.style.left = "6px";
    }
  });

  sliderKnob.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
      ev.preventDefault();
      sliderKnob._confirmed = true;
      hideSlideConfirm();
      doFinalCheckin();
    }
  });

  // When user presses Check In: get location first, then selfie, then show slide
  btnCheckin.addEventListener("click", async () => {
    if (!userReady) {
      showToast("Sila tunggu sistem siap loading.");
      return;
    }

    if (localStorage.getItem("status") === "Driving") {
      showToast("Anda sudah Check In.");
      return;
    }

    if (!navigator.geolocation) {
      showToast("Browser tidak menyokong GPS.");
      return;
    }

    showToast("Mendapatkan lokasi...");

    navigator.geolocation.getCurrentPosition(async function (pos) {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const place = await getLocationName(lat, lon);

      // set pending location
      pendingCheckin.lat = lat;
      pendingCheckin.lon = lon;
      pendingCheckin.place = place;

      showToast(`Lokasi: ${place}`);

      // Check for active attendance for today
      try {
        const today = new Date().toLocaleDateString();
        const q = query(collection(db, "attendance"), where("uid", "==", currentUser.uid), where("status", "==", "Working"));
        const snap = await getDocs(q);
        let active = false;
        snap.forEach((d) => {
          const data = d.data();
          if (data.checkIn) {
            const date = data.checkIn.toDate().toLocaleDateString();
            if (date === today) active = true;
          }
        });
        if (active) {
          showToast("❌ Anda masih belum Check Out.");
          // clear pending location
          pendingCheckin.lat = pendingCheckin.lon = pendingCheckin.place = null;
          return;
        }
      } catch (err) {
        console.error("Attendance check failed:", err);
      }

      // Request camera permission first (best-effort) then open file input
      try {
        await requestCameraThenSelfieInput().catch(() => {});
      } finally {
        selfieInput.value = "";
        selfieInput.click();
      }

    }, function (error) {
      console.warn("Geolocation error:", error);
      showToast("❌ Sila hidupkan GPS dan benarkan akses lokasi.");
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });

  // Selfie input: set pendingCheckin.selfie, then show slide confirm
  selfieInput.addEventListener("change", async function (e) {
    if (!e.target.files || e.target.files.length === 0) {
      showToast("Sila ambil selfie dahulu.");
      return;
    }

    pendingCheckin.selfie = e.target.files[0];

    showToast("Selfie diterima. Sila luncurkan untuk mengesahkan.");

    // Ensure we have location; if not, ask to get location first
    if (!pendingCheckin.lat) {
      showToast("Sila dapatkan lokasi terlebih dahulu.");
      return;
    }

    // Show slide-to-confirm now that location + selfie are present
    showSlideConfirm();
    setTimeout(() => sliderKnob.focus(), 100);
  });
}

// Final check-in action uses pendingCheckin data
async function doFinalCheckin() {
  if (!pendingCheckin.lat || !pendingCheckin.lon || !pendingCheckin.place) {
    showToast("Lokasi tidak tersedia. Sila cuba lagi.");
    return;
  }
  if (!pendingCheckin.selfie) {
    showToast("Selfie tidak tersedia. Sila ambil selfie dahulu.");
    return;
  }

  try {
    const compressed = await compressImage(pendingCheckin.selfie);
    const selfieBase64 = await convertToBase64(compressed);

    const ref = await addDoc(collection(db, "attendance"), {
      uid: currentUser.uid,
      name: driverName,
      position: driverPosition,
      email: driverEmail,
      role: userRole,
      selfie: selfieBase64,
      latitude: pendingCheckin.lat,
      longitude: pendingCheckin.lon,
      location: pendingCheckin.place,
      status: "Working",
      trackingStatus: "Running",
      checkIn: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    localStorage.setItem("attendanceID", ref.id);

    const now = new Date();
    localStorage.setItem("checkIn", now.toString());
    localStorage.setItem("status", "Driving");
    localStorage.setItem("checkinLat", pendingCheckin.lat);
    localStorage.setItem("checkinLon", pendingCheckin.lon);
    localStorage.setItem("checkinPlace", pendingCheckin.place);

    const mapLink = `https://www.google.com/maps?q=${pendingCheckin.lat},${pendingCheckin.lon}`;
    localStorage.setItem("checkinMap", mapLink);

    updateStatus("Driving");
    setText("checkinData", "CHECK IN : " + now.toLocaleTimeString());
    setText("checkinLocation", "📍 CHECK IN LOCATION : " + pendingCheckin.place);

    const openCheckinMap = $("openCheckinMap");
    if (openCheckinMap) {
      openCheckinMap.style.display = "block";
      openCheckinMap.onclick = () => window.open(mapLink, "_blank");
    }

    const btnCheckout = $("btn-checkout");
    if ($("btn-checkin")) $("btn-checkin").disabled = true;
    if (btnCheckout) btnCheckout.disabled = false;

    await saveTracking(pendingCheckin.lat, pendingCheckin.lon, "MULA");
    if (localStorage.getItem("attendanceID")) startTracking();

    showToast("Check in successful");
    showGreeting(driverName);

    // clear pending selfie but keep location if needed
    pendingCheckin.selfie = null;
  } catch (err) {
    console.error("Check-in failed:", err);
    showToast("❌ Gagal semasa Check In.");
  }
}

// Helper: try to request camera permission via getUserMedia then close tracks before opening input
async function requestCameraThenSelfieInput() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
  } catch (err) {
    console.warn("getUserMedia failed:", err);
    throw err;
  }
}

// ===============================
// CHECK OUT
// ===============================
function initCheckoutHandler() {
  const btnCheckout = $("btn-checkout");
  if (!btnCheckout) return;

  btnCheckout.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showToast("Browser tidak menyokong GPS.");
      return;
    }

    navigator.geolocation.getCurrentPosition(async function (pos) {
      try {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const place = await getLocationName(lat, lon);
        const id = localStorage.getItem("attendanceID");
        if (!id) {
          showToast("Tiada rekod Check In.");
          return;
        }

        const checkInTime = new Date(localStorage.getItem("checkIn"));
        const checkOutTime = new Date();
        const totalHour = (checkOutTime - checkInTime) / 3600000;
        let otHour = 0;
        if (totalHour > 8) otHour = totalHour - 8;
        const otMoney = otHour * otRate;

        await updateDoc(doc(db, "attendance", id), {
          status: "Completed",
          trackingStatus: "Stopped",
          checkOut: checkOutTime,
          checkoutLocation: place,
          totalHour: Number(totalHour.toFixed(2)),
          otHour: Number(otHour.toFixed(2)),
          otMoney: Number(otMoney.toFixed(2))
        });

        localStorage.setItem("checkOut", checkOutTime.toString());
        localStorage.setItem("status", "Standby");
        localStorage.setItem("checkoutLat", lat);
        localStorage.setItem("checkoutLon", lon);
        localStorage.setItem("checkoutPlace", place);

        const mapLink = `https://www.google.com/maps?q=${lat},${lon}`;
        localStorage.setItem("checkoutMap", mapLink);

        stopTracking();
        localStorage.removeItem("attendanceID");

        updateStatus("Standby");
        setText("checkoutData", "CHECK OUT : " + checkOutTime.toLocaleTimeString());
        setText("checkoutLocation", "📍 CHECK OUT LOCATION : " + place);

        const btnCheckin = $("btn-checkin");
        if (btnCheckin) btnCheckin.disabled = false;
        if (btnCheckout) btnCheckout.disabled = true;

        showToast("Check Out successful");
        showGreeting("");
      } catch (err) {
        console.error("Check-out failed:", err);
        showToast("❌ Tidak dapat mengambil lokasi Check Out.");
      }
    }, function (error) {
      console.warn("Geolocation error:", error);
      showToast("❌ Tidak dapat mengambil lokasi Check Out.");
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });
}

// ===============================
// AUTO RESTORE STATUS
// ===============================
async function loadAttendanceStatus() {
  if (!currentUser) return;
  try {
    const q = query(collection(db, "attendance"), where("uid", "==", currentUser.uid), where("status", "==", "Working"));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const attendanceDoc = snap.docs[0];
      localStorage.setItem("attendanceID", attendanceDoc.id);
      updateStatus("Driving");
      const btnCheckin = $("btn-checkin");
      const btnCheckout = $("btn-checkout");
      if (btnCheckin) btnCheckin.disabled = true;
      if (btnCheckout) btnCheckout.disabled = false;
      startTracking();
    } else {
      localStorage.removeItem("attendanceID");
      updateStatus("Standby");
      const btnCheckin = $("btn-checkin");
      const btnCheckout = $("btn-checkout");
      if (btnCheckin) btnCheckin.disabled = false;
      if (btnCheckout) btnCheckout.disabled = true;
      stopTracking();
    }
  } catch (err) {
    console.error("Failed to restore attendance:", err);
  }
}

// ===============================
// LIVE WORKING HOUR
// ===============================
function updateWorkingDisplay() {
  const status = localStorage.getItem("status");
  if (status !== "Driving") return;
  const checkIn = localStorage.getItem("checkIn");
  if (!checkIn) return;
  const totalHour = (new Date() - new Date(checkIn)) / 3600000;
  let otHour = 0;
  if (totalHour > 8) otHour = totalHour - 8;
  const otMoney = otHour * otRate;

  setText("totalData", "TOTAL WORKING : " + totalHour.toFixed(2) + " jam");
  setText("dashHour", totalHour.toFixed(2) + " jam");
  setText("otData", "OT : " + otHour.toFixed(2) + " jam");
  setText("otMoney", "TOTAL OT : RM " + otMoney.toFixed(2));
  setText("dashOT", "RM " + otMoney.toFixed(2));
}

function startWorkingTimer() {
  updateWorkingDisplay();
  return setInterval(updateWorkingDisplay, 60000);
}

// ===============================
// INITIALIZE ON DOM READY
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  initCheckinHandler();
  initCheckoutHandler();

  // Wire selfie button (explicit selfie button on UI) - if clicked, ensure location exists then open camera
  const btnSelfie = $("btn-selfie");
  const selfieInput = $("selfieInput");
  const btnCheckin = $("btn-checkin");
  if (btnSelfie && selfieInput) {
    btnSelfie.addEventListener("click", async () => {
      // If we don't have pending location, try to get it first
      if (!pendingCheckin.lat) {
        if (!btnCheckin) return;
        // reuse checkin flow to obtain location
        btnCheckin.click();
        return;
      }
      try {
        await requestCameraThenSelfieInput().catch(() => {});
      } finally {
        selfieInput.value = "";
        selfieInput.click();
      }
    });
  }

  // Location button quick action
  const btnLocation = $("btn-location");
  if (btnLocation) {
    btnLocation.addEventListener("click", () => {
      if (!navigator.geolocation) {
        showToast("Browser tidak menyokong GPS.");
        return;
      }
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const place = await getLocationName(lat, lon);
        // store to pending location so later selfie/slide can use it
        pendingCheckin.lat = lat;
        pendingCheckin.lon = lon;
        pendingCheckin.place = place;
        showToast(`Lokasi: ${place}`);
      }, (err) => {
        console.warn("Location error:", err);
        showToast("Gagal mendapatkan lokasi.");
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });
  }

  // Restore UI from localStorage (defensive)
  const status = localStorage.getItem("status");
  if (status) updateStatus(status);

  const checkIn = localStorage.getItem("checkIn");
  if (checkIn) setText("checkinData", "CHECK IN : " + new Date(checkIn).toLocaleTimeString());
  const place = localStorage.getItem("checkinPlace");
  if (place) setText("checkinLocation", "📍 CHECK IN LOCATION : " + place);

  const map = localStorage.getItem("checkinMap");
  if (map) {
    const openCheckinMap = $("openCheckinMap");
    if (openCheckinMap) {
      openCheckinMap.style.display = "block";
      openCheckinMap.onclick = () => window.open(map, "_blank");
    }
  }

  const checkOut = localStorage.getItem("checkOut");
  if (checkOut) setText("checkoutData", "CHECK OUT : " + new Date(checkOut).toLocaleTimeString());
  const checkoutPlace = localStorage.getItem("checkoutPlace");
  if (checkoutPlace) setText("checkoutLocation", "📍 CHECK OUT LOCATION : " + checkoutPlace);

  const checkoutMap = localStorage.getItem("checkoutMap");
  if (checkoutMap) {
    const openCheckoutMap = $("openCheckoutMap");
    if (openCheckoutMap) {
      openCheckoutMap.style.display = "block";
      openCheckoutMap.onclick = () => window.open(checkoutMap, "_blank");
    }
  }

  const attendanceID = localStorage.getItem("attendanceID");
  if (attendanceID && localStorage.getItem("status") === "Driving") {
    startTracking();
    const btnCheckinEl = $("btn-checkin");
    const btnCheckout = $("btn-checkout");
    if (btnCheckinEl) btnCheckinEl.disabled = true;
    if (btnCheckout) btnCheckout.disabled = false;
    showGreeting(driverName);
  } else {
    stopTracking();
  }

  startWorkingTimer();
});

// ===============================
// DRIVER STATUS CHANGE (updates Firestore)
// ===============================
const driverStatusEl = $("driverStatus");
if (driverStatusEl) {
  driverStatusEl.addEventListener("change", async function () {
    currentStatus = this.value;
    updateStatus(currentStatus);
    const attendanceID = localStorage.getItem("attendanceID");
    if (!attendanceID) return;
    try {
      await updateDoc(doc(db, "attendance", attendanceID), {
        currentStatus: currentStatus
      });
    } catch (err) {
      console.error("Failed to update currentStatus:", err);
    }
  });
}
