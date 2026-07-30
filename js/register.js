import { auth, db } from "./firebase.js";

import {
createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
doc,

setDoc,
serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.register = async function(){

let name = document.getElementById("name").value.trim();
let phone = document.getElementById("phone").value.trim();

let position = document.getElementById("position").value.trim();
let basicSalary = Number(
document.getElementById("basicSalary").value
);

let workingDays = Number(
document.getElementById("workingDays").value
);

let workingHours = Number(
document.getElementById("workingHours").value
);
let email = document.getElementById("email").value.trim();
let password = document.getElementById("password").value;

if(
name=="" ||
email=="" ||
password=="" ||
basicSalary==0 ||
workingDays==0 ||
workingHours==0
){



document.getElementById("message").innerHTML =
"❌ Sila lengkapkan semua maklumat.";

return;

}


try{

const userCredential =
await createUserWithEmailAndPassword(
auth,
email,
password
);

const uid = userCredential.user.uid;

let hourlyRate = 
Number((basicSalary / workingDays / workingHours).toFixed(2));


let otRate = 
Number((hourlyRate * 1.5).toFixed(2));



await setDoc(doc(db,"users",uid),{

name:name,
phone:phone,
position:position,

email:email,

basicSalary:basicSalary,
workingDays:workingDays,
workingHours:workingHours,

hourlyRate:hourlyRate,
otRate:otRate,

role:"driver",
status:"Active",

createdAt:serverTimestamp()

});




document.getElementById("message").innerHTML =
"✅ Pendaftaran berjaya!";

document.getElementById("message").innerHTML =
"✅ Pendaftaran berjaya! Sila login.";

setTimeout(function(){
window.location.href="index.html";
},1000);


}catch(error){

document.getElementById("message").innerHTML =
"❌ " + error.message;

}

}