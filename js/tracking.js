// ======================
// TRACKING SYSTEM
// ======================


import {
db
} from "./firebase.js";


import {
collection,
addDoc,
serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";



let watchID = null;

let lastLat = null;
let lastLon = null;



// ======================
// DISTANCE CALCULATOR
// ======================

function distance(
lat1,
lon1,
lat2,
lon2
){


const R = 6371000;


const dLat =
(lat2-lat1)
*
Math.PI/180;


const dLon =
(lon2-lon1)
*
Math.PI/180;



const a =
Math.sin(dLat/2)
*
Math.sin(dLat/2)

+

Math.cos(lat1*Math.PI/180)
*
Math.cos(lat2*Math.PI/180)
*
Math.sin(dLon/2)
*
Math.sin(dLon/2);



const c =
2 *
Math.atan2(
Math.sqrt(a),
Math.sqrt(1-a)
);



return R*c;


}



// ======================
// START TRACKING
// ======================


export function startTracking(
attendanceID
){



if(watchID!==null)
return;



watchID =
navigator.geolocation.watchPosition(

async(position)=>{


let lat =
position.coords.latitude;


let lon =
position.coords.longitude;



if(lastLat!==null){


let move =
distance(
lastLat,
lastLon,
lat,
lon
);



if(move < 500){

return;

}


}



lastLat=lat;
lastLon=lon;



let place =
await getPlaceName(
lat,
lon
);



await addDoc(

collection(
db,
"attendance",
attendanceID,
"tracking"
),

{



attendanceID,


latitude:

lat,


longitude:

lon,


location:

place,


createdAt:

serverTimestamp()


}


);



console.log(
"Tracking saved",
place
);



},


(error)=>{


console.log(
"GPS error",
error
);


},


{


enableHighAccuracy:true,


maximumAge:0,


timeout:10000


}


);



}



// ======================
// STOP TRACKING
// ======================


export function stopTracking(){


if(watchID!==null){


navigator.geolocation.clearWatch(
watchID
);


watchID=null;


}



lastLat=null;
lastLon=null;



console.log(
"Tracking stopped"
);


}



// ======================
// REVERSE LOCATION
// ======================


async function getPlaceName(
lat,
lon
){


try{


let res =
await fetch(

`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`

);



let data =
await res.json();



return data.display_name || "Unknown";


}

catch{


return "Unknown";


}


}
