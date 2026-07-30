// js/language.js

const translations = {

    ms: {

        // MENU
        "menu-dashboard": "📊 Papan Pemuka",
        "menu-attendance": "📅 Kehadiran",
        "menu-trip": "🗺️ Perjalanan",
        "menu-claim": "💰 Tuntutan",
        "menu-leave": "🚪 Cuti",
        "menu-report": "📈 Laporan Harian",
        "menu-monthly-report": "📊 Laporan Bulanan",
        "menu-profile": "👤 Profil",
        "menu-settings": "⚙️ Tetapan",

        // LOGIN
        "login-title": "Elite Driver Manager",
        "login-subtitle": "Log Masuk Pemandu",
        "ph-email": "E-mel",
        "ph-password": "Kata Laluan",
        "btn-login": "LOG MASUK",
        "btn-register": "DAFTAR SEKARANG",
        "link-forgot-pass": "🔑 Lupa Kata Laluan?",
        "link-to-register": "Daftar Pemandu",

        // DASHBOARD
        "dash-welcome": "Selamat Datang,",
        "dash-status": "Status Semasa:",
        "dash-active": "Aktif",
        "dash-inactive": "Tidak Aktif",

        // ATTENDANCE
        "att-title": "📅 Rekod Kehadiran",
        "btn-clockin": "MASUK KERJA",
        "btn-clockout": "TAMAT KERJA",

        // TRIP
        "trip-title": "🗺️ Maklumat Perjalanan",
        "ph-destination": "Destinasi / Lokasi",
        "ph-odometer": "Bacaan Odometer (KM)",
        "btn-start-trip": "MULA PERJALANAN",
        "btn-end-trip": "TAMAT PERJALANAN",

        // CLAIM
        "claim-title": "💰 Tuntutan Pemandu",
        "leave-title": "🚪 Permohonan Cuti",
        "ph-amount": "Jumlah (RM)",
        "ph-reason": "Sebab / Alasan",
        "ph-date": "Tarikh",
        "btn-submit": "HANTAR PERMOHONAN",

        // PROFILE
        "prof-title": "👤 Profil Pemandu",
        "lbl-license": "No. Lesen Memandu:",
        "btn-update": "KEMASKINI PROFIL",

        // REPORT
        "rep-title": "📈 Laporan Pemandu",
        "rep-monthly-title": "📊 Laporan Bulanan",
        "lbl-total-trips": "Jumlah Perjalanan:",
        "lbl-total-claims": "Jumlah Tuntutan:",

        // SETTINGS
        "nav-settings": "⚙️ Tetapan",
        "title-company": "Maklumat Syarikat",
        "placeholder-company": "Nama Syarikat",
        "title-appearance": "🎨 Paparan",
        "title-language": "🌐 Bahasa",
        "title-navigation": "🗺 Navigasi",
        "title-notification": "🔔 Notifikasi",
        "btn-save": "SIMPAN TETAPAN",
        "btn-logout": "🚪 LOG KELUAR"

    },


    en: {

        // MENU
        "menu-dashboard": "📊 Dashboard",
        "menu-attendance": "📅 Attendance",
        "menu-trip": "🗺️ Trip",
        "menu-claim": "💰 Claims",
        "menu-leave": "🚪 Leave",
        "menu-report": "📈 Daily Report",
        "menu-monthly-report": "📊 Monthly Report",
        "menu-profile": "👤 Profile",
        "menu-settings": "⚙️ Settings",

        // LOGIN
        "login-title": "Elite Driver Manager",
        "login-subtitle": "Driver Login",
        "ph-email": "Email",
        "ph-password": "Password",
        "btn-login": "LOGIN",
        "btn-register": "REGISTER NOW",
        "link-forgot-pass": "🔑 Forgot Password?",
        "link-to-register": "Register Driver",

        // DASHBOARD
        "dash-welcome": "Welcome,",
        "dash-status": "Current Status:",
        "dash-active": "Active",
        "dash-inactive": "Inactive",

        // ATTENDANCE
        "att-title": "📅 Attendance Record",
        "btn-clockin": "CLOCK IN",
        "btn-clockout": "CLOCK OUT",

        // TRIP
        "trip-title": "🗺️ Trip Information",
        "ph-destination": "Destination / Location",
        "ph-odometer": "Odometer Reading (KM)",
        "btn-start-trip": "START TRIP",
        "btn-end-trip": "END TRIP",

        // CLAIM
        "claim-title": "💰 Driver Claims",
        "leave-title": "🚪 Leave Application",
        "ph-amount": "Amount (RM)",
        "ph-reason": "Reason",
        "ph-date": "Date",
        "btn-submit": "SUBMIT APPLICATION",

        // PROFILE
        "prof-title": "👤 Driver Profile",
        "lbl-license": "Driving License No:",
        "btn-update": "UPDATE PROFILE",

        // REPORT
        "rep-title": "📈 Driver Report",
        "rep-monthly-title": "📊 Monthly Report",
        "lbl-total-trips": "Total Trips:",
        "lbl-total-claims": "Total Claims:",

        // SETTINGS
        "nav-settings": "⚙️ Settings",
        "title-company": "Company Info",
        "placeholder-company": "Company Name",
        "title-appearance": "🎨 Appearance",
        "title-language": "🌐 Language",
        "title-navigation": "🗺 Navigation",
        "title-notification": "🔔 Notification",
        "btn-save": "SAVE SETTINGS",
        "btn-logout": "🚪 LOGOUT"

    }

};


// Fungsi tukar bahasa
function applyLanguage(){

    const currentLang = localStorage.getItem("language") || "ms";

    const langData = translations[currentLang];

    if(!langData) return;


    document.querySelectorAll("[data-lang]").forEach(element => {

        const key = element.getAttribute("data-lang");

        if(langData[key]){

            if(element.tagName === "INPUT"){

                element.placeholder = langData[key];

            }else{

                element.innerHTML = langData[key];

            }

        }

    });

}


// Jalankan bila halaman siap
document.addEventListener("DOMContentLoaded", applyLanguage);