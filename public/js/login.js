// public/js/login.js

const API_BASE_URL = "http://localhost:3000";

const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("password");
const errorEl = document.getElementById("login-error");

function mostrarErro(msg) {
  if (!errorEl) {
    alert(msg);
    return;
  }
  errorEl.innerText = msg;
  errorEl.style.display = "block";
}

function limparErro() {
  if (errorEl) {
    errorEl.innerText = "";
    errorEl.style.display = "none";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErro();

  const email = emailInput.value.trim();
  const senha = senhaInput.value;

  if (!email || !senha) {
    mostrarErro("Preencha e-mail e senha.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, senha })
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarErro(data.error || "E-mail ou senha inválidos.");
      return;
    }

    // Salva token
    localStorage.setItem("token", data.token);

    // Redireciona para o dashboard
    window.location.href = "/views/dashboard.html";

  } catch (err) {
    console.error("ERRO LOGIN:", err);
    mostrarErro("Erro ao conectar com o servidor.");
  }
});
