const map = L.map("map").setView([3.1390,101.6869],11);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const timelineList = document.getElementById("timelineList");
const params = new URLSearchParams(window.location.search);
const attendanceID = params.get("id");

if(!attendanceID){
  timelineList.innerHTML = `<div role="alert">Attendance ID tidak dijumpai</div>`;
  throw new Error("Attendance ID kosong");
}

let points = []; // {lat,lng,timeMs,place,docRef,raw}
let totalDistance = 0;
let movingMarker = null;
const carIcon = L.divIcon({ html: `<div style="font-size:22px; transform: translate(-50%,-50%);">🚗</div>`, className:'', iconSize:[28,28], iconAnchor:[14,14] });

// Small in-page notification
function showError(msg){
  timelineList.innerHTML = `<div role="alert" style="color:#b00020;padding:12px">${msg}</div>`;
}

// fetch helpers
async function fetchWithRetry(url, attempts = 3, delay = 400){
  for(let i=0;i<attempts;i++){
    try{
      const res = await fetch(url);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch(err){
      if(i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
    }
  }
}

// show modal replacing prompt() — returns string or null
function showPlaceModal(defaultValue = ''){
  return new Promise(resolve => {
    const modal = document.getElementById('placeModal');
    const input = document.getElementById('placeModalInput');
    const cancel = document.getElementById('placeModalCancel');
    const save = document.getElementById('placeModalSave');

    function cleanup(result){
      modal.setAttribute('aria-hidden','true');
      modal.removeEventListener('keydown', onKey);
      cancel.removeEventListener('click', onCancel);
      save.removeEventListener('click', onSave);
      resolve(result);
    }
    function onCancel(){ cleanup(null); }
    function onSave(){ cleanup(input.value.trim() || null); }
    function onKey(e){
      if(e.key === 'Escape') { onCancel(); }
      if(e.key === 'Enter') { onSave(); }
    }

    input.value = defaultValue || '';
    modal.setAttribute('aria-hidden','false');
    cancel.addEventListener('click', onCancel);
    save.addEventListener('click', onSave);
    modal.addEventListener('keydown', onKey);
    input.focus();
  });
}

function sanitizePlace(s){
  if(!s) return null;
  return String(s).trim().slice(0,200);
}

function calculateDistance(lat1, lon1, lat2, lon2){
  if(!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) return 0;
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI / 180;
  const dLon = (lon2-lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function nearestVertex(latlngs, lat, lng){
  let bestIdx = 0, bestDist = Infinity;
  for(let i=0;i<latlngs.length;i++){
    const d = calculateDistance(lat, lng, latlngs[i][0], latlngs[i][1]);
    if(d < bestDist){ bestDist = d; bestIdx = i; }
  }
  return { latlng: latlngs[bestIdx], index: bestIdx, distKm: bestDist };
}

// Build timeline markup and attach event delegation for add-visit buttons
function renderTimeline(){
  points.sort((a,b)=> a.timeMs - b.timeMs);
  totalDistance = 0;
  let html = '';
  for(let i=0;i<points.length;i++){
    const p = points[i];
    if(i>0) totalDistance += calculateDistance(points[i-1].lat, points[i-1].lng, p.lat, p.lng);
    let timeStr = "-";
    try{ timeStr = new Date(p.timeMs).toLocaleString("ms-MY"); }catch(e){}
    const stopAfter = (i < points.length - 1) && ((points[i+1].timeMs - p.timeMs) >= 5*60*1000) && (calculateDistance(p.lat,p.lng, points[i+1].lat, points[i+1].lng) <= 0.05);
    html += `<div class="timeline-item" id="timeline-item-${i}" tabindex="0">
      <div><strong>${p.place ? escapeHtml(p.place) : 'Tracking Point'}</strong></div>
      <div style="color:#666">${timeStr}</div>
      ${!p.place && stopAfter ? `<div class="add-visit"><button class="btn-outline small add-visit-btn" data-idx="${i}">Add visit</button></div>` : ''}
    </div>`;
  }
  html += `<div class="timeline-item"><div><strong>🚗 Total Distance</strong></div><div style="font-size:18px">${totalDistance.toFixed(2)} KM</div></div>`;
  timelineList.innerHTML = html;

  // delegated handler
  timelineList.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('.add-visit-btn');
    if(!btn) return;
    const idx = Number(btn.dataset.idx);
    await handleAddVisit(idx);
  });
}

// minimal html escape
function escapeHtml(s){ return String(s).replace(/[&<>\