// public/js/auth-guard.js
const API_BASE_URL = "http://localhost:3000";

(async function protectPage() {
  const token = localStorage.getItem("token");

  // Sem token = não autenticado
  if (!token) {
    window.location.href = "/views/login.html";
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Token inválido/expirado
      localStorage.removeItem("token");
      window.location.href = "/views/login.html";
      return;
    }

    // Se quiser usar o usuário na tela:
    // window.currentUser = data.user;

  } catch (err) {
    console.error("AUTH GUARD ERROR:", err);
    // Em caso de falha de conexão, por segurança volta ao login
    window.location.href = "/views/login.html";
  }
})();
