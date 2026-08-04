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
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs
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

const mapBtn =
document.getElementById("btn-map");


const placesBtn =
document.getElementById("btn-places");

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
const driverStatus =
document.getElementById("driverStatus");

const wazeGoBtn =
document.getElementById("wazeGoBtn");


const searchBox =
document.getElementById("searchBox");


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
const greeting =
document.getElementById("greeting");

greeting.innerHTML =
"Welcome, " + driver.name;

greeting.style.display =
"block";


driver.email =
data.email || user.email;


driver.position =
data.position || "";


driver.role =
data.role || "driver";


}



initMap();

mapBtn.onclick = ()=>{

let choice = confirm(
"OK = Google Maps\nCancel = Waze"
);

let lat = 3.1390;
let lon = 101.6869;


if(choice){

// FORCE GOOGLE MAPS APP
window.location.href =
"intent://maps.google.com/?q="
+ lat + "," + lon
+ "#Intent;scheme=https;"
+ "package=com.google.android.apps.maps;"
+ "end";

}else{

window.location.href =
"waze://?ll=" + lat + "," + lon + "&navigate=yes";

}

};

wazeGoBtn.onclick = async()=>{

let address =
searchBox.value.trim();


if(!address){

alert("Sila taip tempat dahulu");
return;

}


try{

let res =
await fetch(
`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
);


let data =
await res.json();


if(data.length===0){

alert("Lokasi tidak dijumpai");
return;

}


let lat =
data[0].lat;


let lon =
data[0].lon;


window.location.href =
`waze://?ll=${lat},${lon}&navigate=yes`;


}

catch(e){

console.log(e);

alert("Gagal cari lokasi");

}

};

placesBtn.onclick = ()=>{

window.location.href =
"places.html";

};


loadActiveAttendance();
await loadAttendanceToday();



});

driverStatus.onchange = async()=>{

let id =
localStorage.getItem("attendanceID");


if(!id){
return;
}


await updateDoc(

doc(
db,
"attendance",
id
),

{
driverStatus:
driverStatus.value
}

);


statusText.innerHTML =
"Status : " + driverStatus.value;


// UPDATE CARD STATUS
const dashStatus =
document.getElementById("dashStatus");


if(dashStatus){

dashStatus.innerHTML =
driverStatus.value;

}


};


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
await loadAttendanceToday();






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
  const confirmCheckout = confirm(
"Anda pasti mahu Check Out?\n\nSelepas Check Out:\n• Tracking akan dihentikan\n• Waktu kerja akan dikira\n• Data akan disimpan"
);

if (!confirmCheckout) {
    return;
}


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




localStorage.removeItem("attendanceID");
localStorage.removeItem("checkInTime");



statusText.innerHTML=
"✅ Check Out Berjaya";


checkoutBtn.disabled=true;
await loadAttendanceToday();



}

catch(e){


console.log(e);


alert(
"Check Out gagal"
);


}



};









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
async function loadAttendanceToday() {

  if(!user) return;



const q = query(

collection(db,"attendance"),

where(
"uid",
"==",
user.uid
)

);


 let querySnap;

try{

querySnap = await getDocs(q);

console.log("USER:", user.uid);
console.log("DOC:", querySnap.docs);

}

catch(e){

console.log("ATTENDANCE ERROR:", e.message);

return;

}


  if(querySnap.empty){
    return;
  }


const docSnap =
querySnap.docs[querySnap.docs.length - 1];

  const data = docSnap.data();
  if(data.driverStatus){

  driverStatus.value =
  data.driverStatus;

}
document.getElementById("dashStatus").innerHTML =
data.driverStatus || "Standby";


document.getElementById("dashHour").innerHTML =
(data.totalHour ?? 0) + " jam";


document.getElementById("dashOT").innerHTML =
"RM " + (data.otMoney ?? 0);


  document.getElementById("date").innerHTML =
    "DATE : " +
    (
      data.createdAt?.toDate()
      .toLocaleDateString()
      || "-"
    );


  document.getElementById("checkinData").innerHTML =
    "CHECK IN : " +
    (
      data.checkIn?.toDate()
      .toLocaleTimeString()
      || "-"
    );


  document.getElementById("checkinLocation").innerHTML =
    "📍 CHECK IN LOCATION : " +
    (
      data.location
      || "-"
    );


  document.getElementById("checkoutData").innerHTML =
    "CHECK OUT : " +
    (
      data.checkOut?.toDate()
      .toLocaleTimeString()
      || "-"
    );


  document.getElementById("checkoutLocation").innerHTML =
    "📍 CHECK OUT LOCATION : " +
    (
      data.checkoutLocation
      || "-"
    );


  document.getElementById("totalData").innerHTML =
    "TOTAL WORKING : " +
    (
      data.totalHour ?? "-"
    )
    + " Jam";


  document.getElementById("otData").innerHTML =
    "OT : " +
    (
      data.otHour ?? "-"
    )
    + " Jam";


  document.getElementById("otMoney").innerHTML =
    "TOTAL OT : RM " +
    (
      data.otMoney ?? 0
    );


}
