function login(){

let user = document.getElementById("username").value;
let pass = document.getElementById("password").value;

if(user=="driver"&&pass=="1234"){

    window.location.href="dashboard.html";

}else{

    document.getElementById("message").innerHTML="Login gagal";

}
    
