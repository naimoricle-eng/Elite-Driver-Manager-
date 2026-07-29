import { db } from "./firebase.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let watchID = null;

export function startTracking(userId){

if(watchID !== null) return;

watchID = navigator.geolocation.watchPosition(
async (position)=>{

const lat = position.coords.latitude;
const lng = position.coords.longitude;

console.log("Tracking:", lat, lng);

await addDoc(collection(db,"tracking"),{
 userId:userId,
 latitude:lat,
 longitude:lng,
 time:serverTimestamp()
});

},
(error)=>{
console.log("GPS Error:",error.message);
},
{
enableHighAccuracy:true,
maximumAge:5000,
timeout:10000
});

}


export function stopTracking(){

if(watchID !== null){
navigator.geolocation.clearWatch(watchID);
watchID=null;
}

}
