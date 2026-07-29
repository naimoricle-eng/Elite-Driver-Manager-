// =====================================
// ELITE DRIVER MANAGER - THEME SYSTEM
// =====================================


function applyTheme(){

    const root = document.documentElement;

    const theme = localStorage.getItem("theme") || "dark";


    let bg = "";
    let primary = "#B6FF2E";


    switch(theme){

        case "blue":

            bg = "linear-gradient(135deg,#001f3f,#0074D9)";
            primary = "#00BFFF";
            break;


        case "carbon":

            bg = "linear-gradient(135deg,#111,#555)";
            primary = "#AAAAAA";
            break;


        case "emerald":

            bg = "linear-gradient(135deg,#003300,#00cc66)";
            primary = "#00FF88";
            break;


        case "purple":

            bg = "linear-gradient(135deg,#240046,#9D4EDD)";
            primary = "#D000FF";
            break;


        case "sunset":

            bg = "linear-gradient(135deg,#ff512f,#f09819)";
            primary = "#FFD700";
            break;


        default:

            bg = "linear-gradient(135deg,#000000,#333333)";
            primary = "#B6FF2E";

    }


    root.style.setProperty(
        "--bg-gradient",
        bg
    );


    root.style.setProperty(
        "--primary",
        primary
    );


    root.style.setProperty(
        "--primary-dark",
        primary
    );


    document.body.style.background = bg;


    console.log("Theme applied:", theme);

}



// Simpan theme bila dropdown berubah
document.addEventListener("DOMContentLoaded",()=>{


    const themeSelect = document.getElementById("theme");


    if(themeSelect){


        themeSelect.value =
        localStorage.getItem("theme") || "dark";


        themeSelect.addEventListener("change",()=>{


            localStorage.setItem(
                "theme",
                themeSelect.value
            );


            applyTheme();


        });


    }


    applyTheme();


});
