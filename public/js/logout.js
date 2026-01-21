// public/js/logout.js
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btn-logout");
  if (!btn) return;

  btn.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/views/login.html";
  });
});
