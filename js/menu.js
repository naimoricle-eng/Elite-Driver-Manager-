// js/menu.js - Menu Bawah Mini (Grab Style) - Slide Mendatar Sahaja

function renderMenu() {
    const menuContainer = document.getElementById("menu");
    if (!menuContainer) return;

    // Elak pembinaan semula jika menu sudah wujud (untuk SPA)
    if (menuContainer.querySelector('.bottom-menu')) {
        updateActiveState(); // Hanya kemas kini status aktif
        if (typeof applyLanguage === "function") setTimeout(applyLanguage, 50);
        return;
    }

    const menuItems = [
    { href: "trip.html", label: "Trip", icon: "🗺️", key: "menu-trip" },

    { href: "claim.html", label: "Claim", icon: "🧾", key: "menu-claim" },
    { href: "more.html", label: "More", icon: "🗃️", key: "menu-more" },
    { href: "settings.html", label: "Tetapan", icon: "🔧", key: "menu-settings" }
];

    // Bina HTML: Menu Bawah Mini dengan aksesibiliti
    let html = `
        <nav class="bottom-menu" id="bottomMenu">

    <button class="floating-logo" onclick="location.href='dashboard.html'">
        <img src="images/logo.png">
    </button>
    
    <div class="menu-carousel" id="menuCarousel" 
style="overflow-x:hidden; overflow-y:hidden;">
                <!-- Item akan dimasukkan di sini -->
            </div>
        </nav>
    `;
    
    // Masukkan struktur asas dulu
    menuContainer.innerHTML = html;
    
    const carousel = document.getElementById("menuCarousel");
    
    // Masukkan item secara berasingan untuk mengelakkan re-parse string besar
    menuItems.forEach(item => {
        const link = document.createElement("a");
        link.href = item.href;
        link.className = item.logo ? "menu-item center-logo" : "menu-item";
        link.setAttribute("data-lang", item.key);
        link.setAttribute("role", "button"); // Untuk aksesibiliti
        
       link.innerHTML = `
    <span class="menu-icon">
        ${item.logo
        ? `<img src="${item.icon}" class="menu-logo-img" alt="logo">`
        : item.icon}
    </span>
`;
        carousel.appendChild(link);
    });

    

    
}

function updateActiveState() {
    const currentPath = window.location.pathname.split("/").pop() || "dashboard.html";
    const links = document.querySelectorAll(".menu-item");
    
    links.forEach(link => {
        link.classList.remove("active");
        if (link.getAttribute("href") === currentPath) {
            link.classList.add("active");
        }
    });
}

function setupSwipeForHorizontalScroll() {
    const carousel = document.getElementById("menuCarousel");
    if (!carousel) return;

    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let scrollStartX = 0;
    let isScrolledVertically = false;

    // Touchstart
    carousel.addEventListener("touchstart", (e) => {
        isDragging = true;
        const touch = e.touches;
        startX = touch.clientX;
        startY = touch.clientY;
        scrollStartX = carousel.scrollLeft;
        isScrolledVertically = false;
        // Jangan prevent default di sini supaya scroll semula jadi berfungsi jika perlu
    }, { passive: true });

    // Touchmove
    carousel.addEventListener("touchmove", (e) => {
        if (!isDragging) return;
        
        const touch = e.touches;
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;

        // Cek jika gerakan menegak dominan (untuk elak halang scroll menegak secara tidak sengaja)
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
            isScrolledVertically = true;
            isDragging = false; // Hentikan drag mendatar
            return;
        }

        // Jika mendatar dominan
        if (Math.abs(deltaX) > 5) { // Threshold kecil untuk elak klik tidak sengaja
            e.preventDefault(); // Halang scroll semula jadi hanya jika kita mengawal
            carousel.scrollLeft = scrollStartX - deltaX;
        }
    }, { passive: false });

    // Touchend
    carousel.addEventListener("touchend", () => {
        isDragging = false;
    });

    // Mouse Events (Desktop)
    carousel.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        scrollStartX = carousel.scrollLeft;
        isScrolledVertically = false;
    });

    carousel.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        if (Math.abs(deltaY) > Math.abs(deltaX)) {
            isScrolledVertically = true;
            isDragging = false;
            return;
        }

        if (Math.abs(deltaX) > 5) {
            e.preventDefault();
            carousel.scrollLeft = scrollStartX - deltaX;
        }
    });

    carousel.addEventListener("mouseup", () => {
        isDragging = false;
    });
    
    carousel.addEventListener("mouseleave", () => {
        isDragging = false;
    });

    // Setup tap events untuk klik item (Active State & Auto Scroll)
    const items = document.querySelectorAll(".menu-item");
    items.forEach(item => {
        item.addEventListener("click", (e) => {
            // Elak navigasi segera jika kita mahu kesan scroll dahulu (pilihan)
            // Jika mahu navigasi terus, buang logik scroll di bawah jika perlu
            
            // Update active class
            items.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            // Scroll ke item tersebut jika berada di luar skrin
            const itemRect = item.getBoundingClientRect();
            const carouselRect = carousel.getBoundingClientRect();
            
            // Jika item di luar pandangan
            if (itemRect.left < carouselRect.left || itemRect.right > carouselRect.right) {
                const itemPosition = item.offsetLeft - (carouselRect.width / 2) + (itemRect.width / 2);
                carousel.scrollTo({
                    left: itemPosition,
                    behavior: "smooth"
                });
            }
        });
    });
}

// Jalankan fungsi ini apabila halaman dimuatkan
document.addEventListener("DOMContentLoaded", renderMenu);
