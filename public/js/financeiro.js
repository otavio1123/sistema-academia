(() => {
  const TOKEN_KEY = "token";
  const API_BASE = window.API_BASE_URL || ""; // usa config.js

  const els = {
    tbody: document.querySelector("#paymentsTbody"),
    btnNovo: document.querySelector("#btnNovoPagamento"),
paymentPlanInfo: document.getElementById("paymentPlanInfo"),
filterMonth: document.querySelector("#filterMonth"),
filterYear: document.querySelector("#filterYear"),
filterStatus: document.querySelector("#filterStatus"),
filterForma: document.querySelector("#filterForma"),
btnFilter: document.querySelector("#btnFilterPayments"),
btnClear: document.querySelector("#btnClearPayments"),

resumoRecebido: document.querySelector("#financeiroResumoRecebido"),
resumoPendente: document.querySelector("#financeiroResumoPendente"),
resumoPagos: document.querySelector("#financeiroResumoPagos"),
resumoPendentes: document.querySelector("#financeiroResumoPendentes"),

    // Modal
    modal: document.querySelector("#pagamentoModal"),
    modalTitle: document.querySelector("#pagamentoModalTitle"),
    form: document.querySelector("#pagamentoForm"),
    btnClose: document.querySelector("#pagamentoModalClose"),
    btnCancel: document.querySelector("#pagamentoCancel"),
    btnSubmit: document.querySelector("#pagamentoSubmit"),

    // Campos
    inpId: document.querySelector("#pagamento_id"),
    selStudent: document.querySelector("#pagamento_student_id"),
    selMes: document.querySelector("#pagamento_mes"),
    inpAno: document.querySelector("#pagamento_ano"),
inpValor: document.querySelector("#pagamento_valor"),
selForma: document.querySelector("#pagamento_forma_pagamento"),
selStatus: document.querySelector("#pagamento_status"),
inpObs: document.querySelector("#pagamento_observacao"),
whatsappModal: document.querySelector("#whatsappModal"),
whatsappModalTitle: document.querySelector("#whatsappModalTitle"),
whatsappPaymentId: document.querySelector("#whatsapp_payment_id"),
whatsappMessageText: document.querySelector("#whatsappMessageText"),
whatsappClose: document.querySelector("#whatsappModalClose"),
whatsappCancel: document.querySelector("#whatsappCancel"),
whatsappSend: document.querySelector("#whatsappSend"),
whatsappTemplateButtons: document.querySelectorAll(".whatsapp-template-btn"),
  };

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = "/views/login.html";
    return;
  }

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
      throw new Error(data?.error || data?.message || data || `Erro ${res.status} em ${path}`);
    }
    return data;
  }

  const moneyBR = (v) =>
    Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ===== FILTROS: preencher mês/ano =====
function fillFilterMonths() {
  if (!els.filterMonth) return;

  const previousValue = els.filterMonth.value;

  els.filterMonth.innerHTML =
    `<option value="">Todos os meses</option>` +
    MONTH_NAMES.map((name, index) => {
      const monthNumber = index + 1;
      return `<option value="${monthNumber}">${name}</option>`;
    }).join("");

  if (previousValue) {
    els.filterMonth.value = previousValue;
  }
}
function fillFilterYearsFromPayments(payments) {
  if (!els.filterYear) return;

  const previousValue = els.filterYear.value;
  const currentYear = new Date().getFullYear();
  const years = new Set();

  // Mantém anos que já existem no banco
  (payments || []).forEach((p) => {
    const year = Number(p.ano);

    if (!Number.isNaN(year) && year >= 2000) {
      years.add(year);
    }
  });

  // Adiciona anos próximos para registrar meses anteriores e futuros
  for (let year = currentYear - 2; year <= currentYear + 2; year++) {
    years.add(year);
  }

  const sorted = Array.from(years).sort((a, b) => b - a);

  els.filterYear.innerHTML =
    `<option value="">Todos os anos</option>` +
    sorted.map((year) => `<option value="${year}">${year}</option>`).join("");

  if (previousValue) {
    els.filterYear.value = previousValue;
  }
}
function setDefaultCurrentFilters() {
  const { month, year } = getCurrentMonthYear();

  if (els.filterMonth) {
    els.filterMonth.value = String(month);
  }

  if (els.filterYear) {
    els.filterYear.value = String(year);
  }

  filtersInitialized = true;
}

  // ====== STATE ======
let paymentsCache = [];
let studentsCache = [];
let filtersInitialized = false;

let currentWhatsAppPayment = null;
let currentWhatsAppTemplate = "vencimento";
let whatsappSettings = {};

  let editingPaymentId = null;
let editingPaymentStudentId = null; // pra bloquear troca de aluno no edit
let editingPaymentMes = null;
let editingPaymentAno = null;

  // ====== HELPERS ======
  const upper = (v) => String(v ?? "").trim().toUpperCase();
  const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function getCurrentMonthYear() {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}
function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60000);

  return localDate.toISOString().slice(0, 10);
}
function formatMonthYear(mes, ano) {
  const monthNumber = Number(mes);
  const yearNumber = Number(ano);

  if (!monthNumber || monthNumber < 1 || monthNumber > 12 || !yearNumber) {
    return "-";
  }

  return `${MONTH_NAMES[monthNumber - 1]}/${yearNumber}`;
}

function formatPaymentMethod(value) {
  const method = upper(value);

  const labels = {
    PIX: "PIX",
    DINHEIRO: "Dinheiro",
    CARTAO: "Cartão",
    TRANSFERENCIA: "Transferência",
    BOLETO: "Boleto",
    OUTRO: "Outro",
  };

  return labels[method] || "-";
}

  function normalizeStatus(p) {
    // seu backend decide por data_pagamento
    if (p.data_pagamento) return "PAGO";
    return "PENDENTE";
  }

  function getStudentName(p) {
    // seu GET /payments já traz student_nome
    return (
      p.student_nome ??
      p.student_name ??
      p.aluno_nome ??
      p.student?.nome_completo ??
      p.student?.nome ??
      p.aluno?.nome_completo ??
      p.aluno?.nome ??
      "-"
    );
  }

function formatDateBR(value) {
  if (!value) return "-";

  const datePart = String(value).slice(0, 10);
  const [year, month, day] = datePart.split("-");

  if (!year || !month || !day) {
    return "-";
  }

  return `${day}/${month}/${year}`;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function buildWhatsAppNumber(value) {
  const phone = onlyDigits(value);

  if (!phone) return "";

  if (phone.startsWith("55")) {
    return phone;
  }

  return `55${phone}`;
}

function getPaymentDueDate(payment) {
  if (!payment?.student_data_inicio || !payment?.mes || !payment?.ano) {
    return null;
  }

  const datePart = String(payment.student_data_inicio).slice(0, 10);
  const [, , startDay] = datePart.split("-");
  const dueDay = Number(startDay);

  if (!dueDay) return null;

  const year = Number(payment.ano);
  const monthIndex = Number(payment.mes) - 1;

  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  const finalDay = Math.min(dueDay, lastDayOfMonth);

  return new Date(year, monthIndex, finalDay);
}

function replacePaymentMessageTokens(message, payment) {
  const dueDate = getPaymentDueDate(payment);
  const dataVencimento = dueDate ? dueDate.toLocaleDateString("pt-BR") : "-";

  const replacements = {
    "{nome}": getStudentName(payment),
    "{plano}": payment.plano_nome || "-",
    "{valor}": moneyBR(payment.valor),
    "{mes}": MONTH_NAMES[Number(payment.mes) - 1] || "-",
    "{ano}": payment.ano || "-",
    "{data_vencimento}": dataVencimento,
    "{data_pagamento}": formatDateBR(payment.data_pagamento),
    "{forma_pagamento}": formatPaymentMethod(payment.forma_pagamento),
  };

  let finalMessage = message || "";

  Object.entries(replacements).forEach(([token, value]) => {
    finalMessage = finalMessage.split(token).join(value);
  });

  return finalMessage;
}

function buildPaymentTemplateMessage(template, payment) {
  const defaults = {
    vencimento: `Olá, {nome}! Tudo bem?

Passando para lembrar que a mensalidade do seu plano {plano} vence em {data_vencimento}.

Valor: {valor}

Qualquer dúvida, fico à disposição.`,

    vencido: `Olá, {nome}! Tudo bem?

Identificamos que sua mensalidade do plano {plano}, referente a {mes}/{ano}, consta como pendente.

Valor: {valor}

Pode verificar, por favor?`,

    confirmacao: `Olá, {nome}! Tudo bem?

Confirmamos o recebimento da sua mensalidade referente a {mes}/{ano}.

Valor: {valor}
Forma de pagamento: {forma_pagamento}

Obrigado!`,

    personalizada: "",
  };

  const settingKeys = {
    vencimento: "whatsapp_lembrete_vencimento",
    vencido: "whatsapp_pagamento_vencido",
    confirmacao: "whatsapp_confirmacao_pagamento",
  };

  if (template === "personalizada") {
    return "";
  }

  const settingKey = settingKeys[template];
  const savedMessage = whatsappSettings[settingKey];
  const message = savedMessage || defaults[template] || defaults.vencimento;

  return replacePaymentMessageTokens(message, payment);
}
/*
  Atualiza os cards de resumo financeiro.
  O cálculo usa a mesma lista que está aparecendo na tabela.
*/
function updateFinancialSummary(list) {
  const payments = Array.isArray(list) ? list : [];

  let totalRecebido = 0;
  let totalPendente = 0;
  let qtdPagos = 0;
  let qtdPendentes = 0;

  payments.forEach((payment) => {
    const status = normalizeStatus(payment);
    const valor = Number(payment.valor || 0);

    if (status === "PAGO") {
      totalRecebido += valor;
      qtdPagos += 1;
    }

    if (status === "PENDENTE") {
      totalPendente += valor;
      qtdPendentes += 1;
    }
  });

  if (els.resumoRecebido) {
    els.resumoRecebido.textContent = moneyBR(totalRecebido);
  }

  if (els.resumoPendente) {
    els.resumoPendente.textContent = moneyBR(totalPendente);
  }

  if (els.resumoPagos) {
    els.resumoPagos.textContent = String(qtdPagos);
  }

  if (els.resumoPendentes) {
    els.resumoPendentes.textContent = String(qtdPendentes);
  }
}
  // ====== RENDER ======
function renderPayments(list) {
  if (!els.tbody) return;

  updateFinancialSummary(list);

  if (!list.length) {
      els.tbody.innerHTML = `
        <tr>
<td colspan="8" style="text-align:center; padding:16px; color:var(--text-muted);">           Nenhum pagamento encontrado.
          </td>
        </tr>
      `;
      return;
    }

    els.tbody.innerHTML = list
      .map((p) => {
        const status = normalizeStatus(p);

const btnStatus =
  status === "PENDENTE"
    ? `<button class="btn btn-small btn-success js-mark-paid" data-id="${p.id}" data-valor="${p.valor ?? 0}" data-forma="${p.forma_pagamento ?? ""}">Marcar como pago</button>`
    : `<button class="btn btn-small btn-warning js-mark-pending" data-id="${p.id}" data-valor="${p.valor ?? 0}" data-forma="${p.forma_pagamento ?? ""}">Tornar pendente</button>`;

const btnEdit = `
  <button class="btn btn-small btn-ghost js-edit-payment"
    data-id="${p.id}"
    data-student_id="${p.student_id}"
    data-mes="${p.mes}"
    data-ano="${p.ano}"
    data-valor="${p.valor ?? 0}"
    data-forma="${p.forma_pagamento ?? ""}"
    data-data_pagamento="${p.data_pagamento ?? ""}">
    Editar
  </button>
`;

const btnWhatsApp = p.student_telefone
  ? `<button class="btn btn-small btn-whatsapp js-whatsapp-payment" data-id="${p.id}">WhatsApp</button>`
  : `<button class="btn btn-small btn-disabled" type="button" disabled>Sem telefone</button>`;

const actionHtml = `<div class="actions-group">${btnWhatsApp}${btnStatus}${btnEdit}</div>`;
        return `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:12px;">${p.id ?? "-"}</td>
<td style="padding:12px;">${getStudentName(p)}</td>
<td style="padding:12px;">${formatMonthYear(p.mes, p.ano)}</td>
<td style="padding:12px;">${moneyBR(p.valor)}</td>
<td style="padding:12px;">${formatPaymentMethod(p.forma_pagamento)}</td>
<td style="padding:12px;">${formatDateBR(p.data_pagamento)}</td>
<td style="padding:12px;">${status}</td>
<td style="padding:12px;">${actionHtml}</td>
          </tr>
        `;
      })
      .join("");
  }

  // ====== LOADERS ======
async function loadPayments() {
  const payments = await apiFetch("/payments", { method: "GET" });
  paymentsCache = Array.isArray(payments) ? payments : (payments?.data ?? []);

  fillFilterMonths();
  fillFilterYearsFromPayments(paymentsCache);

  if (!filtersInitialized) {
    setDefaultCurrentFilters();
  }

  applyFilters();
}
  async function loadStudentsForSelect() {
    if (studentsCache.length) return;

    const students = await apiFetch("/students", { method: "GET" });
    studentsCache = Array.isArray(students) ? students : (students?.data ?? []);

    els.selStudent.innerHTML = `
      <option value="" disabled selected>Selecione um aluno</option>
      ${studentsCache
        .filter((s) => s.ativo !== false)
        .map((s) => {
          const nome = s.nome_completo ?? s.nome ?? s.name ?? `Aluno ${s.id}`;
          return `<option value="${s.id}">${nome}</option>`;
        })
        .join("")}
    `;
  }

  function fillPaymentValueFromSelectedStudent() {
  if (els.paymentPlanInfo) {
    els.paymentPlanInfo.textContent = "Selecione um aluno para ver o plano.";
  }

  if (editingPaymentId) {
    return;
  }

  const studentId = Number(els.selStudent.value);

  if (!studentId) {
    return;
  }

  const student = studentsCache.find((s) => Number(s.id) === studentId);

  if (!student) {
    return;
  }

  const planName = student.plano_nome || "Sem plano";
  const planValue = Number(student.plano_valor_mensal);

  if (!Number.isFinite(planValue) || planValue <= 0) {
    if (els.paymentPlanInfo) {
      els.paymentPlanInfo.textContent = `Plano atual: ${planName} - valor não informado`;
    }

    return;
  }

  els.inpValor.value = planValue.toFixed(2);

  if (els.paymentPlanInfo) {
    els.paymentPlanInfo.textContent = `Plano atual: ${planName} - R$ ${planValue
      .toFixed(2)
      .replace(".", ",")}`;
  }
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

  // ====== MODAL ======
function openModal() {
  // modo CRIAR
  editingPaymentId = null;
  editingPaymentStudentId = null;
  editingPaymentMes = null;
  editingPaymentAno = null;

  if (els.modalTitle) els.modalTitle.textContent = "Registrar pagamento";

  els.modal.classList.add("open");
els.inpId.value = "";
els.selStudent.value = "";
if (els.inpObs) els.inpObs.value = "";
els.inpValor.value = "";
  if (els.selForma) els.selForma.value = "";
  if (els.paymentPlanInfo) {
  els.paymentPlanInfo.textContent = "Selecione um aluno para ver o plano.";
}
const { month, year } = getCurrentMonthYear();

els.selMes.value = els.filterMonth?.value || String(month);
els.selStatus.value = "PAGO";
els.inpAno.value = els.filterYear?.value || String(year);

  els.selStudent.disabled = false;
  els.selMes.disabled = false;
  els.inpAno.disabled = false;
}

function openEditModal(p) {
  // modo EDITAR
  editingPaymentId = Number(p.id);
  editingPaymentStudentId = Number(p.student_id);
  editingPaymentMes = Number(p.mes);
  editingPaymentAno = Number(p.ano);

  if (els.modalTitle) els.modalTitle.textContent = "Editar pagamento";

  els.modal.classList.add("open");

  els.inpId.value = String(editingPaymentId);
  els.selStudent.value = String(editingPaymentStudentId);
  els.selMes.value = String(editingPaymentMes);
  els.inpAno.value = String(editingPaymentAno);
  els.inpValor.value = String(p.valor ?? 0);
  if (els.selForma) els.selForma.value = p.forma_pagamento || "";

  els.selStatus.value = p.data_pagamento ? "PAGO" : "PENDENTE";

  if (els.inpObs) els.inpObs.value = "";

  // trava aluno/mês/ano no edit
  els.selStudent.disabled = true;
  els.selMes.disabled = true;
  els.inpAno.disabled = true;
}

function closeModal() {
  els.modal.classList.remove("open");

  editingPaymentId = null;
  editingPaymentStudentId = null;
  editingPaymentMes = null;
  editingPaymentAno = null;

  els.selStudent.disabled = false;
  els.selMes.disabled = false;
  els.inpAno.disabled = false;
}


  // ====== CREATE PAYMENT ======
  async function createPayment(payload) {
    await apiFetch("/payments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async function updatePayment(id, payload) {
  await apiFetch(`/payments/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

  // ====== MARK AS PAID (PUT /payments/:id) ======
async function markPaymentAsPaid(id, valorAtual, formaAtual) {
  await apiFetch(`/payments/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      valor: Number(valorAtual),
      forma_pagamento: formaAtual || "PIX",
      data_pagamento: todayISO(),
    }),
  });
}
async function markPaymentAsPending(id, valorAtual) {
  await apiFetch(`/payments/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      valor: Number(valorAtual),
      forma_pagamento: null,
      data_pagamento: null,
    }),
  });
}
function getSuggestedWhatsAppTemplate(payment) {
  const status = normalizeStatus(payment);

  if (status === "PAGO") {
    return "confirmacao";
  }

  const dueDate = getPaymentDueDate(payment);

  if (!dueDate) {
    return "vencimento";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  if (dueDate < today) {
    return "vencido";
  }

  return "vencimento";
}

function setActiveWhatsAppTemplate(template) {
  currentWhatsAppTemplate = template;

  els.whatsappTemplateButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.template === template);
  });

  if (els.whatsappMessageText && currentWhatsAppPayment) {
    els.whatsappMessageText.value = buildPaymentTemplateMessage(template, currentWhatsAppPayment);
  }
}

function openPaymentWhatsApp(payment) {
  if (!payment?.student_telefone) {
    alert("Este aluno não possui telefone cadastrado.");
    return;
  }

  currentWhatsAppPayment = payment;

  if (els.whatsappPaymentId) {
    els.whatsappPaymentId.value = payment.id;
  }

  if (els.whatsappModalTitle) {
els.whatsappModalTitle.textContent = `WhatsApp - ${getStudentName(payment)}`;  }

  if (els.whatsappModal) {
    els.whatsappModal.classList.add("open");
    els.whatsappModal.setAttribute("aria-hidden", "false");
  }

  setActiveWhatsAppTemplate(getSuggestedWhatsAppTemplate(payment));
}

function closeWhatsAppModal() {
  if (els.whatsappModal) {
    els.whatsappModal.classList.remove("open");
    els.whatsappModal.setAttribute("aria-hidden", "true");
  }

  currentWhatsAppPayment = null;
  currentWhatsAppTemplate = "vencimento";

  if (els.whatsappMessageText) {
    els.whatsappMessageText.value = "";
  }
}

function sendWhatsAppMessage() {
  if (!currentWhatsAppPayment) {
    alert("Nenhum pagamento selecionado.");
    return;
  }

  const phone = buildWhatsAppNumber(currentWhatsAppPayment.student_telefone);

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
// ====== FILTER ======
function applyFilters() {
  let list = [...paymentsCache];

  const m = els.filterMonth?.value;
  const y = els.filterYear?.value;
  const st = els.filterStatus?.value;
  const forma = els.filterForma?.value;

  if (m) {
    list = list.filter((p) => String(p.mes) === String(m));
  }

  if (y) {
    list = list.filter((p) => String(p.ano) === String(y));
  }

  if (st) {
    const want = upper(st);
    list = list.filter((p) => upper(normalizeStatus(p)) === want);
  }

  if (forma) {
    const wantForma = upper(forma);
    list = list.filter((p) => upper(p.forma_pagamento) === wantForma);
  }

  renderPayments(list);
}
function clearFilters() {
  if (els.filterMonth) {
    els.filterMonth.value = "";
  }

  if (els.filterYear) {
    els.filterYear.value = "";
  }

  if (els.filterStatus) {
    els.filterStatus.value = "";
  }

  if (els.filterForma) {
    els.filterForma.value = "";
  }

  renderPayments(paymentsCache);
}
   // ====== EVENTS ======
  function bindEvents() {
    if (els.btnNovo) {
      els.btnNovo.addEventListener("click", async () => {
        await loadStudentsForSelect().catch(() => {});
        openModal();
      });
    }
    if (els.selStudent) {
  els.selStudent.addEventListener("change", fillPaymentValueFromSelectedStudent);
}

    if (els.btnClose) els.btnClose.addEventListener("click", closeModal);
    if (els.btnCancel) els.btnCancel.addEventListener("click", closeModal);

if (els.modal) {
  els.modal.addEventListener("click", (e) => {
    if (e.target === els.modal) closeModal();
  });
}
if (els.whatsappClose) {
  els.whatsappClose.onclick = closeWhatsAppModal;
}

if (els.whatsappCancel) {
  els.whatsappCancel.onclick = closeWhatsAppModal;
}

if (els.whatsappModal) {
  els.whatsappModal.onclick = (e) => {
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
if (els.btnFilter) {
  els.btnFilter.addEventListener("click", applyFilters);
}

if (els.btnClear) {
  els.btnClear.addEventListener("click", clearFilters);
}
if (els.form) {
  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const st = upper(els.selStatus.value);
    const isPaid = st === "PAGO";
    const formaPagamento = els.selForma?.value || "";
    if (isPaid && !formaPagamento) {
  return alert("Selecione a forma de pagamento para marcar como pago.");
}

    try {
      if (els.btnSubmit) {
        els.btnSubmit.disabled = true;
        els.btnSubmit.textContent = "Salvando...";
      }

      if (editingPaymentId) {
        const payloadUpdate = {
          valor: Number(els.inpValor.value),
forma_pagamento: isPaid ? formaPagamento : null,
          data_pagamento: isPaid ? todayISO() : null,
        };

        if (!payloadUpdate.valor || payloadUpdate.valor <= 0) {
          return alert("Informe um valor válido.");
        }

        await updatePayment(editingPaymentId, payloadUpdate);
      } else {
        //  SE NÃO ESTIVER EDITANDO: POST /payments
        const payloadCreate = {
          student_id: Number(els.selStudent.value),
          mes: Number(els.selMes.value),
          ano: Number(els.inpAno.value),
          valor: Number(els.inpValor.value),
forma_pagamento: isPaid ? formaPagamento : null,
        };

        if (!payloadCreate.student_id) return alert("Selecione um aluno.");
        if (!payloadCreate.mes) return alert("Selecione o mês.");
        if (!payloadCreate.ano) return alert("Informe o ano.");
        if (!payloadCreate.valor || payloadCreate.valor <= 0) return alert("Informe um valor válido.");

        if (isPaid) payloadCreate.data_pagamento = todayISO();

        await createPayment(payloadCreate);
      }

      closeModal();
      await loadPayments();
    } catch (err) {
      alert(err.message || "Erro ao salvar pagamento.");
    } finally {
      if (els.btnSubmit) {
        els.btnSubmit.disabled = false;
        els.btnSubmit.textContent = "Salvar";
      }
    }
  });
}

    // Delegação de clique para botões na tabela
if (els.tbody) {
  els.tbody.addEventListener("click", async (e) => {
    const btnPaid = e.target.closest(".js-mark-paid");
    const btnPending = e.target.closest(".js-mark-pending");
    const btnEdit = e.target.closest(".js-edit-payment");
    const btnWhatsApp = e.target.closest(".js-whatsapp-payment");

    if (btnWhatsApp) {
      const payment = paymentsCache.find(
        (p) => String(p.id) === String(btnWhatsApp.dataset.id)
      );

      if (!payment) {
        alert("Pagamento não encontrado.");
        return;
      }

      openPaymentWhatsApp(payment);
      return;
    }

    if (btnEdit) {
      await loadStudentsForSelect().catch(() => {});

      openEditModal({
        id: btnEdit.dataset.id,
        student_id: btnEdit.dataset.student_id,
        mes: btnEdit.dataset.mes,
        ano: btnEdit.dataset.ano,
        valor: btnEdit.dataset.valor,
        forma_pagamento: btnEdit.dataset.forma,
        data_pagamento: btnEdit.dataset.data_pagamento,
      });

      return;
    }

        if (btnPaid) {
          const id = btnPaid.dataset.id;
          const valor = btnPaid.dataset.valor;
const forma = btnPaid.dataset.forma;

          const ok = confirm("Marcar este pagamento como PAGO?");
          if (!ok) return;

          try {
            btnPaid.disabled = true;
            btnPaid.textContent = "Salvando...";

            await markPaymentAsPaid(id, valor, forma);
            await loadPayments();
          } catch (err) {
            alert(err.message || "Erro ao marcar como pago.");
            btnPaid.disabled = false;
            btnPaid.textContent = "Marcar como pago";
          }
          return;
        }

        if (btnPending) {
          const id = btnPending.dataset.id;
          const valor = btnPending.dataset.valor;
          const forma = btnPending.dataset.forma;

          const ok = confirm("Tornar este pagamento PENDENTE novamente?");
          if (!ok) return;

          try {
            btnPending.disabled = true;
            btnPending.textContent = "Salvando...";

            await markPaymentAsPending(id, valor, forma);
            await loadPayments();
          } catch (err) {
            alert(err.message || "Erro ao tornar pendente.");
            btnPending.disabled = false;
            btnPending.textContent = "Tornar pendente";
          }
        }
      });
    }
  } 

  // ====== INIT ======
bindEvents();

(async function init() {
  await loadWhatsAppSettings();
  await loadPayments();
})().catch((err) => {
  console.error(err);
  alert(err.message || "Erro ao carregar financeiro.");
});
})(); 
