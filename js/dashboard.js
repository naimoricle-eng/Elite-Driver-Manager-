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
updateDoc,
query,
where,
serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
startTracking,
stopTracking
} from "./tracking.js";


// ===============================
// GLOBAL
// ===============================

let currentUser = null;

let driverName = "";
let driverPosition = "";
let driverEmail = "";
let userRole = "driver";

let otRate = 20;

let currentLat = null;
let currentLon = null;
let currentPlace = "";

let selfieFile = null;

let map;
let marker;


// ===============================
// MAP INIT
// ===============================

function initMap(){

    map = L.map("map").setView(
        [3.1390,101.6869],
        13
    );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution:"OpenStreetMap"
        }
    ).addTo(map);

}


window.addEventListener(
"load",
()=>{

    if(document.getElementById("map")){

        initMap();

    }

});


// ===============================
// SEARCH PLACE
// ===============================

document.getElementById("searchBox").addEventListener(
"change",
async function(){

    let place = this.value;


    let response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${place}`
    );


    let data = await response.json();


    if(data.length){

        let lat = data[0].lat;
        let lon = data[0].lon;


        map.setView(
            [lat,lon],
            16
        );


        if(marker){

            map.removeLayer(marker);

        }


        marker = L.marker(
            [lat,lon]
        )
        .addTo(map)
        .bindPopup(place)
        .openPopup();


    }

});


// ===============================
// STATUS
// ===============================

function updateStatus(status){

    document.getElementById("status").innerHTML =
    status;


    document.getElementById("dashStatus").innerHTML =
    status;


    localStorage.setItem(
        "status",
        status
    );

}


// ===============================
// GET LOCATION NAME
// ===============================

async function getLocationName(lat,lon){

try{


let response = await fetch(
`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
);


let data = await response.json();


return data.display_name ||
"Lokasi tidak diketahui";


}catch(error){


return "Lokasi tidak diketahui";


}


}


// ===============================
// LOCATION BUTTON
// ===============================

document.getElementById("btn-location")
.onclick=function(){


if(!navigator.geolocation){

alert("GPS tidak disokong");

return;

}


navigator.geolocation.getCurrentPosition(

async(pos)=>{


currentLat =
pos.coords.latitude;


currentLon =
pos.coords.longitude;


currentPlace =
await getLocationName(
currentLat,
currentLon
);



alert(
"✅ Lokasi berjaya diperoleh"
);


document.getElementById(
"btn-selfie"
).disabled=false;



},


()=>{

alert(
"❌ Sila benarkan lokasi"
);

},


{

enableHighAccuracy:true,

timeout:10000,

maximumAge:0

}


);


};
// ===============================
// IMAGE COMPRESS
// ===============================

async function compressImage(file){

return new Promise((resolve)=>{


const img = new Image();

const reader = new FileReader();


reader.onload=(e)=>{

img.src=e.target.result;

};


img.onload=()=>{


const canvas=document.createElement("canvas");

const ctx=canvas.getContext("2d");


canvas.width=300;
canvas.height=300;


ctx.drawImage(
img,
0,
0,
300,
300
);


canvas.toBlob(

(blob)=>{

resolve(blob);

},

"image/jpeg",

0.6

);


};


reader.readAsDataURL(file);


});


}



async function convertToBase64(file){

return new Promise((resolve,reject)=>{


const reader=new FileReader();


reader.onload=()=>{

resolve(
reader.result
);

};


reader.onerror=reject;


reader.readAsDataURL(file);


});

}


// ===============================
// SELFIE
// ===============================

document.getElementById("selfieInput")
.addEventListener(
"change",
function(e){


if(e.target.files.length){

selfieFile =
e.target.files[0];


document.getElementById(
"stepSelfieStatus"
).innerHTML="✔";


document.getElementById(
"stepSelfieStatus"
).className="step-ok";


checkReady();


}


});


// ===============================
// CHECK IN BUTTON
// ===============================

document.getElementById("btn-checkin")
.onclick=function(){


if(!currentUser){

alert(
"Sistem belum siap"
);

return;

}


document.getElementById(
"selfieInput"
).click();


};



// ===============================
// READY CHECK
// ===============================

function checkReady(){


if(
currentLat &&
selfieFile
){


document.getElementById(
"slideConfirm"
).style.display="flex";


}


}



// ===============================
// SLIDE CONFIRM
// ===============================

document.getElementById(
"sliderKnob"
)
.addEventListener(
"click",
()=>{


checkInProcess();


});



// ===============================
// CHECK IN PROCESS
// ===============================

async function checkInProcess(){


if(!currentLat || !selfieFile){

alert(
"Sila lengkapkan lokasi dan selfie"
);

return;

}



const compressed =
await compressImage(
selfieFile
);



const selfie =
await convertToBase64(
compressed
);



const q=query(

collection(
db,
"attendance"
),

where(
"uid",
"==",
currentUser.uid
),

where(
"status",
"==",
"Working"
)

);



const snap =
await getDocs(q);



if(!snap.empty){


alert(
"❌ Masih ada Check Out belum dibuat"
);


return;


}



const ref =
await addDoc(

collection(
db,
"attendance"
),

{


uid:
currentUser.uid,


name:
driverName,


position:
driverPosition,


email:
driverEmail,


role:
userRole,


selfie:selfie,


latitude:
currentLat,


longitude:
currentLon,


location:
currentPlace,


status:
"Working",


trackingStatus:
"Running",


checkIn:
serverTimestamp(),


createdAt:
serverTimestamp()


}


);



localStorage.setItem(
"attendanceID",
ref.id
);



localStorage.setItem(
"checkIn",
new Date()
);



localStorage.setItem(
"checkinPlace",
currentPlace
);



updateStatus(
"Driving"
);



document.getElementById(
"checkinData"
).innerHTML=

"CHECK IN : "+
new Date()
.toLocaleTimeString();



document.getElementById(
"checkinLocation"
).innerHTML=

"📍 CHECK IN LOCATION : "+
currentPlace;



document.getElementById(
"btn-checkin"
).disabled=true;



document.getElementById(
"btn-checkout"
).disabled=false;



document.getElementById(
"slideConfirm"
).style.display="none";



await saveTracking(
currentLat,
currentLon,
"MULA"
);



startTracking();



alert(
"✅ Check In Berjaya"
);



}



// ===============================
// SAVE TRACKING
// ===============================

async function saveTracking(
lat,
lon,
status
){


let id =
localStorage.getItem(
"attendanceID"
);



if(!id)return;



await addDoc(

collection(
db,
"attendance",
id,
"tracking"
),

{


latitude:lat,


longitude:lon,


place:
await getLocationName(
lat,
lon
),


status:status,


time:
serverTimestamp()


}


);


}
// ===============================
// CHECK OUT
// ===============================

document.getElementById("btn-checkout")
.onclick=function(){


navigator.geolocation.getCurrentPosition(

async(pos)=>{


let lat =
pos.coords.latitude;


let lon =
pos.coords.longitude;


let place =
await getLocationName(
lat,
lon
);



let id =
localStorage.getItem(
"attendanceID"
);



if(!id){

alert(
"Tiada Check In"
);

return;

}



let checkIn =
new Date(
localStorage.getItem("checkIn")
);



let checkOut =
new Date();



let totalHour =
(checkOut-checkIn)/3600000;



let otHour=0;


if(totalHour>8){

otHour =
totalHour-8;

}



let otMoney =
otHour * otRate;



await updateDoc(

doc(
db,
"attendance",
id
),

{


status:
"Completed",


trackingStatus:
"Stopped",


checkOut:
checkOut,


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



localStorage.setItem(
"checkOut",
checkOut
);



localStorage.setItem(
"checkoutPlace",
place
);



localStorage.removeItem(
"attendanceID"
);



stopTracking();



updateStatus(
"Standby"
);



document.getElementById(
"checkoutData"
).innerHTML=

"CHECK OUT : "+
checkOut.toLocaleTimeString();



document.getElementById(
"checkoutLocation"
).innerHTML=

"📍 CHECK OUT LOCATION : "+
place;



document.getElementById(
"btn-checkin"
).disabled=false;



document.getElementById(
"btn-checkout"
).disabled=true;



alert(
"✅ Check Out Berjaya"
);



},

()=>{


alert(
"❌ Tidak dapat ambil lokasi"
);


},

{

enableHighAccuracy:true,

timeout:10000

}


);


};



// ===============================
// LOAD USER FIREBASE
// ===============================

onAuthStateChanged(
auth,
async(user)=>{


if(!user){

location.href="login.html";

return;

}



currentUser=user;



let snap =
await getDoc(

doc(
db,
"users",
user.uid
)

);



if(snap.exists()){


let data =
snap.data();



driverName =
data.name || "";


driverPosition =
data.position || "";


driverEmail =
data.email || "";


userRole =
data.role || "driver";


otRate =
data.otRate || 20;



restoreStatus();


}



});




// ===============================
// RESTORE STATUS
// ===============================

async function restoreStatus(){


let q=query(

collection(
db,
"attendance"
),

where(
"uid",
"==",
currentUser.uid
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


let item =
snap.docs[0];



localStorage.setItem(
"attendanceID",
item.id
);



updateStatus(
"Driving"
);



document.getElementById(
"btn-checkin"
).disabled=true;



document.getElementById(
"btn-checkout"
).disabled=false;



startTracking();



}else{


updateStatus(
"Standby"
);


stopTracking();


}



startTimer();


}



// ===============================
// WORK TIMER + OT
// ===============================

function startTimer(){


setInterval(()=>{


let checkIn =
localStorage.getItem(
"checkIn"
);



if(!checkIn)return;



let total =
(new Date()-new Date(checkIn))
/3600000;



let ot=0;



if(total>8){

ot=total-8;

}



let money =
ot*otRate;



document.getElementById(
"dashHour"
).innerHTML=

total.toFixed(2)+
" jam";



document.getElementById(
"dashOT"
).innerHTML=

"RM "+
money.toFixed(2);



document.getElementById(
"totalData"
).innerHTML=

"TOTAL WORKING : "+
total.toFixed(2)+
" jam";



document.getElementById(
"otData"
).innerHTML=

"OT : "+
ot.toFixed(2)+
" jam";



document.getElementById(
"otMoney"
).innerHTML=

"TOTAL OT : RM "+
money.toFixed(2);



},60000);


}



// ===============================
// DRIVER STATUS
// ===============================

document.getElementById(
"driverStatus"
)
.onchange=async function(){


let status =
this.value;



updateStatus(
status
);



let id =
localStorage.getItem(
"attendanceID"
);



if(id){

await updateDoc(

doc(
db,
"attendance",
id
),

{

currentStatus:
status

}

);

}


};



// ===============================
// GOOGLE MAP BUTTON
// ===============================

document.getElementById(
"btn-map"
)
.onclick=function(){


window.open(
"https://maps.google.com",
"_blank"
);


};



// ===============================
// PLACES BUTTON
// ===============================

document.getElementById(
"btn-places"
)
.onclick=function(){


window.open(
"https://maps.google.com",
"_blank"
);


};
