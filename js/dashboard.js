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


let locationData={
lat:null,
lon:null,
place:""
};


let selfieData=null;

let slideOK=false;

let attendanceID=null;

let map=null;

let checkinMarker=null;

let checkoutMarker=null;

let driverMarker=null;

let watchID=null;

let lastLat=null;

let lastLon=null;



// ======================
// ELEMENT
// ======================

const statusText =
document.getElementById("status");

const locationBtn =
document.getElementById("btn-location");

const checkinBtn =
document.getElementById("btn-checkin");

const selfieBtn =
document.getElementById("btn-selfie");

const checkoutBtn =
document.getElementById("btn-checkout");

const selfieInput =
document.getElementById("selfieInput");




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
doc(db,"users",user.uid)
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



setTimeout(()=>{

initMap();

},500);



});




// ======================
// MAP
// ======================


function initMap(){


if(map)
return;


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
// LOCATION BUTTON
// ======================


if(locationBtn){


locationBtn.onclick =
async()=>{


try{


statusText.innerHTML=
"⏳ Ambil lokasi...";


await getLocation();



document.getElementById(
"stepLocationStatus"
).innerHTML="✔";



document.getElementById(
"stepLocationStatus"
).className="step-ok";



selfieBtn.disabled=false;



statusText.innerHTML=
"📍 Lokasi OK";


}

catch(e){


console.log(e);


alert(
"GPS gagal"
);


}


};


}




// ======================
// GET LOCATION
// ======================


async function getLocation(){


return new Promise(
(resolve,reject)=>{


navigator.geolocation.getCurrentPosition(

async(pos)=>{


locationData.lat =
pos.coords.latitude;


locationData.lon =
pos.coords.longitude;



locationData.place =
await getPlaceName(

locationData.lat,

locationData.lon

);



showCheckinMarker();



resolve();



},


reject,


{

enableHighAccuracy:true,

timeout:15000

}



);



});


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
// SHOW CHECK IN MARKER
// ======================


function showCheckinMarker(){


if(!map)
return;



if(checkinMarker){


checkinMarker.setLatLng(

[
locationData.lat,
locationData.lon
]

);


}

else{


checkinMarker =
L.marker(

[
locationData.lat,
locationData.lon
]

)
.addTo(map);


}



checkinMarker.bindPopup(
"📍 Check In"
);



map.setView(

[
locationData.lat,
locationData.lon
],

16

);



}




// ======================
// SELFIE
// ======================


if(selfieBtn){


selfieBtn.onclick=()=>{


selfieInput.click();


};


}




if(selfieInput){


selfieInput.onchange=()=>{


let file =
selfieInput.files[0];


if(!file)
return;



let reader =
new FileReader();



reader.onload=()=>{


selfieData = true;



document.getElementById(
"stepSelfieStatus"
).innerHTML="✔";



document.getElementById(
"stepSelfieStatus"
).className="step-ok";



statusText.innerHTML=
"📸 Selfie OK";



showSlide();


};



reader.readAsDataURL(file);



};


}




// ======================
// SHOW SLIDE
// ======================


function showSlide(){


if(
locationData.lat &&
selfieData
){


document.getElementById(
"slideConfirm"
).style.display="flex";


}



}
// ======================
// SLIDE CONFIRM
// ======================


const sliderKnob =
document.getElementById(
"sliderKnob"
);


const slideTrack =
document.getElementById(
"slideTrack"
);



if(
sliderKnob &&
slideTrack
){


function moveSlider(x){


let box =
slideTrack.getBoundingClientRect();



let max =
box.width -
sliderKnob.offsetWidth -
12;



let pos =
x -
box.left;



if(pos<0)
pos=0;


if(pos>max)
pos=max;



sliderKnob.style.left =
pos+"px";



if(pos>=max-3){


slideOK=true;


sliderKnob.style.left =
max+"px";


statusText.innerHTML =
"✅ Slide OK";


}


}




sliderKnob.addEventListener(
"touchmove",
(e)=>{


e.preventDefault();


moveSlider(
e.touches[0].clientX
);


},
{
passive:false
}
);



let drag=false;


sliderKnob.addEventListener(
"mousedown",
()=>{

drag=true;

}
);



document.addEventListener(
"mousemove",
(e)=>{


if(drag){

moveSlider(
e.clientX
);

}


}
);



document.addEventListener(
"mouseup",
()=>{

drag=false;

}
);



}



// ======================
// CHECK IN
// ======================


if(checkinBtn){


checkinBtn.onclick =
async()=>{


try{


if(!locationData.lat){


alert(
"Tekan LOCATION dahulu"
);


return;

}



if(!selfieData){


alert(
"Ambil selfie dahulu"
);


return;

}



if(!slideOK){


alert(
"Slide belum lengkap"
);


return;

}



checkinBtn.disabled=true;



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
locationData.lat,


longitude:
locationData.lon,


location:
locationData.place,




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


console.log(e);


alert(
"Check In gagal"
);


}


finally{


checkinBtn.disabled=false;


}



};


}



// ======================
// CHECK OUT
// ======================


if(checkoutBtn){


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
"Tiada Check In"
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


});



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
/
3600000;



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


attendanceID=null;



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


}




// ======================
// LIVE TRACKING
// ======================


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



if(lastLat){


let distance =
calculateDistance(
lastLat,
lastLon,
lat,
lon
);



if(distance<500)
return;



}



lastLat=lat;

lastLon=lon;



if(map){


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



}



if(attendanceID){


await addDoc(

collection(
db,
"tracking"
),

{

attendanceID,

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





function stopLiveTracking(){


if(watchID){


navigator.geolocation.clearWatch(
watchID
);


watchID=null;


}


}




// ======================
// DISTANCE
// ======================


function calculateDistance(
lat1,
lon1,
lat2,
lon2
){


let R=6371000;


let p1 =
lat1*Math.PI/180;


let p2 =
lat2*Math.PI/180;


let dp =
(lat2-lat1)*Math.PI/180;


let dl =
(lon2-lon1)*Math.PI/180;



let a =
Math.sin(dp/2)**2+
Math.cos(p1)*
Math.cos(p2)*
Math.sin(dl/2)**2;



return R*
2*
Math.atan2(
Math.sqrt(a),
Math.sqrt(1-a)
);


}
