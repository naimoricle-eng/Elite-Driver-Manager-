import { db } from "./firebase.js";

import {
collection,
addDoc,
getDocs,
deleteDoc,
doc,
updateDoc,
serverTimestamp
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// SIMPAN TEMPAT

export async function savePlace(
name,
lat,
lon
){

await addDoc(

collection(db,"savedPlaces"),

{

name:name,

latitude:lat,

longitude:lon,

radius:100,

createdAt:serverTimestamp()

}

);


console.log(
"Lokasi disimpan",
name
);

}



// LOAD TEMPAT

export async function loadPlaces(){


const snapshot =
await getDocs(
collection(db,"savedPlaces")
);



let places=[];



snapshot.forEach(item=>{


places.push({

id:item.id,

...item.data()

});


});



return places;

}




// EDIT NAMA

export async function editPlace(
id,
newName
){


await updateDoc(

doc(
db,
"savedPlaces",
id
),

{

name:newName

}

);


}




// DELETE

export async function deletePlace(id){


await deleteDoc(

doc(
db,
"savedPlaces",
id
)

);


}
