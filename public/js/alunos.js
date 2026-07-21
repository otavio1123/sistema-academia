/* public/js/alunos.js
 * Módulo ALUNOS - Fase 3.2
 * - GET /students (listar)
 * - POST /students (criar)
 * - PUT /students/:id (editar)
 * - PUT /students/:id (ativar/inativar via campo ativo)
 * - (Opcional) GET /plans (popular select de planos no modal)
 */

(() => {
  // ====== CONFIG ======
  const API_BASE = window.API_BASE_URL || "";
  const TOKEN_KEY = "token";

  // ====== ELEMENTOS ======
  const els = {
tbody: document.querySelector("#studentsTbody"),
btnNovo: document.querySelector("#btnNovoAluno"),

filterSearch: document.querySelector("#filterStudentSearch"),
filterStatus: document.querySelector("#filterStudentStatus"),
btnFilter: document.querySelector("#btnFilterStudents"),
btnClear: document.querySelector("#btnClearStudents"),

resumoAtivos: document.querySelector("#alunosResumoAtivos"),
resumoInativos: document.querySelector("#alunosResumoInativos"),
resumoTotal: document.querySelector("#alunosResumoTotal"),

    modal: document.querySelector("#alunoModal"),
    modalTitle: document.querySelector("#alunoModalTitle"),
    form: document.querySelector("#alunoForm"),
    btnClose: document.querySelector("#alunoModalClose"),
    btnCancel: document.querySelector("#alunoCancel"),

    inpId: document.querySelector("#aluno_id"),
    inpNome: document.querySelector("#aluno_nome"),
inpCpf: document.querySelector("#aluno_cpf"),
inpTelefone: document.querySelector("#aluno_telefone"),
selPlano: document.querySelector("#aluno_plano_id"),
    inpDataInicio: document.querySelector("#aluno_data_inicio"),
    chkAtivo: document.querySelector("#aluno_ativo"),
    btnSubmit: document.querySelector("#alunoSubmit"),

    whatsappModal: document.querySelector("#whatsappModal"),
whatsappModalTitle: document.querySelector("#whatsappModalTitle"),
whatsappStudentId: document.querySelector("#whatsapp_student_id"),
whatsappMessageText: document.querySelector("#whatsappMessageText"),
whatsappClose: document.querySelector("#whatsappModalClose"),
whatsappCancel: document.querySelector("#whatsappCancel"),
whatsappSend: document.querySelector("#whatsappSend"),
whatsappTemplateButtons: document.querySelectorAll(".whatsapp-template-btn"),
  };

  // ====== AUTH GUARD ======
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = "/views/login.html";
    return;
  }

  // ====== HELPERS ======
  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "/views/login.html";
      return;
    }

    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => null);

    if (!res.ok) {
throw new Error(
  data?.error || data?.message || data || `Erro ${res.status} em ${path}`
);
    }

    return data;
  }

  function toDateInputValue(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }
function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatCPF(value) {
  const cpf = onlyDigits(value);

  if (cpf.length !== 11) {
    return value || "-";
  }

  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
function formatPhone(value) {
  const phone = onlyDigits(value);

  if (!phone) {
    return "-";
  }

  if (phone.length === 11) {
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }

  if (phone.length === 10) {
    return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }

  return value || "-";
}
function buildWhatsAppNumber(value) {
  const phone = onlyDigits(value);

  if (!phone) return "";

  if (phone.startsWith("55")) {
    return phone;
  }

  return `55${phone}`;
}

function buildStudentWhatsAppMessage(student) {
  const nome = student.nome || "aluno";

  return `Olá, ${nome}! Tudo bem?

Entrando em contato pela academia. Qualquer dúvida, estou à disposição.`;
}

function formatDateBRFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("pt-BR");
}

function getNextDueDateFromStudent(student) {
  if (!student?.data_inicio) return null;

  const start = new Date(student.data_inicio);
  if (Number.isNaN(start.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDay = start.getDate();

  let year = today.getFullYear();
  let month = today.getMonth();

  let lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  let dueDate = new Date(year, month, Math.min(dueDay, lastDayOfMonth));
  dueDate.setHours(0, 0, 0, 0);

  if (dueDate < today) {
    month += 1;

    if (month > 11) {
      month = 0;
      year += 1;
    }

    lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    dueDate = new Date(year, month, Math.min(dueDay, lastDayOfMonth));
    dueDate.setHours(0, 0, 0, 0);
  }

  return dueDate;
}
function replaceMessageTokens(message, student) {
  const nome = student?.nome || "aluno";
  const plano = student?.plano_nome || "seu plano";

  const dueDate = getNextDueDateFromStudent(student);
  const dataVencimento = dueDate ? formatDateBRFromDate(dueDate) : "data de vencimento";

  const replacements = {
    "{nome}": nome,
    "{plano}": plano,
    "{data_vencimento}": dataVencimento,
    "{valor}": "valor não informado",
    "{mes}": "-",
    "{ano}": "-",
  };

  let finalMessage = message || "";

  Object.entries(replacements).forEach(([token, value]) => {
    finalMessage = finalMessage.split(token).join(value);
  });

  return finalMessage;
}

function buildStudentTemplateMessage(template, student) {
  const defaults = {
    geral: `Olá, {nome}! Tudo bem?

Entrando em contato pela academia. Qualquer dúvida, estou à disposição.`,

    vencimento: `Olá, {nome}! Tudo bem?

Passando para lembrar que a mensalidade do seu plano {plano} vence em {data_vencimento}.

Qualquer dúvida, fico à disposição.`,

    vencido: `Olá, {nome}! Tudo bem?

Identificamos que sua mensalidade do plano {plano} consta como pendente.

Pode verificar, por favor?`,

    personalizada: "",
  };

  const settingKeys = {
    geral: "whatsapp_mensagem_geral",
    vencimento: "whatsapp_lembrete_vencimento",
    vencido: "whatsapp_pagamento_vencido",
  };

  if (template === "personalizada") {
    return "";
  }

  const settingKey = settingKeys[template];
  const savedMessage = whatsappSettings[settingKey];
  const message = savedMessage || defaults[template] || defaults.geral;

  return replaceMessageTokens(message, student);
}

function setActiveWhatsAppTemplate(template) {
  currentWhatsAppTemplate = template;

  els.whatsappTemplateButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.template === template);
  });

  if (els.whatsappMessageText && currentWhatsAppStudent) {
    els.whatsappMessageText.value = buildStudentTemplateMessage(template, currentWhatsAppStudent);
  }
}

function openStudentWhatsApp(student) {
  if (!student?.telefone) {
    alert("Este aluno não possui telefone cadastrado.");
    return;
  }

  currentWhatsAppStudent = student;

  if (els.whatsappStudentId) {
    els.whatsappStudentId.value = student.id;
  }

  if (els.whatsappModalTitle) {
    els.whatsappModalTitle.textContent = `WhatsApp - ${student.nome}`;
  }

  if (els.whatsappModal) {
    els.whatsappModal.classList.add("open");
    els.whatsappModal.setAttribute("aria-hidden", "false");
  }

  setActiveWhatsAppTemplate("geral");
}

function closeWhatsAppModal() {
  if (els.whatsappModal) {
    els.whatsappModal.classList.remove("open");
    els.whatsappModal.setAttribute("aria-hidden", "true");
  }

  currentWhatsAppStudent = null;
  currentWhatsAppTemplate = "geral";

  if (els.whatsappMessageText) {
    els.whatsappMessageText.value = "";
  }
}

function sendWhatsAppMessage() {
  if (!currentWhatsAppStudent) {
    alert("Nenhum aluno selecionado.");
    return;
  }

  const phone = buildWhatsAppNumber(currentWhatsAppStudent.telefone);

  if (!phone) {
    alert("Este aluno não possui telefone cadastrado.");
    return;
  }

  const message = els.whatsappMessageText?.value.trim();

  if (!message) {
    alert("Digite uma mensagem antes de enviar.");
    return;
  }

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");

  closeWhatsAppModal();
}
function updateStudentsSummary(list) {
  const students = Array.isArray(list) ? list : [];

  const ativos = students.filter((student) => student.ativo === true).length;
  const inativos = students.filter((student) => student.ativo !== true).length;
  const total = students.length;

  if (els.resumoAtivos) {
    els.resumoAtivos.textContent = String(ativos);
  }

  if (els.resumoInativos) {
    els.resumoInativos.textContent = String(inativos);
  }

  if (els.resumoTotal) {
    els.resumoTotal.textContent = String(total);
  }
}
  // ====== STATE ======
let studentsCache = [];
let plansCache = [];
let currentWhatsAppStudent = null;
let currentWhatsAppTemplate = "geral";
let whatsappSettings = {};

  // ====== MODAL ======
  function openModal({ mode, student }) {
    const edit = mode === "edit";

    els.modalTitle.textContent = edit ? "Editar Aluno" : "Novo Aluno";
    els.btnSubmit.textContent = edit ? "Salvar alterações" : "Criar aluno";

    els.inpId.value = edit ? student.id : "";
    els.inpNome.value = edit ? student.nome : "";
els.inpCpf.value = edit ? student.cpf : "";
els.inpTelefone.value = edit ? student.telefone || "" : "";
els.inpDataInicio.value = edit
      ? toDateInputValue(student.data_inicio)
      : "";
    els.chkAtivo.checked = edit ? !!student.ativo : true;

    els.selPlano.value = edit ? student.plano_id : "";

   els.modal.classList.add("open");
els.modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
   els.modal.classList.remove("open");
els.modal.setAttribute("aria-hidden", "true");
  }

  // ====== PLANS ======
  async function loadPlans() {
    if (plansCache.length) return;
    const plans = await apiFetch("/plans");
    plansCache = plans.filter(p => p.ativo !== false);

    els.selPlano.innerHTML =
      `<option value="">Selecione um plano</option>` +
      plansCache.map(p => `<option value="${p.id}">${p.nome}</option>`).join("");
  }
async function loadWhatsAppSettings() {
  try {
    const settings = await apiFetch("/settings", { method: "GET" });

    const map = {};

    settings.forEach((item) => {
      map[item.chave] = item.valor;
    });

    whatsappSettings = map;
  } catch (err) {
    console.error("Erro ao carregar mensagens do WhatsApp:", err);
    whatsappSettings = {};
  }
}
  // ====== STUDENTS ======
async function loadStudents() {
  const students = await apiFetch("/students");
  studentsCache = Array.isArray(students) ? students : students?.data || [];
  applyStudentFilters();
}

function renderStudents(list) {
  const students = Array.isArray(list) ? list : [];

  updateStudentsSummary(students);

  if (!students.length) {
    els.tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:16px; color:var(--text-muted);">
          Nenhum aluno encontrado.
        </td>
      </tr>
    `;
    return;
  }

  els.tbody.innerHTML = students.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${s.nome}</td>
<td>${formatCPF(s.cpf)}</td>
<td>${formatPhone(s.telefone)}</td>
<td>${s.plano_nome || s.plano_id}</td>
      <td>${toDateInputValue(s.data_inicio) || "--"}</td>
      <td>${s.ativo ? "Ativo" : "Inativo"}</td>
<td>
  <div class="actions-group">
    ${
      s.telefone
        ? `<button class="btn btn-sm btn-whatsapp" data-action="whatsapp" data-id="${s.id}">WhatsApp</button>`
        : ""
    }

    <button class="btn btn-sm btn-edit" data-action="edit" data-id="${s.id}">
      Editar
    </button>

    <button 
      class="btn btn-sm ${s.ativo ? "btn-toggle-off" : "btn-toggle-on"}" 
      data-action="toggle" 
      data-id="${s.id}"
    >
      ${s.ativo ? "Inativar" : "Ativar"}
    </button>
  </div>
</td>
    </tr>
  `).join("");
}
function applyStudentFilters() {
  let list = [...studentsCache];

  const search = normalizeText(els.filterSearch?.value);
  const searchDigits = onlyDigits(els.filterSearch?.value);
  const status = els.filterStatus?.value;

  if (search) {
    list = list.filter((student) => {
const nome = normalizeText(student.nome);
const cpf = onlyDigits(student.cpf);
const telefone = onlyDigits(student.telefone);

return (
  nome.includes(search) ||
  cpf.includes(searchDigits) ||
  telefone.includes(searchDigits)
);
    });
  }

  if (status === "ativo") {
    list = list.filter((student) => student.ativo === true);
  }

  if (status === "inativo") {
    list = list.filter((student) => student.ativo !== true);
  }

  renderStudents(list);
}

function clearStudentFilters() {
  if (els.filterSearch) {
    els.filterSearch.value = "";
  }

  if (els.filterStatus) {
    els.filterStatus.value = "";
  }

  renderStudents(studentsCache);
}
  async function saveStudent(payload, id) {
    if (id) {
      await apiFetch(`/students/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await apiFetch("/students", { method: "POST", body: JSON.stringify(payload) });
    }
  }

  async function toggleStudent(student) {
    await apiFetch(`/students/${student.id}`, {
      method: "PUT",
body: JSON.stringify({
  nome: student.nome,
  cpf: student.cpf,
  telefone: student.telefone || "",
  plano_id: student.plano_id,
  data_inicio: toDateInputValue(student.data_inicio),
  ativo: !student.ativo,
}),
    });
  }

  // ====== EVENTS ======
  function bindEvents() {
    els.btnNovo.onclick = async () => {
      await loadPlans();
      openModal({ mode: "create" });
    };

    els.btnClose.onclick = closeModal;
    els.btnCancel.onclick = closeModal;
if (els.btnFilter) {
  els.btnFilter.onclick = applyStudentFilters;
}

if (els.btnClear) {
  els.btnClear.onclick = clearStudentFilters;
}

if (els.filterSearch) {
  els.filterSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      applyStudentFilters();
    }
  });
}
    els.modal.onclick = e => {
      if (e.target === els.modal) closeModal();
    };
    if (els.whatsappClose) {
  els.whatsappClose.onclick = closeWhatsAppModal;
}

if (els.whatsappCancel) {
  els.whatsappCancel.onclick = closeWhatsAppModal;
}

if (els.whatsappModal) {
  els.whatsappModal.onclick = e => {
    if (e.target === els.whatsappModal) closeWhatsAppModal();
  };
}

if (els.whatsappTemplateButtons) {
  els.whatsappTemplateButtons.forEach((button) => {
    button.onclick = () => {
      setActiveWhatsAppTemplate(button.dataset.template);
    };
  });
}

if (els.whatsappSend) {
  els.whatsappSend.onclick = sendWhatsAppMessage;
}

    els.tbody.onclick = async e => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const student = studentsCache.find(s => s.id == btn.dataset.id);

if (btn.dataset.action === "whatsapp") {
  openStudentWhatsApp(student);
  return;
}

if (btn.dataset.action === "edit") {
  await loadPlans();
  openModal({ mode: "edit", student });
  return;
}

if (btn.dataset.action === "toggle") {
  await toggleStudent(student);
  await loadStudents();
  return;
}
    };

els.form.onsubmit = async e => {
  e.preventDefault();

  const payload = {
    nome: els.inpNome.value.trim(),
    cpf: els.inpCpf.value.replace(/\D/g, ""),
    telefone: onlyDigits(els.inpTelefone.value),
    plano_id: Number(els.selPlano.value),
    data_inicio: els.inpDataInicio.value,
    ativo: els.chkAtivo.checked,
  };

  if (!payload.nome) {
    alert("Informe o nome do aluno.");
    return;
  }

  if (payload.cpf.length !== 11) {
    alert("Informe um CPF válido com 11 números.");
    return;
  }

  if (!payload.plano_id) {
    alert("Selecione um plano.");
    return;
  }

  if (!payload.data_inicio) {
    alert("Informe a data de início.");
    return;
  }

  try {
    if (els.btnSubmit) {
      els.btnSubmit.disabled = true;
      els.btnSubmit.textContent = "Salvando...";
    }

    await saveStudent(payload, els.inpId.value);
    closeModal();
    await loadStudents();
  } catch (err) {
    console.error("ERRO AO SALVAR ALUNO:", err);
    alert(err.message || "Erro ao salvar aluno.");
  } finally {
    if (els.btnSubmit) {
      els.btnSubmit.disabled = false;
      els.btnSubmit.textContent = els.inpId.value ? "Salvar alterações" : "Criar aluno";
    }
  }
};

    // Ícone 📅 custom
    const dateBtn = document.querySelector(".date-btn");
    if (dateBtn) {
      dateBtn.onclick = () => els.inpDataInicio.showPicker?.();
    }
  }

(async function init() {
  bindEvents();
  await loadWhatsAppSettings();
  await loadStudents();
})();
})();
