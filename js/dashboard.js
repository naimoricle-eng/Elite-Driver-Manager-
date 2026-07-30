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
// GLOBAL VARIABLE
// ===============================

let currentUser = null;

let driverName = "";
let driverPosition = "";
let driverEmail = "";
let userRole = "driver";

let otRate = 20;

let selfieFile = null;

let userReady = false;

let currentStatus = "Driving";
// ===============================
// LOAD USER
// ===============================

onAuthStateChanged(auth, async(user)=>{

if(!user){

location.href="login.html";

return;

}

currentUser = user;

const snap = await getDoc(
doc(db,"users",user.uid)
);

if(snap.exists()){

const data = snap.data();

driverName = data.name || "";
driverPosition = data.position || "";
driverEmail = data.email || "";
userRole = data.role || "driver";
otRate = data.otRate || 20;

userReady = true;
await loadAttendanceStatus();

}

});

// ===============================
// PART 4A
// UPDATE STATUS UI
// ===============================

function updateStatus(status){

    document.getElementById("status").innerHTML = status;

    document.getElementById("dashStatus").innerHTML = status;

    localStorage.setItem("status", status);

}

    

// ===============================
// GET LOCATION NAME
// ===============================

async function getLocationName(lat, lon){

try{

const response = await fetch(
`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
);

const data = await response.json();

return data.display_name || "Lokasi tidak diketahui";

}catch(error){

return "Lokasi tidak diketahui";

}

}

// ===============================
// CONVERT BASE64
// ===============================

async function convertToBase64(file){

return new Promise((resolve,reject)=>{

const reader = new FileReader();

reader.readAsDataURL(file);

reader.onload=()=>resolve(reader.result);

reader.onerror=(error)=>reject(error);

});

}

// ===============================
// COMPRESS IMAGE
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

ctx.drawImage(img,0,0,300,300);

canvas.toBlob((blob)=>{

resolve(blob);

},"image/jpeg",0.6);

};

reader.readAsDataURL(file);

});

}
// ===============================
// SAVE FIRST TRACK
// ===============================

async function saveTracking(lat,lon,status){

const attendanceID=localStorage.getItem("attendanceID");

if(!attendanceID) return;

const place=await getLocationName(lat,lon);

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
place:place,
status:status,
time:serverTimestamp()

}

);

}
// ===============================
// CHECK IN
// PART 2C-1
// ===============================

document.getElementById("btn-checkin").onclick = function(){

    if(!userReady){

        alert("Sila tunggu sistem siap loading.");

        return;

    }

    // Reset selfie lama
    selfieFile = null;

    const input = document.getElementById("selfieInput");

    input.value = "";

    // Buka kamera
    input.click();

};

// ===============================
// CHECK IN
// PART 2C-2
// SELFIE DIAMBIL
// ===============================

document.getElementById("selfieInput").addEventListener("change", async function(e){

    if(e.target.files.length === 0){

        alert("Sila ambil selfie dahulu.");

        return;

    }

    selfieFile = e.target.files[0];

    if(!navigator.geolocation){

        alert("Browser tidak menyokong GPS.");

        return;

    }

   navigator.geolocation.getCurrentPosition(

async function(pos){

    const lat = pos.coords.latitude;

    const lon = pos.coords.longitude;

    const place = await getLocationName(lat, lon);

    const today = new Date().toLocaleDateString();

    const q = query(
        collection(db,"attendance"),
        where("uid","==",currentUser.uid),
        where("status","==","Working")
    );

    const snap = await getDocs(q);

    let active = false;

    snap.forEach((doc)=>{

        const data = doc.data();

        if(data.checkIn){

            const date =
            data.checkIn.toDate().toLocaleDateString();

            if(date === today){

                active = true;

            }

        }

    });

    if(active){

        alert("❌ Anda masih belum Check Out.");

        return;

    }

    // ===============================
// PART 2C-4
// COMPRESS SELFIE
// ===============================

const compressed = await compressImage(selfieFile);

const selfieBase64 = await convertToBase64(compressed);

// ===============================
// PART 2C-5
// SIMPAN CHECK IN FIRESTORE
// ===============================

const ref = await addDoc(
    collection(db, "attendance"),
    {

        uid: currentUser.uid,

        name: driverName,

        position: driverPosition,

        email: driverEmail,

        role: userRole,

        selfie: selfieBase64,

        latitude: lat,

        longitude: lon,

        location: place,

        status: "Working",

        trackingStatus: "Running",

        checkIn: serverTimestamp(),

        createdAt: serverTimestamp()

    }
);

// Simpan ID Attendance
localStorage.setItem(
    "attendanceID",
    ref.id
);

// ===============================
// PART 2C-6
// SIMPAN LOCAL & UPDATE UI
// ===============================

const now = new Date();

localStorage.setItem("checkIn", now);
localStorage.setItem("status", "Driving");

localStorage.setItem("checkinLat", lat);
localStorage.setItem("checkinLon", lon);
localStorage.setItem("checkinPlace", place);

const mapLink =
"https://www.google.com/maps?q=" + lat + "," + lon;

localStorage.setItem("checkinMap", mapLink);

// Update Status
updateStatus("Driving");

document.getElementById("checkinData").innerHTML =
"CHECK IN : " + now.toLocaleTimeString();

document.getElementById("checkinLocation").innerHTML =
"📍 CHECK IN LOCATION : " + place;

// Button Map
document.getElementById("openCheckinMap").style.display = "block";

document.getElementById("openCheckinMap").onclick = function(){

    window.open(mapLink, "_blank");

};

// Enable / Disable Button
document.getElementById("btn-checkin").disabled = true;
document.getElementById("btn-checkout").disabled = false;

// Mula Tracking
await saveTracking(lat, lon, "MULA");

if(localStorage.getItem("attendanceID")){

    startTracking();

}

alert("✅ Check In Berjaya");

},
function(error){

    alert("❌ Sila hidupkan GPS dan benarkan akses lokasi.");

},
{

    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0

}

);

});


// ===============================
// CHECK OUT
// PART 2D-1
// ===============================

document.getElementById("btn-checkout").onclick = function(){

    if(!navigator.geolocation){

        alert("Browser tidak menyokong GPS.");

        return;

    }

    navigator.geolocation.getCurrentPosition(

    async function(pos){

        const lat = pos.coords.latitude;

        const lon = pos.coords.longitude;

        const place = await getLocationName(lat, lon);

        const id = localStorage.getItem("attendanceID");

        if(!id){

            alert("Tiada rekod Check In.");

            return;

        }

      // ===============================
// PART 2D-2
// KIRA MASA KERJA & OT
// ===============================

const checkInTime = new Date(
    localStorage.getItem("checkIn")
);

const checkOutTime = new Date();

const totalHour =
(checkOutTime - checkInTime) / 3600000;

let otHour = 0;

if(totalHour > 8){

    otHour = totalHour - 8;

}

const otMoney = otHour * otRate;

// ===============================
// PART 2D-3
// SIMPAN CHECK OUT
// ===============================

await updateDoc(
    doc(db,"attendance",id),
    {

        status: "Completed",

        trackingStatus: "Stopped",

        checkOut: checkOutTime,

        checkoutLocation: place,

        totalHour: Number(totalHour.toFixed(2)),

        otHour: Number(otHour.toFixed(2)),

        otMoney: Number(otMoney.toFixed(2))

    }
);

// Simpan LocalStorage
localStorage.setItem("checkOut", checkOutTime);
localStorage.setItem("status", "Standby");

localStorage.setItem("checkoutLat", lat);
localStorage.setItem("checkoutLon", lon);
localStorage.setItem("checkoutPlace", place);

const mapLink =
"https://www.google.com/maps?q=" + lat + "," + lon;

localStorage.setItem("checkoutMap", mapLink);

// Stop Tracking
stopTracking();

// Buang Attendance ID
localStorage.removeItem("attendanceID");

// Update UI
updateStatus("Standby");

document.getElementById("checkoutData").innerHTML =
"CHECK OUT : " + checkOutTime.toLocaleTimeString();

document.getElementById("checkoutLocation").innerHTML =
"📍 CHECK OUT LOCATION : " + place;

document.getElementById("btn-checkin").disabled = false;
document.getElementById("btn-checkout").disabled = true;

alert("✅ Check Out Berjaya");

},
function(error){

    alert("❌ Tidak dapat mengambil lokasi Check Out.");

},
{

    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0

}

);

};

// ===============================
// PART 2E
// AUTO RESTORE STATUS
// ==============================
// ===============================
// AUTO RESTORE STATUS
// ===============================

async function loadAttendanceStatus(){

    if(!currentUser) return;

    const q = query(
        collection(db,"attendance"),
        where("uid","==",currentUser.uid),
        where("status","==","Working")
    );

    const snap = await getDocs(q);

    if(!snap.empty){

        const attendanceDoc = snap.docs[0];

        localStorage.setItem(
            "attendanceID",
            attendanceDoc.id
        );

        updateStatus("Driving");

        document.getElementById("btn-checkin").disabled = true;
        document.getElementById("btn-checkout").disabled = false;

        startTracking();

    }else{

        localStorage.removeItem("attendanceID");

        updateStatus("Standby");

        document.getElementById("btn-checkin").disabled = false;
        document.getElementById("btn-checkout").disabled = true;

        stopTracking();

    }

}
// ===============================
// PART 4B
// LIVE WORKING HOUR
// ===============================

function startWorkingTimer(){

    setInterval(function(){

        const status = localStorage.getItem("status");

        if(status !== "Driving") return;

        const checkIn = localStorage.getItem("checkIn");

        if(!checkIn) return;

        const totalHour =
        (new Date() - new Date(checkIn)) / 3600000;

        let otHour = 0;

        if(totalHour > 8){

            otHour = totalHour - 8;

        }

        const otMoney = otHour * otRate;

        document.getElementById("totalData").innerHTML =
        "TOTAL WORKING : " +
        totalHour.toFixed(2) +
        " jam";

        document.getElementById("dashHour").innerHTML =
        totalHour.toFixed(2) +
        " jam";

        document.getElementById("otData").innerHTML =
        "OT : " +
        otHour.toFixed(2) +
        " jam";

        document.getElementById("otMoney").innerHTML =
        "TOTAL OT : RM " +
        otMoney.toFixed(2);

        document.getElementById("dashOT").innerHTML =
        "RM " +
        otMoney.toFixed(2);

    },60000);

}



// ===============================
// WINDOW ONLOAD
// ===============================

window.onload = function(){

    const status = localStorage.getItem("status");

    if(status){

        updateStatus(status);

    }

    // Restore Check In
    const checkIn = localStorage.getItem("checkIn");

    if(checkIn){

        document.getElementById("checkinData").innerHTML =
        "CHECK IN : " +
        new Date(checkIn).toLocaleTimeString();

    }

    const place = localStorage.getItem("checkinPlace");

    if(place){

        document.getElementById("checkinLocation").innerHTML =
        "📍 CHECK IN LOCATION : " + place;

    }

    const map = localStorage.getItem("checkinMap");

    if(map){

        document.getElementById("openCheckinMap").style.display = "block";

        document.getElementById("openCheckinMap").onclick = function(){

            window.open(map,"_blank");

        };

    }
    const checkOut = localStorage.getItem("checkOut");

if(checkOut){

    document.getElementById("checkoutData").innerHTML =
    "CHECK OUT : " +
    new Date(checkOut).toLocaleTimeString();

}
const checkoutPlace =
localStorage.getItem("checkoutPlace");

if(checkoutPlace){

    document.getElementById("checkoutLocation").innerHTML =
    "📍 CHECK OUT LOCATION : " +
    checkoutPlace;

}
const checkoutMap =
localStorage.getItem("checkoutMap");

if(checkoutMap){

    document.getElementById("openCheckoutMap").style.display = "block";

    document.getElementById("openCheckoutMap").onclick = function(){

        window.open(checkoutMap,"_blank");

    };

}
const checkInTime = localStorage.getItem("checkIn");
const checkOutTime = localStorage.getItem("checkOut");

if(checkInTime && checkOutTime){

    const totalHour =
    (new Date(checkOutTime) - new Date(checkInTime)) / 3600000;

    let otHour = 0;

    if(totalHour > 8){

        otHour = totalHour - 8;

    }

    const otMoney = otHour * otRate;

    document.getElementById("totalData").innerHTML =
    "TOTAL WORKING : " +
    totalHour.toFixed(2) +
    " jam";

    document.getElementById("otData").innerHTML =
    "OT : " +
    otHour.toFixed(2) +
    " jam";

    document.getElementById("otMoney").innerHTML =
    "TOTAL OT : RM " +
    otMoney.toFixed(2);

    document.getElementById("dashHour").innerHTML =
    totalHour.toFixed(2) + " jam";

    document.getElementById("dashOT").innerHTML =
    "RM " + otMoney.toFixed(2);

}
const attendanceID =
localStorage.getItem("attendanceID");

if(attendanceID && status === "Driving"){

    startTracking();

    document.getElementById("btn-checkin").disabled = true;
    document.getElementById("btn-checkout").disabled = false;

}else{

    stopTracking();

}
    startWorkingTimer();

};

document.getElementById("driverStatus").onchange = async function(){

    currentStatus = this.value;

    updateStatus(currentStatus);

    const attendanceID =
    localStorage.getItem("attendanceID");

    if(!attendanceID) return;

    await updateDoc(
        doc(db,"attendance",attendanceID),
        {
            currentStatus: currentStatus
        }
    );

};