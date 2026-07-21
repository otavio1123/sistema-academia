// public/js/login.js

const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("password");
const errorEl = document.getElementById("login-error");

const togglePasswordBtn = document.getElementById("toggle-password");
const lgpdConsent = document.getElementById("lgpd-consent");

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

// Mostrar / ocultar senha
if (togglePasswordBtn && senhaInput) {
  togglePasswordBtn.addEventListener("click", () => {
    const senhaOculta = senhaInput.type === "password";

    senhaInput.type = senhaOculta ? "text" : "password";
    togglePasswordBtn.innerText = senhaOculta ? "Ocultar" : "Mostrar";
  });
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

  if (lgpdConsent && !lgpdConsent.checked) {
    mostrarErro("Para acessar o sistema, é necessário aceitar o aviso de uso de dados.");
    return;
  }

  try {
    const response = await fetch(`${window.API_BASE_URL}/auth/login`, {
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

    localStorage.setItem("token", data.token);

    window.location.href = "/views/dashboard.html";
  } catch (err) {
    console.error("ERRO LOGIN:", err);
    mostrarErro("Erro ao conectar com o servidor.");
  }
});