(() => {
  const API_BASE = window.API_BASE_URL || "";
  const TOKEN_KEY = "token";

  const els = {
    form: document.querySelector("#configuracoesForm"),
    msgGeral: document.querySelector("#msgGeral"),
    msgLembrete: document.querySelector("#msgLembrete"),
    msgVencido: document.querySelector("#msgVencido"),
    msgConfirmacao: document.querySelector("#msgConfirmacao"),
    btnSalvar: document.querySelector("#btnSalvarConfiguracoes"),
    message: document.querySelector("#configuracoesMessage"),
  };

  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    window.location.href = "/views/login.html";
    return;
  }

  const keys = {
    msgGeral: "whatsapp_mensagem_geral",
    msgLembrete: "whatsapp_lembrete_vencimento",
    msgVencido: "whatsapp_pagamento_vencido",
    msgConfirmacao: "whatsapp_confirmacao_pagamento",
  };

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  function showMessage(text, type = "ok") {
    if (!els.message) return;

    els.message.textContent = text;
    els.message.style.display = "block";
    els.message.style.color = type === "ok" ? "#3ddc84" : "#ff4d4d";
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

  async function loadSettings() {
    try {
      const settings = await apiFetch("/settings", { method: "GET" });
      if (!settings) return;

      const map = {};

      settings.forEach((item) => {
        map[item.chave] = item.valor;
      });

      els.msgGeral.value = map[keys.msgGeral] || "";
      els.msgLembrete.value = map[keys.msgLembrete] || "";
      els.msgVencido.value = map[keys.msgVencido] || "";
      els.msgConfirmacao.value = map[keys.msgConfirmacao] || "";
    } catch (err) {
      console.error("ERRO CONFIGURAÇÕES:", err);
      showMessage(err.message || "Erro ao carregar configurações.", "err");
    }
  }

  async function saveSetting(chave, valor) {
    await apiFetch(`/settings/${chave}`, {
      method: "PUT",
      body: JSON.stringify({ valor }),
    });
  }

  async function saveSettings(event) {
    event.preventDefault();

    try {
      if (els.btnSalvar) {
        els.btnSalvar.disabled = true;
        els.btnSalvar.textContent = "Salvando...";
      }

      await Promise.all([
        saveSetting(keys.msgGeral, els.msgGeral.value),
        saveSetting(keys.msgLembrete, els.msgLembrete.value),
        saveSetting(keys.msgVencido, els.msgVencido.value),
        saveSetting(keys.msgConfirmacao, els.msgConfirmacao.value),
      ]);

      showMessage("Configurações salvas com sucesso.", "ok");
    } catch (err) {
      console.error("ERRO AO SALVAR CONFIGURAÇÕES:", err);
      showMessage(err.message || "Erro ao salvar configurações.", "err");
    } finally {
      if (els.btnSalvar) {
        els.btnSalvar.disabled = false;
        els.btnSalvar.textContent = "Salvar configurações";
      }
    }
  }
function insertTokenAtCursor(textarea, token) {
  if (!textarea || !token) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const currentValue = textarea.value;

  textarea.value =
    currentValue.substring(0, start) +
    token +
    currentValue.substring(end);

  const newPosition = start + token.length;
  textarea.focus();
  textarea.setSelectionRange(newPosition, newPosition);
}

function bindTokenButtons() {
  const buttons = document.querySelectorAll(".settings-token");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.target;
      const token = button.dataset.token;
      const textarea = document.getElementById(targetId);

      insertTokenAtCursor(textarea, token);
    });
  });
}

bindTokenButtons();
  if (els.form) {
    els.form.addEventListener("submit", saveSettings);
  }

  loadSettings();
})();