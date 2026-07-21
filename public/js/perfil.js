// public/js/perfil.js

const API_BASE = window.API_BASE_URL || "";
const TOKEN_KEY = "token";

const els = {
  form: document.querySelector("#perfilForm"),
  senhaForm: document.querySelector("#perfilSenhaForm"),

  nome: document.querySelector("#perfil_nome"),
  email: document.querySelector("#perfil_email"),
  id: document.querySelector("#perfil_id"),
  createdAt: document.querySelector("#perfil_created_at"),

  senhaAtual: document.querySelector("#perfil_senha_atual"),
  novaSenha: document.querySelector("#perfil_nova_senha"),
  confirmarSenha: document.querySelector("#perfil_confirmar_senha"),

  btnSalvarNome: document.querySelector("#perfilSalvarNome"),
  btnSalvarSenha: document.querySelector("#perfilSalvarSenha"),

  message: document.querySelector("#perfilMessage"),
  senhaMessage: document.querySelector("#perfilSenhaMessage"),
};

const token = localStorage.getItem(TOKEN_KEY);

if (!token) {
  window.location.href = "/views/login.html";
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function showMessage(element, text, type = "ok") {
  if (!element) {
    alert(text);
    return;
  }

  element.textContent = text;
  element.style.display = "block";
  element.style.color = type === "ok" ? "#3ddc84" : "#ff4d4d";
}

function clearMessage(element) {
  if (!element) return;

  element.textContent = "";
  element.style.display = "none";
}

function formatDateTime(value) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString("pt-BR");
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/views/login.html";
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.message || data || "Erro na requisição.");
  }

  return data;
}

async function loadPerfil() {
  try {
    clearMessage(els.message);

    const data = await apiFetch("/me", { method: "GET" });
    if (!data) return;

    const user = data.user;

    if (!user) {
      showMessage(els.message, "Dados do administrador não encontrados.", "err");
      return;
    }

    els.nome.value = user.nome || "";
    els.email.value = user.email || "--";
    els.id.value = user.id || "--";
    els.createdAt.value = formatDateTime(user.created_at);
  } catch (err) {
    console.error("ERRO PERFIL:", err);
    showMessage(els.message, err.message || "Erro ao carregar dados do perfil.", "err");
  }
}

async function saveNome(event) {
  event.preventDefault();

  const nome = els.nome.value.trim();

  if (nome.length < 3) {
    showMessage(els.message, "Informe um nome com pelo menos 3 caracteres.", "err");
    return;
  }

  try {
    clearMessage(els.message);

    if (els.btnSalvarNome) {
      els.btnSalvarNome.disabled = true;
      els.btnSalvarNome.textContent = "Salvando...";
    }

    const data = await apiFetch("/me/name", {
      method: "PUT",
      body: JSON.stringify({ nome }),
    });

    if (!data) return;

    els.nome.value = data.user?.nome || nome;

    showMessage(els.message, "Nome atualizado com sucesso.", "ok");
  } catch (err) {
    console.error("ERRO SALVAR NOME:", err);
    showMessage(els.message, err.message || "Erro ao atualizar nome.", "err");
  } finally {
    if (els.btnSalvarNome) {
      els.btnSalvarNome.disabled = false;
      els.btnSalvarNome.textContent = "Salvar nome";
    }
  }
}

async function changePassword(event) {
  event.preventDefault();

  const senhaAtual = els.senhaAtual.value;
  const novaSenha = els.novaSenha.value;
  const confirmarSenha = els.confirmarSenha.value;

  if (!senhaAtual || !novaSenha || !confirmarSenha) {
    showMessage(els.senhaMessage, "Preencha todos os campos de senha.", "err");
    return;
  }

  if (novaSenha.length < 6) {
    showMessage(els.senhaMessage, "A nova senha deve ter pelo menos 6 caracteres.", "err");
    return;
  }

  if (novaSenha !== confirmarSenha) {
    showMessage(els.senhaMessage, "A nova senha e a confirmação não conferem.", "err");
    return;
  }

  try {
    clearMessage(els.senhaMessage);

    if (els.btnSalvarSenha) {
      els.btnSalvarSenha.disabled = true;
      els.btnSalvarSenha.textContent = "Alterando...";
    }

    const data = await apiFetch("/me/password", {
      method: "PUT",
      body: JSON.stringify({
        senha_atual: senhaAtual,
        nova_senha: novaSenha,
        confirmar_senha: confirmarSenha,
      }),
    });

    if (!data) return;

    els.senhaAtual.value = "";
    els.novaSenha.value = "";
    els.confirmarSenha.value = "";

    showMessage(els.senhaMessage, "Senha alterada com sucesso.", "ok");
  } catch (err) {
    console.error("ERRO ALTERAR SENHA:", err);
    showMessage(els.senhaMessage, err.message || "Erro ao alterar senha.", "err");
  } finally {
    if (els.btnSalvarSenha) {
      els.btnSalvarSenha.disabled = false;
      els.btnSalvarSenha.textContent = "Alterar senha";
    }
  }
}
function bindPasswordToggles() {
  const buttons = document.querySelectorAll(".toggle-password[data-target]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.target;
      const input = document.getElementById(targetId);

      if (!input) return;

      const isPassword = input.type === "password";

      input.type = isPassword ? "text" : "password";
      button.textContent = isPassword ? "Ocultar" : "Mostrar";
    });
  });
}
function bindEvents() {
  if (els.form) {
    els.form.addEventListener("submit", saveNome);
  }

  if (els.senhaForm) {
    els.senhaForm.addEventListener("submit", changePassword);
  }

  bindPasswordToggles();
}

bindEvents();
loadPerfil();