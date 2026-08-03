import { auth, db } from "./firebase.js";

import {
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


import {
doc,
getDoc,
addDoc,
collection,
updateDoc,
serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


import {
startTracking,
stopTracking
} from "./tracking.js";



// ======================
// GLOBAL
// ======================

let user=null;

let driver={
name:"",
email:"",
position:"",
role:"driver"
};


let attendanceID=null;


let currentLocation={

lat:null,

lon:null,

place:""

};


let map;

let checkinMarker;

let checkoutMarker;

let driverMarker;



let selfieDone=false;





// ======================
// ELEMENT
// ======================


const checkinBtn =
document.getElementById(
"btn-checkin"
);


const checkoutBtn =
document.getElementById(
"btn-checkout"
);


const selfieInput =
document.getElementById(
"selfieInput"
);


const statusText =
document.getElementById(
"status"
);




// ======================
// LOGIN
// ======================


onAuthStateChanged(

auth,

async(currentUser)=>{


if(!currentUser){

location.href="login.html";

return;

}



user=currentUser;



let snap =
await getDoc(
doc(
db,
"users",
user.uid
)
);



if(snap.exists()){


let data=snap.data();


driver.name =
data.name || "";


driver.email =
data.email || user.email;


driver.position =
data.position || "";


driver.role =
data.role || "driver";


}



initMap();


loadActiveAttendance();



});






// ======================
// MAP
// ======================


function initMap(){


map =
L.map("map")
.setView(

[3.1390,101.6869],

13

);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{

maxZoom:19

}

)
.addTo(map);



}






// ======================
// CHECK IN BUTTON
// ======================


checkinBtn.onclick =
async()=>{


try{


checkinBtn.disabled=true;


statusText.innerHTML=
"⏳ Ambil lokasi...";



// GPS

await getLocation();





statusText.innerHTML=
"📸 Sila ambil selfie";




// buka kamera

selfieInput.click();




}



catch(e){


console.log(e);


alert(
"Lokasi gagal"
);


checkinBtn.disabled=false;


}



};






// ======================
// GET LOCATION
// ======================


async function getLocation(){


return new Promise(

(resolve,reject)=>{


navigator.geolocation.getCurrentPosition(

async(pos)=>{


currentLocation.lat =
pos.coords.latitude;


currentLocation.lon =
pos.coords.longitude;



currentLocation.place =
await getPlaceName(

currentLocation.lat,

currentLocation.lon

);




showMarker();



resolve();



},

reject,


{

enableHighAccuracy:true,

timeout:15000

}



);



}

);


}






// ======================
// ADDRESS
// ======================


async function getPlaceName(
lat,
lon
){


try{


let res =
await fetch(

`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`

);



let data =
await res.json();



return data.display_name || "Unknown";


}

catch{


return "Unknown";


}


}
// ======================
// CAMERA RESULT
// ======================


selfieInput.onchange = async()=>{


let file =
selfieInput.files[0];


if(!file){

statusText.innerHTML=
"Selfie diperlukan";

checkinBtn.disabled=false;

return;

}




// gambar hanya sebagai pengesahan
// tidak disimpan


selfieDone=true;



await saveCheckIn();



};






// ======================
// SAVE CHECK IN
// ======================


async function saveCheckIn(){


try{


statusText.innerHTML=
"⏳ Simpan Check In...";



let ref =
await addDoc(

collection(
db,
"attendance"
),

{


uid:user.uid,


name:driver.name,


email:driver.email,


position:driver.position,


role:driver.role,


latitude:
currentLocation.lat,


longitude:
currentLocation.lon,


location:
currentLocation.place,



selfieDone:true,


status:"Working",


driverStatus:"Driving",


trackingStatus:"Running",



checkIn:
serverTimestamp(),



createdAt:
serverTimestamp()



}

);



attendanceID =
ref.id;



localStorage.setItem(
"attendanceID",
attendanceID
);


localStorage.setItem(
"checkInTime",
Date.now()
);



statusText.innerHTML=
"✅ Check In Berjaya";



checkoutBtn.disabled=false;



startTracking(
attendanceID
);



startLiveTracking();



}


catch(e){


console.error(
"CHECK IN ERROR",
e
);


alert(
"Check In gagal: "+e.message
);



checkinBtn.disabled=false;


}



}






// ======================
// CHECK OUT
// ======================


checkoutBtn.onclick =
async()=>{


try{


let id =
attendanceID ||
localStorage.getItem(
"attendanceID"
);



if(!id){

alert(
"Tiada Check In aktif"
);

return;

}



statusText.innerHTML=
"⏳ Check Out...";



let pos =
await new Promise(

(resolve,reject)=>{


navigator.geolocation.getCurrentPosition(
resolve,
reject,
{
enableHighAccuracy:true
}
);


}

);




let lat =
pos.coords.latitude;


let lon =
pos.coords.longitude;



let place =
await getPlaceName(
lat,
lon
);




let start =
Number(
localStorage.getItem(
"checkInTime"
)
);



let totalHour =
(Date.now()-start)
/3600000;



let otHour=0;


if(totalHour>8){

otHour =
totalHour-8;

}



let otMoney =
otHour*20;





await updateDoc(

doc(
db,
"attendance",
id
),

{


status:"Completed",


trackingStatus:"Stopped",


checkOut:
serverTimestamp(),



checkoutLatitude:lat,


checkoutLongitude:lon,


checkoutLocation:place,


totalHour:
Number(
totalHour.toFixed(2)
),


otHour:
Number(
otHour.toFixed(2)
),


otMoney:
Number(
otMoney.toFixed(2)
)



}

);



stopTracking();

stopLiveTracking();



localStorage.clear();



statusText.innerHTML=
"✅ Check Out Berjaya";


checkoutBtn.disabled=true;



}

catch(e){


console.log(e);


alert(
"Check Out gagal"
);


}



};








// ======================
// LIVE TRACKING
// ======================


let watchID=null;



function startLiveTracking(){


if(watchID)
return;



watchID =
navigator.geolocation.watchPosition(

async(pos)=>{


let lat =
pos.coords.latitude;


let lon =
pos.coords.longitude;



if(driverMarker){


driverMarker.setLatLng(
[
lat,
lon
]
);


}

else{


driverMarker =
L.marker(
[
lat,
lon
]
)

.addTo(map)

.bindPopup(
"🚗 Driver"
);


}





if(attendanceID){


await addDoc(

collection(
db,
"tracking"
),

{


attendanceID:attendanceID,


latitude:lat,


longitude:lon,


createdAt:
serverTimestamp()



}

);



}



},


(error)=>{


console.log(
"Tracking error",
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





function stopLiveTracking(){


if(watchID){


navigator.geolocation.clearWatch(
watchID
);


watchID=null;


}


}







// ======================
// SHOW MARKER
// ======================


function showMarker(){


if(!map)
return;



if(checkinMarker){


checkinMarker.setLatLng(

[
currentLocation.lat,
currentLocation.lon
]

);


}

else{


checkinMarker =
L.marker(

[
currentLocation.lat,
currentLocation.lon
]

)
.addTo(map)
.bindPopup(
"📍 Check In"
);


}



map.setView(

[
currentLocation.lat,
currentLocation.lon
],

16

);


}







// ======================
// LOAD ACTIVE
// ======================


function loadActiveAttendance(){


let id =
localStorage.getItem(
"attendanceID"
);



if(id){


attendanceID=id;


checkoutBtn.disabled=false;


}


}
