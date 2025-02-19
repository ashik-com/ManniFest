document.addEventListener("DOMContentLoaded", function () {
    const links = document.querySelectorAll(".nav-link");
    const contentDiv = document.getElementById("page-content");

    links.forEach(link => {
        link.addEventListener("click", function (e) {
            e.preventDefault(); // Prevent default page reload

            // Update active link styling
            links.forEach(l => l.classList.remove("active"));
            this.classList.add("active");

            // Fetch the new content
            fetch(this.getAttribute("href"))
                .then(response => response.text())
                .then(html => {
                    // Smooth transition effect
                    contentDiv.style.opacity = "0";
                    setTimeout(() => {
                        contentDiv.innerHTML = html; // Update content
                        contentDiv.style.opacity = "1";
                    }, 300); // Transition duration
                })
                .catch(error => console.error("Error loading page:", error));
        });
    });
});
