// public/js/planos.js

const API_BASE = window.API_BASE_URL || "";

const tbody = document.getElementById("plans-table-body");
const btnNew = document.getElementById("btn-new-plan");

const filterPlanSearch = document.getElementById("filterPlanSearch");
const filterPlanStatus = document.getElementById("filterPlanStatus");
const btnFilterPlans = document.getElementById("btnFilterPlans");
const btnClearPlans = document.getElementById("btnClearPlans");

const resumoPlanosAtivos = document.getElementById("planosResumoAtivos");
const resumoPlanosInativos = document.getElementById("planosResumoInativos");
const resumoPlanosTotal = document.getElementById("planosResumoTotal");

let plansCache = [];

// Modal elements
const modalOverlay = document.getElementById("plan-modal-overlay");
const modalTitle = document.getElementById("plan-modal-title");
const modalClose = document.getElementById("plan-modal-close");
const form = document.getElementById("plan-form");
const inputId = document.getElementById("plan-id");
const inputNome = document.getElementById("plan-nome");
const inputValor = document.getElementById("plan-valor");
const msgEl = document.getElementById("plan-form-msg");
const btnCancel = document.getElementById("plan-cancel");
function getTokenOrRedirect() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/views/login.html";
    return null;
  }
  return token;
}

function formatMoney(valor) {
  if (valor === null || valor === undefined) return "--";

  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function updatePlansSummary(plans) {
  const list = Array.isArray(plans) ? plans : [];

  const ativos = list.filter((plan) => plan.ativo === true).length;
  const inativos = list.filter((plan) => plan.ativo !== true).length;
  const total = list.length;

  if (resumoPlanosAtivos) {
    resumoPlanosAtivos.textContent = String(ativos);
  }

  if (resumoPlanosInativos) {
    resumoPlanosInativos.textContent = String(inativos);
  }

  if (resumoPlanosTotal) {
    resumoPlanosTotal.textContent = String(total);
  }
}

function applyPlanFilters() {
  let list = [...plansCache];

  const search = normalizeText(filterPlanSearch?.value);
  const status = filterPlanStatus?.value;

  if (search) {
    list = list.filter((plan) => {
      const nome = normalizeText(plan.nome);
      return nome.includes(search);
    });
  }

  if (status === "ativo") {
    list = list.filter((plan) => plan.ativo === true);
  }

  if (status === "inativo") {
    list = list.filter((plan) => plan.ativo !== true);
  }

  renderPlans(list);
}

function clearPlanFilters() {
  if (filterPlanSearch) {
    filterPlanSearch.value = "";
  }

  if (filterPlanStatus) {
    filterPlanStatus.value = "";
  }

  renderPlans(plansCache);
}

function showMsg(text, type = "ok") {
  if (!msgEl) return;
  msgEl.style.display = "block";
  msgEl.style.color = type === "ok" ? "#3ddc84" : "#ff4d4d";
  msgEl.innerText = text;
}

function clearMsg() {
  if (!msgEl) return;
  msgEl.style.display = "none";
  msgEl.innerText = "";
}

function openModal({ mode, plan }) {
  clearMsg();
  modalOverlay.style.display = "block";

  if (mode === "create") {
    modalTitle.innerText = "Novo plano";
    inputId.value = "";
    inputNome.value = "";
    inputValor.value = "";
  } else {
    modalTitle.innerText = "Editar plano";
    inputId.value = String(plan.id);
    inputNome.value = plan.nome ?? "";
    inputValor.value = plan.valor_mensal ?? "";
  }

  inputNome.focus();
}

function closeModal() {
  modalOverlay.style.display = "none";
}

function renderPlans(plans) {
  const list = Array.isArray(plans) ? plans : [];

  updatePlansSummary(list);

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding:14px; color:var(--text-muted);">
          Nenhum plano cadastrado.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map(plan => `
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:12px 10px;">${plan.id}</td>
      <td style="padding:12px 10px;">${plan.nome}</td>
      <td style="padding:12px 10px;">${formatMoney(plan.valor_mensal)}</td>
      <td style="padding:12px 10px;">${plan.ativo ? "Ativo" : "Inativo"}</td>
      <td style="padding:12px 10px;">
        <button class="btn" type="button"
          data-action="edit"
          data-id="${plan.id}"
          data-nome="${encodeURIComponent(plan.nome ?? "")}"
          data-valor="${plan.valor_mensal ?? ""}"
          style="padding:10px 12px; margin-right:8px;">
          Editar
        </button>

        <button class="btn" type="button"
          data-action="toggle"
          data-id="${plan.id}"
          data-ativo="${plan.ativo ? "1" : "0"}"
          style="padding:10px 12px; background:#222; border:1px solid var(--border);">
          ${plan.ativo ? "Desativar" : "Ativar"}
        </button>
      </td>
    </tr>
  `).join("");
}

async function apiFetch(path, options = {}) {
  const token = getTokenOrRedirect();
  if (!token) throw new Error("Sem token");

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erro HTTP ${res.status}`);
  }
  return data;
}

async function loadPlans() {
  try {
    const data = await apiFetch("/plans", { method: "GET" });
    plansCache = Array.isArray(data) ? data : data?.data || [];
    applyPlanFilters();
  } catch (err) {
    console.error("LOAD PLANS ERROR:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding:14px; color:#ff4d4d;">
          Erro ao carregar planos.
        </td>
      </tr>`;
  }
}

async function createPlan({ nome, valor_mensal }) {
  // POST /plans
  return apiFetch("/plans", {
    method: "POST",
    body: JSON.stringify({ nome, valor_mensal })
  });
}

async function updatePlan(id, { nome, valor_mensal }) {
  // PUT /plans/:id
  return apiFetch(`/plans/${id}`, {
    method: "PUT",
    body: JSON.stringify({ nome, valor_mensal })
  });
}

async function togglePlanStatus(id, ativoAtual) {
  const novoStatus = !ativoAtual;

  return apiFetch(`/plans/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ ativo: novoStatus })
  });
}

//* EVENTS */
document.addEventListener("DOMContentLoaded", () => {
  loadPlans();

if (btnNew) {
  btnNew.addEventListener("click", () => {
    openModal({ mode: "create" });
  });
}
if (btnFilterPlans) {
  btnFilterPlans.addEventListener("click", applyPlanFilters);
}

if (btnClearPlans) {
  btnClearPlans.addEventListener("click", clearPlanFilters);
}

if (filterPlanSearch) {
  filterPlanSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      applyPlanFilters();
    }
  });
}

  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  // fecha clicando fora
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // ações na tabela (delegação)
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");

    if (action === "edit") {
      const nome = decodeURIComponent(btn.getAttribute("data-nome") || "");
      const valor = btn.getAttribute("data-valor") || "";
      openModal({ mode: "edit", plan: { id, nome, valor_mensal: valor } });
      return;
    }

    if (action === "toggle") {
      const ativoAtual = btn.getAttribute("data-ativo") === "1";

      const ok = confirm(
        ativoAtual
          ? "Deseja desativar este plano?"
          : "Deseja ativar este plano?"
      );

      if (!ok) return;

      try {
        await togglePlanStatus(id, ativoAtual);
        await loadPlans();
      } catch (err) {
        console.error("TOGGLE ERROR:", err);
        alert(err.message || "Erro ao alterar status.");
      }
    }
  }); // ✅ FALTAVA ESSE FECHAMENTO AQUI

  // submit do modal (create/edit)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg();

    const id = inputId.value ? Number(inputId.value) : null;
    const nome = inputNome.value.trim();
    const valor = Number(inputValor.value);

    if (!nome) return showMsg("Nome é obrigatório.", "err");
    if (!Number.isFinite(valor) || valor < 0) {
      return showMsg("Valor inválido.", "err");
    }

    try {
      if (!id) {
        await createPlan({ nome, valor_mensal: valor });
        showMsg("Plano criado com sucesso!", "ok");
      } else {
        await updatePlan(id, { nome, valor_mensal: valor });
        showMsg("Plano atualizado com sucesso!", "ok");
      }

      await loadPlans();

      setTimeout(() => closeModal(), 500);
    } catch (err) {
      console.error("SAVE PLAN ERROR:", err);
      showMsg(err.message || "Erro ao salvar plano.", "err");
    }
  });
});