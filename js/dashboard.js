import { auth, db, storage } from "./firebase.js";

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
ref,
uploadString,
getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


import {
startTracking,
stopTracking
} from "./tracking.js";



// =====================
// GLOBAL
// =====================

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


let selfieBase64=null;

let map;
let marker;

let attendanceID=null;



// =====================
// MAP
// =====================


function initMap(){


map=L.map("map")
.setView(
[3.1390,101.6869],
13
);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{
attribution:"OpenStreetMap"
}

).addTo(map);


}



window.onload=()=>{

if(
document.getElementById("map")
){

initMap();

}

};




// =====================
// GPS
// =====================


async function getGPS(){


return new Promise((resolve,reject)=>{


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



resolve(locationData);



},


reject,


{
enableHighAccuracy:true
}

);


});


}




async function getPlaceName(lat,lon){


let res =
await fetch(

`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`

);


let data =
await res.json();


return data.display_name ||
"Unknown";


}
// =====================
// SELFIE CAMERA
// =====================


const video =
document.getElementById("selfieCamera");


const canvas =
document.getElementById("selfieCanvas");


const preview =
document.getElementById("selfiePreview");



const selfieBtn =
document.getElementById("openCameraBtn");



let cameraStream=null;



selfieBtn.onclick=async()=>{


try{


cameraStream =
await navigator.mediaDevices.getUserMedia({

video:{
facingMode:"user"
},

audio:false

});



video.srcObject =
cameraStream;



video.style.display="block";



document.getElementById(
"checkInStatus"
).innerHTML =
"📷 Kamera aktif";


}

catch(error){


console.log(error);


alert(
"Kamera tidak dibenarkan"
);


}


};




// =====================
// CAPTURE SELFIE
// =====================


video.onclick=()=>{


canvas.width =
video.videoWidth;


canvas.height =
video.videoHeight;



let ctx =
canvas.getContext("2d");



ctx.drawImage(

video,

0,

0,

canvas.width,

canvas.height

);





selfieBase64 =
compressCanvas(canvas);



preview.src =
selfieBase64;



preview.style.display="block";



document.getElementById(
"checkInStatus"
).innerHTML =
"✅ Selfie siap";


};




// =====================
// COMPRESS IMAGE
// =====================


function compressCanvas(canvas){


let maxWidth=600;


let width=canvas.width;

let height=canvas.height;



if(width>maxWidth){


height =
height *
(maxWidth/width);


width=maxWidth;


}



let newCanvas =
document.createElement(
"canvas"
);



newCanvas.width=width;

newCanvas.height=height;



let ctx =
newCanvas.getContext("2d");



ctx.drawImage(

canvas,

0,

0,

width,

height

);



return newCanvas.toDataURL(

"image/jpeg",

0.6

);


}
// =====================
// SLIDE CONFIRM
// =====================


const slider =
document.getElementById(
"confirmSlider"
);


const checkInBtn =
document.getElementById(
"checkInBtn"
);



let sliderOK=false;



slider.oninput=()=>{


if(slider.value>=95){


sliderOK=true;


document.getElementById(
"checkInStatus"
).innerHTML =
"✅ Confirm diterima";


checkReady();



}

};




// =====================
// CHECK READY
// =====================


function checkReady(){


if(

locationData.lat &&

selfieBase64 &&

sliderOK

){


checkInBtn.disabled=false;


}

}



// =====================
// UPLOAD SELFIE STORAGE
// =====================


async function uploadSelfie(){


if(!selfieBase64){

return null;

}



let fileName =
"selfie/" +
Date.now() +
".jpg";



let imageRef =
ref(
storage,
fileName
);



await uploadString(

imageRef,

selfieBase64,

"data_url"

);



let url =
await getDownloadURL(
imageRef
);



return url;


}
// =====================
// CHECK IN
// =====================


checkInBtn.onclick = async()=>{


if(
!user ||
!locationData.lat ||
!selfieBase64
){

alert(
"Lengkapkan lokasi dan selfie"
);

return;

}



checkInBtn.disabled=true;



document.getElementById(
"checkInStatus"
).innerHTML =
"⏳ Menyimpan...";



// upload selfie

let selfieURL =
await uploadSelfie();




// semak attendance aktif

let q =
query(

collection(
db,
"attendance"
),

where(
"uid",
"==",
user.uid
),

where(
"status",
"==",
"Working"
)

);



let snap =
await getDocs(q);



if(!snap.empty){


alert(
"Anda masih Check In"
);


return;

}




// simpan Firestore


let docRef =
await addDoc(

collection(
db,
"attendance"
),

{


uid:user.uid,


name:
driver.name,


email:
driver.email,


position:
driver.position,


role:
driver.role,


selfieURL:
selfieURL,


latitude:
locationData.lat,


longitude:
locationData.lon,


location:
locationData.place,


status:"Working",


trackingStatus:"Running",


checkIn:
serverTimestamp(),


createdAt:
serverTimestamp()


}

);




attendanceID =
docRef.id;



localStorage.setItem(

"attendanceID",

attendanceID

);
localStorage.setItem(
"checkInTime",
new Date()
);



localStorage.setItem(

"status",

"Working"

);



document.getElementById(
"checkInStatus"
).innerHTML =
"✅ Check In Berjaya";




// mula tracking

startTracking();



};




// =====================
// RESTORE SESSION
// =====================


async function restoreSession(){


let id =
localStorage.getItem(
"attendanceID"
);



if(!id)return;



let snap =
await getDoc(

doc(
db,
"attendance",
id
)

);



if(
snap.exists()
){

let data =
snap.data();



if(
data.status==="Working"
){


attendanceID=id;


startTracking();



document.getElementById(
"checkInStatus"
).innerHTML =
"🚗 Sedang bekerja";


}

}



}




// =====================
// LOAD USER
// =====================


onAuthStateChanged(

auth,

async(current)=>{


if(!current){

location.href="login.html";

return;

}



user=current;



let snap =
await getDoc(

doc(
db,
"users",
user.uid
)

);



if(
snap.exists()
){


let data =
snap.data();



driver.name =
data.name || "";


driver.email =
data.email || user.email;


driver.position =
data.position || "";


driver.role =
data.role || "driver";


}




restoreSession();



}

);
// =====================
// CHECK OUT
// =====================


const checkOutBtn =
document.getElementById(
"checkOutBtn"
);



checkOutBtn.onclick = async()=>{


if(!attendanceID){


attendanceID =
localStorage.getItem(
"attendanceID"
);


}



if(!attendanceID){


alert(
"Tiada Check In aktif"
);


return;


}



try{


document.getElementById(
"checkInStatus"
).innerHTML =
"⏳ Check Out...";



// ambil lokasi semasa

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




// ambil masa check in

let start =
localStorage.getItem(
"checkInTime"
);



if(!start){

start =
Date.now();

}



let totalHour =
(
Date.now()
-
new Date(start)
)
/
3600000;



let otHour=0;



if(totalHour>8){

otHour =
totalHour-8;

}



let otMoney =
otHour * 20;





await updateDoc(

doc(
db,
"attendance",
attendanceID
),

{


status:
"Completed",


trackingStatus:
"Stopped",


checkOut:
serverTimestamp(),


checkoutLatitude:
lat,


checkoutLongitude:
lon,


checkoutLocation:
place,


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




// stop tracking

stopTracking();




// clear session

localStorage.removeItem(
"attendanceID"
);



localStorage.removeItem(
"checkInTime"
);



attendanceID=null;




document.getElementById(
"checkInStatus"
).innerHTML =
"✅ Check Out Berjaya";



}

catch(error){


console.log(error);


alert(
"Gagal Check Out"
);


}


};
