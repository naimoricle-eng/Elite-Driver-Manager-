import { db } from "./firebase.js";
import {
collection,
addDoc,
serverTimestamp,
getDocs
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function checkSavedPlace(lat,lon){

const snap =
await getDocs(
collection(db,"savedPlaces")
);


let nearestPlace = null;
let nearestDistance = Infinity;


snap.forEach((doc)=>{

const data = doc.data();


const distance =
getDistance(
lat,
lon,
data.latitude,
data.longitude
);



if(
distance <= (data.radius || 100)
&& distance < nearestDistance
){

nearestDistance = distance;
nearestPlace = data.name;

}


});


return nearestPlace;

}

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

async function getPlaceName(lat, lon){

try{


const response = await fetch(

`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&namedetails=1`

);


const data = await response.json();


let place = "-";

let address = data.display_name || "-";



if(data.name){

place = data.name;

}
else if(data.address){

place =
data.address.building ||
data.address.shop ||
data.address.amenity ||
data.address.tourism ||
data.address.road ||
"-";

}



return {

place: place,

address: address

};



}catch(error){


console.log("Geocode error:",error);


return {

place:"-",

address:"-"

};


}

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


if(meter < 20){

return;

}


}


// simpan lokasi terakhir
lastLat = lat;
lastLon = lon;



const status =
localStorage.getItem("status") || "Driving";



const savedPlace =
await checkSavedPlace(lat,lon);


let locationData;


if(savedPlace){


locationData={

place:savedPlace,

address:savedPlace

};


}else{


locationData =
await getPlaceName(lat,lon);


}



await addDoc(

collection(
db,
"attendance",
attendanceID,
"tracking"
),

{

latitude:lat,

longitude:lon,

place:locationData.place,

address:locationData.address,

status:status,

time:serverTimestamp()

}

);



console.log(
"Tracking:",
lat,
lon
);


},


// ERROR CALLBACK

(error)=>{

console.log(
"GPS Error:",
error.message
);

},


// OPTIONS

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
