// public/js/cadastro.js

const form = document.getElementById("register-form");
const nomeInput = document.getElementById("nome");
const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("password");
const senha2Input = document.getElementById("password2");

const togglePasswordBtn = document.getElementById("toggle-password");
const togglePassword2Btn = document.getElementById("toggle-password2");
const lgpdConsent = document.getElementById("lgpd-consent");

const errorEl = document.getElementById("register-error");
const successEl = document.getElementById("register-success");

function showError(msg) {
  if (successEl) {
    successEl.style.display = "none";
    successEl.innerText = "";
  }

  if (!errorEl) {
    alert(msg);
    return;
  }

  errorEl.innerText = msg;
  errorEl.style.display = "block";
}

function showSuccess(msg) {
  if (errorEl) {
    errorEl.style.display = "none";
    errorEl.innerText = "";
  }

  if (!successEl) {
    alert(msg);
    return;
  }

  successEl.innerText = msg;
  successEl.style.display = "block";
}

function setupTogglePassword(button, input) {
  if (!button || !input) return;

  button.addEventListener("click", () => {
    const senhaOculta = input.type === "password";

    input.type = senhaOculta ? "text" : "password";
    button.innerText = senhaOculta ? "Ocultar" : "Mostrar";
  });
}

setupTogglePassword(togglePasswordBtn, senhaInput);
setupTogglePassword(togglePassword2Btn, senha2Input);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = nomeInput.value.trim();
  const email = emailInput.value.trim();
  const senha = senhaInput.value;
  const senha2 = senha2Input.value;

  if (!nome || !email || !senha || !senha2) {
    return showError("Preencha todos os campos.");
  }

  if (senha.length < 6) {
    return showError("A senha deve ter pelo menos 6 caracteres.");
  }

  if (senha !== senha2) {
    return showError("As senhas não conferem.");
  }

  if (lgpdConsent && !lgpdConsent.checked) {
    return showError("Para criar a conta, é necessário aceitar o aviso de uso de dados.");
  }

  const payload = {
    nome,
    name: nome,
    email,
    senha,
    password: senha
  };

  try {
    const response = await fetch(`${window.API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return showError(data.error || "Erro ao cadastrar.");
    }

    showSuccess("Cadastro realizado! Você já pode fazer login.");

    setTimeout(() => {
      window.location.href = "/views/login.html";
    }, 900);
  } catch (err) {
    console.error("ERRO CADASTRO:", err);
    showError("Erro ao conectar com o servidor.");
  }
});