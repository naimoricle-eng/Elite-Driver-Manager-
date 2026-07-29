import { auth, db } from "./firebase.js";

import {
doc,
getDoc,
setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// Ambil UID driver yang login
let uid = localStorage.getItem("uid");


// SAVE PROFILE
window.saveProfile = async function(){

if(!uid){
alert("Sila login dahulu");
return;
}


let data = {

name: document.getElementById("name").value,

phone: document.getElementById("phone").value,

position: document.getElementById("position").value,

email: document.getElementById("email").value,


basicSalary:
Number(document.getElementById("basicSalary").value),

workingDays:
Number(document.getElementById("workingDays").value),

workingHours:
Number(document.getElementById("workingHours").value),


vehicle:
document.getElementById("vehicle").value,

plate:
document.getElementById("plate").value,

mileage:
document.getElementById("mileage").value,

service:
document.getElementById("service").value

};


// kira OT

let hourlyRate =
data.basicSalary /
data.workingDays /
data.workingHours;


let otRate =
hourlyRate * 1.5;


data.hourlyRate =
Number(hourlyRate.toFixed(2));

data.otRate =
Number(otRate.toFixed(2));


await setDoc(
doc(db,"users",uid),
data,
{merge:true}
);


alert("✅ Profile berjaya disimpan");

}



// VIEW PROFILE

window.loadProfile = async function(){

if(!uid){
alert("Sila login dahulu");
return;
}


let snap =
await getDoc(doc(db,"users",uid));


if(snap.exists()){


let data = snap.data();


document.getElementById("name").value =
data.name || "";

document.getElementById("phone").value =
data.phone || "";

document.getElementById("position").value =
data.position || "";

document.getElementById("email").value =
data.email || "";


document.getElementById("basicSalary").value =
data.basicSalary || "";

document.getElementById("workingDays").value =
data.workingDays || "";

document.getElementById("workingHours").value =
data.workingHours || "";


document.getElementById("vehicle").value =
data.vehicle || "";

document.getElementById("plate").value =
data.plate || "";

document.getElementById("mileage").value =
data.mileage || "";

document.getElementById("service").value =
data.service || "";


document.getElementById("result").innerHTML =
"Hourly Rate: RM "+data.hourlyRate+
"<br>OT Rate: RM "+data.otRate;


}else{

alert("Profile tidak dijumpai");

}


}