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
 query,
 where,
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

let user = null;

let driver = {
    name:"",
    email:"",
    position:"",
    role:"driver"
};


let locationData = {
    latitude:null,
    longitude:null,
    place:""
};


let selfieData = null;

let attendanceID = null;
let currentStatus = "Standby";
let driverMarker = null;
let watchID = null;
let lastTrackLat = null;
let lastTrackLon = null;

let map;
let checkinMarker;
let checkoutMarker;
// ======================
// SHOW ATTENDANCE MARKER
// ======================


function showMarker(
lat,
lon,
text,
type
){


if(!map)return;



let marker =
L.marker(
[lat,lon]
)
.addTo(map);



marker.bindPopup(
text
);



if(type==="checkin"){

checkinMarker=marker;

}


if(type==="checkout"){

checkoutMarker=marker;

}


}



// ======================
// LOAD MAP ATTENDANCE
// ======================

function loadAttendanceMap(
data
){



if(
data.latitude &&
data.longitude
){


showMarker(

data.latitude,

data.longitude,

"📍 Check In<br>"+data.location,

"checkin"

);


}



if(
data.checkoutLatitude &&
data.checkoutLongitude
){


showMarker(

data.checkoutLatitude,

data.checkoutLongitude,

"🛑 Check Out<br>"+data.checkoutLocation,

"checkout"

);


}



}


// ======================
// ELEMENT
// ======================

const statusText =
document.getElementById("status");

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


driver.name=data.name || "";

driver.email=data.email || user.email;

driver.position=data.position || "";

driver.role=data.role || "driver";
loadTodayAttendance();

}


console.log(driver);


});



// ======================
// GPS
// ======================

async function getLocation(){


return new Promise(
(resolve,reject)=>{


navigator.geolocation.getCurrentPosition(

async(pos)=>{


locationData.latitude =
pos.coords.latitude;


locationData.longitude =
pos.coords.longitude;


locationData.place =
await getPlaceName(
locationData.latitude,
locationData.longitude
);



resolve(locationData);


},


reject,


{
 enableHighAccuracy:true
}


);


});


}



// ======================
// ADDRESS
// ======================

async function getPlaceName(lat,lon){


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



// ======================
// CHECK IN BUTTON
// ======================

// Consolidated check-in handler: ensures a single flow, consistent payload and error handling
async function performCheckin(){
  if(!checkinBtn) return;
  if(checkinBtn.disabled) return; // prevent double submit
  checkinBtn.disabled = true;
  try{
    // STEP 1: ensure GPS
    if(!locationData.latitude){
      statusText.innerHTML = "⏳ Ambil lokasi...";
      await getLocation();
      statusText.innerHTML = "📍 Lokasi OK";
      selfieBtn.disabled = false;
      // User needs to confirm selfie/slide after getting location
      return;
    }

    // STEP 2: ensure selfie and slide
    if(!selfieData || !slideOK){
      alert("Lengkapkan selfie dan slide");
      return;
    }

    // STEP 3: persist attendance
    statusText.innerHTML = "⏳ Simpan...";

    const payload = {
      uid: user?.uid || null,
      name: driver.name || "",
      email: driver.email || "",
      position: driver.position || "",
      role: driver.role || "driver",
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      location: locationData.place || "",
      selfie: selfieData,
      status: "Working",
      driverStatus: "Driving",
      trackingStatus: "Running",
      checkIn: serverTimestamp(),
      createdAt: serverTimestamp()
    };

    const ref = await addDoc(collection(db, "attendance"), payload);
    attendanceID = ref.id;

    // persist locally
    localStorage.setItem("attendanceID", attendanceID);
    localStorage.setItem("checkInTime", Date.now());

    statusText.innerHTML = "✅ Check In Berjaya";

    startTracking(attendanceID);
    startLiveTracking();
    checkoutBtn.disabled = false;

  } catch (err) {
    console.error("Check-in error:", err);
    // don't show raw error.message to users; show friendly message
    alert("Gagal Check In. Sila cuba lagi.");
  } finally {
    // re-enable button so user can retry if needed
    checkinBtn.disabled = false;
  }
}

if(checkinBtn){
  checkinBtn.onclick = performCheckin;
}

// ======================
// SELFIE
// ======================

const stepSelfieStatus =
document.getElementById(
"stepSelfieStatus"
);


const stepLocationStatus =
document.getElementById(
"stepLocationStatus"
);


const slideConfirm =
document.getElementById(
"slideConfirm"
);


const sliderKnob =
document.getElementById(
"sliderKnob"
);


const slideTrack =
document.getElementById(
"slideTrack"
);


let slideOK = false;



// ======================
// SELFIE BUTTON
// ======================

selfieBtn.onclick = ()=>{

  selfieInput.click();

};



// ======================
// GET SELFIE
// ======================

selfieInput.onchange = ()=>{


let file =
selfieInput.files[0];


if(!file)return;



let reader =
new FileReader();



reader.onload = ()=>{


selfieData =
reader.result;



stepSelfieStatus.innerHTML =
"✔";


stepSelfieStatus.className =
"step-ok";



statusText.innerHTML =
"📸 Selfie OK";



showSlide();


};



reader.readAsDataURL(file);



};



// ======================
// SHOW SLIDE
// ======================

function showSlide(){


if(
locationData.latitude &&
selfieData
){


stepLocationStatus.innerHTML =
"✔";


stepLocationStatus.className =
"step-ok";



slideConfirm.style.display =
"flex";


}


}



// ======================
// SLIDE FUNCTION
// ======================


if(sliderKnob){


let moving=false;



function moveSlider(x){

let box =
slideTrack.getBoundingClientRect();

let max =
box.width - 45;

let pos =
x - box.left;

if(pos<5)
pos=5;

if(pos>max)
pos=max;

sliderKnob.style.left =
pos+"px";

if(pos>=max-5){

slideOK=true;

statusText.innerHTML =
"✅ Slide OK";

}

}



sliderKnob.addEventListener(
"touchmove",
(e)=>{

moveSlider(
e.touches[0].clientX
);

}
);



sliderKnob.addEventListener(
"mousemove",
(e)=>{

if(e.buttons){

moveSlider(
e.clientX
);

}

}
);


}



// ======================
// SAVE CHECK IN
// (handled by performCheckin)
// ======================


// ======================
// CHECK OUT SYSTEM
// ======================


checkoutBtn.onclick =
async()=>{


try{


let savedID =
attendanceID ||
localStorage.getItem(
"attendanceID"
);



if(!savedID){


alert(
"Tiada Check In aktif"
);


return;


}


statusText.innerHTML =
"⏳ Ambil lokasi Check Out...";



// GPS semasa checkout

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


// kira waktu

let startTime =
Number(
localStorage.getItem(
"checkInTime"
)
);

let totalHour =
(
Date.now()
 -
startTime
)
/
3600000;

let otHour = 0;

if(totalHour > 8){
 otHour = totalHour - 8;
}

let otMoney =
otHour * 20;

// update Firestore
await updateDoc(
 doc(
 db,
 "attendance",
 savedID
 ),
 {
 status:"Completed",
 trackingStatus:"Stopped",
 checkOut: serverTimestamp(),
 checkoutLatitude: lat,
 checkoutLongitude: lon,
 checkoutLocation: place,
 totalHour: Number(totalHour.toFixed(2)),
 otHour: Number(otHour.toFixed(2)),
 otMoney: Number(otMoney.toFixed(2))
 }
);

// stop tracking
stopTracking();
stopLiveTracking();

// clear data
localStorage.removeItem(
 "attendanceID"
);
localStorage.removeItem(
 "checkInTime"
);
attendanceID=null;

statusText.innerHTML =
"✅ Check Out Berjaya";

checkoutBtn.disabled=true;
checkinBtn.disabled=false;


}

catch(error){
 console.log(error);
 alert(
 "Gagal Check Out"
 );
}

};
// ======================
// LOAD TODAY ATTENDANCE
// ======================


async function loadTodayAttendance(){


if(!user)return;


let q =
query(
 collection(db,"attendance"),
 where(
 "uid",
 "==",
 user.uid
 )
);

let snap =
await getDocs(q);

if(snap.empty){
 return;
}

let latest=null;

snap.forEach((doc)=>{
 latest={
 id:doc.id,
 ...doc.data()
 };
});

if(!latest)return;

// CHECK IN
if(latest.checkIn){
 document.getElementById(
 "checkinData"
 ).innerHTML =
 "CHECK IN : ✔";
}

document.getElementById(
 "checkinLocation"
 ).innerHTML =
 "📍 CHECK IN LOCATION : " +
 (latest.location || "-");

loadAttendanceMap(latest);

// CHECK OUT
if(latest.checkOut){
 document.getElementById(
 "checkoutData"
 ).innerHTML =
 "CHECK OUT : ✔";
}

document.getElementById(
 "checkoutLocation"
 ).innerHTML =
 "📍 CHECK OUT LOCATION : " +
 (latest.checkoutLocation || "-");

// WORK HOUR
if(latest.totalHour){
 document.getElementById(
 "totalData"
 ).innerHTML =
 "TOTAL WORKING : " +
 latest.totalHour +
 " jam";

 document.getElementById(
 "dashHour"
 ).innerHTML =
 latest.totalHour +
 " jam";
}

// OT
if(latest.otHour){
 document.getElementById(
 "otData"
 ).innerHTML =
 "OT : " +
 latest.otHour +
 " jam";

 document.getElementById(
 "otMoney"
 ).innerHTML =
 "TOTAL OT : RM " +
 latest.otMoney;

 document.getElementById(
 "dashOT"
 ).innerHTML =
 "RM " +
 latest.otMoney;
}

if(latest.driverStatus){
 document.getElementById(
 "dashStatus"
 ).innerHTML =
 latest.driverStatus;
}

document.getElementById(
 "driverStatus"
 ).value =
 latest.driverStatus;

}
// ======================
// OPEN GOOGLE MAP
// ======================


const openCheckinMap =
document.getElementById(
 "openCheckinMap"
);

const openCheckoutMap =
document.getElementById(
 "openCheckoutMap"
);

if(openCheckinMap){
 openCheckinMap.onclick=()=>{
 if(checkinMarker){
 let pos =
 checkinMarker.getLatLng();
 window.open(
 `https://www.google.com/maps?q=${pos.lat},${pos.lng}`,
 "_blank"
 );
 }
 };
}

if(openCheckoutMap){
 openCheckoutMap.onclick=()=>{
 if(checkoutMarker){
 let pos =
 checkoutMarker.getLatLng();
 window.open(
 `https://www.google.com/maps?q=${pos.lat},${pos.lng}`,
 "_blank"
 );
 }
 };
}
// ======================
// LIVE DRIVER TRACKING
// ======================

function startLiveTracking(){

 if(watchID !== null)return;

 watchID =
 navigator.geolocation.watchPosition(
 async(pos)=>{
 let lat =
 pos.coords.latitude;
 let lon =
 pos.coords.longitude;

 // kira jarak
 if(lastTrackLat !== null){
 let distance =
 calculateDistance(
 lastTrackLat,
 lastTrackLon,
 lat,
 lon
 );
 if(distance < 500){
 return;
 }
 }

 lastTrackLat = lat;
 lastTrackLon = lon;

 // UPDATE MARKER MAP
 if(map){
 if(driverMarker){
 driverMarker.setLatLng(
 [lat,lon]
 );
 }
 else{
 driverMarker =
 L.marker(
 [lat,lon],
 {
 title:"Driver"
 }
 )
 .addTo(map)
 .bindPopup(
 "🚗 Current Location"
 );
 }
 map.setView(
 [lat,lon],
 15
 );
 }

 // SIMPAN TRACKING FIRESTORE
 if(attendanceID){
 await addDoc(
 collection(db,"tracking"),
 {
 attendanceID:attendanceID,
 latitude:lat,
 longitude:lon,
 createdAt: serverTimestamp()
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

// ======================
// STOP LIVE TRACKING
// ======================

function stopLiveTracking(){
 if(watchID !== null){
 navigator.geolocation.clearWatch(
 watchID
 );
 watchID=null;
 }
 driverMarker=null;
 lastTrackLat=null;
 lastTrackLon=null;
}
// ======================
// DRIVER STATUS
// ======================

const driverStatus =
document.getElementById(
 "driverStatus"
 );

if(driverStatus){
 driverStatus.onchange =
 async()=>{
 currentStatus =
 driverStatus.value;
 document.getElementById(
 "dashStatus"
 ).innerHTML =
 currentStatus;
 statusText.innerHTML =
 "Status : " +
 currentStatus;
 let id =
 attendanceID ||
 localStorage.getItem(
 "attendanceID"
 );
 if(!id)return;
 await updateDoc(
 doc(
 db,
 "attendance",
 id
 ),
 {
 driverStatus:
 currentStatus,
 statusUpdated:
 serverTimestamp()
 }
 );
 console.log(
 "Status updated:",
 currentStatus
 );
 };
}
