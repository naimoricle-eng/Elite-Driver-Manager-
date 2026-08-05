import { db } from "./firebase.js";

import {
collection,
getDocs,
getDoc,
doc,
query,
orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


import {
savePlace,
loadPlaces,
editPlace,
deletePlace
} from "./savedPlaces.js";



const map = L.map("map")
.setView([3.1390,101.6869],12);



L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
{
maxZoom:19,
attribution:"© OpenStreetMap"
}
)
.addTo(map);



const params =
new URLSearchParams(
window.location.search
);


// fallback to localStorage if URL param not provided
const attendanceID =
params.get("id") || localStorage.getItem("attendanceID");

console.log("route.js init - attendanceID:", attendanceID);

if(!attendanceID){

alert("Attendance ID tiada. Sila buka route.html?id=<attendanceId> atau pastikan anda telah check-in.");

throw new Error(
"Missing attendance ID"
);

}


let points = [];

let routeLine = null;

let car = null;

let savedLocations = [];
let visitRecords = [];


function formatTime(t){

if(!t) return "-";


if(t.toDate){

return t.toDate()
.toLocaleString("ms-MY");

}


return new Date(t)
.toLocaleString("ms-MY");

}




async function loadRoute(){

console.log("loadRoute() - start", { attendanceID });

const attendanceSnap =
await getDoc(
doc(
db,
"attendance",
attendanceID
)
);

console.log("attendanceSnap fetched, exists:", attendanceSnap.exists());

if(!attendanceSnap.exists()){

alert("Attendance tiada");

return;

}


const trackingQuery =
query(

collection(
db,
"attendance",
attendanceID,
"tracking"
),

orderBy(
"time",
"asc"
)

);


const snap =
await getDocs(trackingQuery);

console.log("Tracking query complete, docs:", snap.size);

let html="";


let idx = 0;

snap.forEach(item=>{

let data=item.data();
console.log("tracking doc:", { id: item.id, lat: data.latitude, lng: data.longitude, time: data.time });

data.place =
checkSavedLocation(
data.latitude,
data.longitude
);

if(
data.latitude &&
data.longitude
){

points.push({

lat:data.latitude,

lng:data.longitude,

timeMs:data.time?.toMillis
? data.time.toMillis()
: Date.now()

});

idx++;

html += `

<div class="card">

🚗 Tracking Point

<br>

📍 ${data.place || "-"}

<br>

🕒 ${formatTime(data.time)}

</div>

`;

}

});

console.log("Processed tracking points count:", idx);


document
.getElementById("timelineList")
.innerHTML=html;


calculateVisits();

renderVisits();

try{
await drawRoute();
} catch (err) {
console.error('drawRoute failed', err);
}

}



async function drawRoute(){

if(points.length < 2){

document
.getElementById("summary")
.innerHTML =
"Tracking tidak cukup";

console.log("drawRoute - not enough points", points.length);
return;

}

const coords =
points
.map(p=>`${p.lng},${p.lat}`)
.join(";");

console.log("drawRoute - coords:", coords);

const url =
`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

console.log("Calling OSRM:", url);

const response = await fetch(url);

if(!response.ok){
console.error('OSRM response not ok', response.status, response.statusText);
return;
}

const data =
await response.json();

console.log('OSRM response routes length:', data.routes?.length || 0);

if(!data.routes || !data.routes.length){
console.warn('No routes returned from OSRM');
return;
}

const route =
data.routes[0]
.geometry
.coordinates
.map(c=>[c[1],c[0]]);

routeLine =
L.polyline(
route,
{
weight:6
}
)
.addTo(map);

map.fitBounds(
routeLine.getBounds()
);

document
.getElementById("summary")
.innerHTML =

`<div class="card">\n\n📏 Jarak:\n${(
data.routes[0].distance/1000
).toFixed(2)} KM\n\n<br>\n\n📍 Point:\n${points.length}\n\n</div>`;

console.log('Route drawn, distance (km):', (data.routes[0].distance/1000).toFixed(2));

animateCar(route);

}


function animateCar(route){

const icon =
L.divIcon({

html:"🚗",

className:"",

iconSize:[30,30]

});

car =
L.marker(
route[0],
{
icon:icon
}
)
.addTo(map);

let i=0;

function move(){
if(i>=route.length) return;
car.setLatLng(route[i]);
i++;
setTimeout(move,100);
}

move();

}


// ========================
// SAVE LOCATION
// ========================

document
.getElementById("saveLocationBtn")
.onclick = async ()=>{

if(points.length==0){
alert("Tiada lokasi");
return;
}

let last = points[points.length-1];

let name = prompt("Nama tempat:");
if(!name) return;

console.log('saveLocationBtn clicked, saving place', { name, last });

// last is an object {lat,lng,timeMs} — use properties
await savePlace(
name,
last.lat,
last.lng
);

alert("Lokasi disimpan");

showPlaces();

};


async function showPlaces(){
let places = await loadPlaces();
console.log('showPlaces - loaded places count:', places.length);
let html="";
places.forEach(p=>{
html += `

<div class="card">

📍 ${p.name}

<br>

<button class="editBtn" data-id="${p.id}" data-name="${p.name}">✏️ Edit</button>

<button class="deleteBtn" data-id="${p.id}">🗑️ Delete</button>

</div>
`;
});

document
.getElementById("placeList")
.innerHTML=html;

document
.querySelectorAll(".editBtn")
.forEach(btn=>{
btn.onclick=async()=>{
let name = prompt("Tukar nama:", btn.dataset.name);
if(name){
console.log('Editing place', btn.dataset.id, 'newName', name);
await editPlace(btn.dataset.id, name);
showPlaces();
}
};
});

document
.querySelectorAll(".deleteBtn")
.forEach(btn=>{
btn.onclick=async()=>{
console.log('Deleting place', btn.dataset.id);
await deletePlace(btn.dataset.id);
showPlaces();
};
});

}


// ========================
// SAVED LOCATION MARKER
// ========================

async function showSavedMarkers(){
let places = await loadPlaces();
savedLocations = places;
console.log('showSavedMarkers - places count:', places.length);
places.forEach(place=>{
if(place.latitude && place.longitude){
let marker = L.marker([place.latitude, place.longitude]).addTo(map);
marker.bindPopup(`\n\n📍 <b>${place.name}</b>\n\n<br>\n\n<button onclick="openNavigation(${place.latitude},${place.longitude})">\n\n🚗 NAVIGATE\n\n</button>\n\n`);
}
});
}

function openNavigation(lat,lng){
console.log('openNavigation to:', lat, lng);
window.open("https://www.google.com/maps/dir/?api=1&destination="+lat+","+lng, "_blank");
}

window.openNavigation = openNavigation;
function distanceMeter(lat1,lng1,lat2,lng2){
const R = 6371000;
const dLat = (lat2-lat1) * Math.PI/180;
const dLng = (lng2-lng1) * Math.PI/180;
const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2) * Math.sin(dLng/2);
return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function checkSavedLocation(lat,lng){
for(let place of savedLocations){
let distance = distanceMeter(lat,lng,place.latitude,place.longitude);
if(distance <= place.radius){
return place.name;
}
}
return null;
}
function calculateVisits(){
let active = null;
points.forEach(point=>{
let place = checkSavedLocation(point.lat, point.lng);
if(place){
if(!active){
active = { name:place, start:point.timeMs, end:point.timeMs };
}else{
if(active.name === place){ active.end = point.timeMs; }else{ visitRecords.push(active); active={ name:place, start:point.timeMs, end:point.timeMs }; }
}
}else{
if(active){ visitRecords.push(active); active=null; }
}
});
if(active){ visitRecords.push(active); }
}
function renderVisits(){
let html="";
visitRecords.forEach(v=>{
let min = Math.round((v.end-v.start)/60000);
html += `\n\n<div class="card">\n\n📍 ${v.name}\n\n<br>\n\n🕒 ${new Date(v.start).toLocaleTimeString("ms-MY")} \n -\n\n${new Date(v.end).toLocaleTimeString("ms-MY")}\n\n<br>\n\n⏱️ Berhenti:\n${min} minit\n\n</div>\n`;
});
document.getElementById("summary").innerHTML += html;
}
async function start(){
console.log('route.start()');
await showSavedMarkers();
await loadRoute();
showPlaces();
}

start();
