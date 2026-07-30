import { db } from "./firebase.js";

import {
collection,
addDoc,
serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let watchID = null;
let lastLat = null;
let lastLon = null;

function getDistance(lat1, lon1, lat2, lon2){

const R = 6371000;

const dLat = (lat2-lat1) * Math.PI/180;
const dLon = (lon2-lon1) * Math.PI/180;

const a =
Math.sin(dLat/2)**2 +
Math.cos(lat1*Math.PI/180) *
Math.cos(lat2*Math.PI/180) *
Math.sin(dLon/2)**2;

return R * 2 * Math.atan2(
Math.sqrt(a),
Math.sqrt(1-a)
);

}

export function startTracking(){

if(watchID!==null) return;

watchID = navigator.geolocation.watchPosition(

async(position)=>{

const attendanceID =
localStorage.getItem("attendanceID");

if(!attendanceID) return;

const lat = position.coords.latitude;
const lon = position.coords.longitude;

if(lastLat!==null){

const meter =
getDistance(
lastLat,
lastLon,
lat,
lon
);

if(meter<20){

return;

}

}

lastLat = lat;
lastLon = lon;

const status =
localStorage.getItem("status") || "Driving";

await addDoc(

collection(
db,
"attendance",
attendanceID,
"tracking"
),

{

latitude: lat,
longitude: lon,
status: status,
time: serverTimestamp()

}

);

console.log("Tracking:",lat,lon);

},

(error)=>{

console.log(error.message);

},

{

enableHighAccuracy:true,
maximumAge:5000,
timeout:10000

}

);

}

export function stopTracking(){

if(watchID!==null){

navigator.geolocation.clearWatch(watchID);

watchID=null;

lastLat=null;
lastLon=null;

}

}
