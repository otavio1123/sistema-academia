(() => {
  const API_BASE = window.API_BASE_URL || "";
  const token = localStorage.getItem("token");
  const els = {
  filterMonth: document.querySelector("#dashboardFilterMonth"),
  filterYear: document.querySelector("#dashboardFilterYear"),
  btnApplyPeriod: document.querySelector("#btnDashboardApplyPeriod"),
  btnCurrentPeriod: document.querySelector("#btnDashboardCurrentPeriod"),
};

let selectedPeriod = getCurrentMesAno();

  // ===== Helpers =====
  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  function moneyBRL(value) {
    const n = Number(value || 0);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
function upper(value) {
  return String(value ?? "").trim().toUpperCase();
}

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

function formatDateBR(value) {
  if (!value) return "-";

  const datePart = String(value).slice(0, 10);
  const [year, month, day] = datePart.split("-");

  if (!year || !month || !day) {
    return "-";
  }

  return `${day}/${month}/${year}`;
}

function normalizePaymentStatus(payment) {
  if (payment.data_pagamento) return "PAGO";
  return "PENDENTE";
}

function getPaymentStudentName(payment) {
  return (
    payment.student_nome ??
    payment.student_name ??
    payment.aluno_nome ??
    payment.student?.nome_completo ??
    payment.student?.nome ??
    payment.aluno?.nome_completo ??
    payment.aluno?.nome ??
    "-"
  );
}
  function getCurrentMesAno() {
    const now = new Date();
    return { mes: now.getMonth() + 1, ano: now.getFullYear() };
  }
function getSelectedMesAno() {
  return selectedPeriod;
}

function fillDashboardYears() {
  if (!els.filterYear) return;

  const currentYear = new Date().getFullYear();
  const years = [];

  for (let year = currentYear - 2; year <= currentYear + 2; year++) {
    years.push(year);
  }

  els.filterYear.innerHTML = years
    .sort((a, b) => b - a)
    .map((year) => `<option value="${year}">${year}</option>`)
    .join("");
}

function syncDashboardPeriodInputs() {
  if (els.filterMonth) {
    els.filterMonth.value = String(selectedPeriod.mes);
  }

  if (els.filterYear) {
    els.filterYear.value = String(selectedPeriod.ano);
  }
}

function readDashboardPeriodInputs() {
  const mes = Number(els.filterMonth?.value);
  const ano = Number(els.filterYear?.value);

  if (!mes || mes < 1 || mes > 12) {
    alert("Selecione um mês válido.");
    return false;
  }

  if (!ano || ano < 2000) {
    alert("Selecione um ano válido.");
    return false;
  }

  selectedPeriod = { mes, ano };
  return true;
}
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  async function fetchJSON(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });

    if (res.status === 401) {
      // token inválido/expirado
      localStorage.removeItem("token");
      window.location.href = "/views/login.html";
      return null;
    }

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`Erro ${res.status} em ${path}: ${msg}`);
    }

    return res.json();
  }

  // ===== KPIs =====
  async function loadAlunosAtivos() {
    const data = await fetchJSON("/students");
    if (!data) return;

    // backend pode retornar array direto ou { students: [...] }
    const students = Array.isArray(data) ? data : (data.students || data.data || []);
    const ativos = students.filter(s => s.ativo === true);
    setText("kpiAlunosAtivos", String(ativos.length));
  }

  async function loadReceitaMes() {
   const { mes, ano } = getSelectedMesAno();

    // tentativa 1: com querystring (se seu endpoint aceitar)
    // tentativa 2: sem query (se seu backend calcular "mês atual")
    let data = null;
    try {
      data = await fetchJSON(`/reports/revenue?mes=${mes}&ano=${ano}`);
    } catch (e) {
      // fallback
      data = await fetchJSON(`/reports/revenue`);
    }
    if (!data) return;

    // formatos comuns:
    // { total: 123.45 } OU { receita: 123.45 } OU { revenue: 123.45 }
const total =
  data.total_recebido ??
  data.total ??
  data.receita ??
  data.revenue ??
  data.total_revenue ??
  0;
    setText("kpiReceitaMes", moneyBRL(total));
  }

async function loadRiscoFinanceiro() {
  const { mes, ano } = getSelectedMesAno();

  const data = await fetchJSON(`/reports/delinquents?mes=${mes}&ano=${ano}`);
  if (!data) return;

  const list = Array.isArray(data)
    ? data
    : (data.items || data.delinquents || data.data || []);

  const qtd = list.length;

  let risco = "Baixo";
  if (qtd >= 1 && qtd <= 3) risco = "Médio";
  if (qtd >= 4) risco = "Alto";

  setText("kpiRiscoFinanceiro", `${risco} (${qtd})`);
}

async function loadAssiduidadeMedia() {
  const data = await fetchJSON("/attendance");
  if (!data) return;

  const registros = Array.isArray(data)
    ? data
    : (data.items || data.attendance || data.data || []);

  if (!registros.length) {
    setText("kpiAssiduidadeMedia", "--%");
    return;
  }

  const { mes, ano } = getSelectedMesAno();

  const registrosMesAtual = registros.filter((item) => {
    if (!item.data) return false;

    const dataRegistro = new Date(item.data);
    const mesRegistro = dataRegistro.getMonth() + 1;
    const anoRegistro = dataRegistro.getFullYear();

    return mesRegistro === mes && anoRegistro === ano;
  });

  if (!registrosMesAtual.length) {
    setText("kpiAssiduidadeMedia", "--%");
    return;
  }

  const presencas = registrosMesAtual.filter((item) => item.presente === true).length;
  const total = registrosMesAtual.length;

  const percentual = Math.round((presencas / total) * 100);

  setText("kpiAssiduidadeMedia", `${percentual}%`);
}
function renderUltimosPagamentos(payments) {
  const tbody = document.getElementById("dashboardUltimosPagamentosTbody");
  if (!tbody) return;

  const list = Array.isArray(payments) ? payments.slice(0, 5) : [];

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">
          Nenhum pagamento encontrado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list
    .map((payment) => {
      const status = normalizePaymentStatus(payment);

      return `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:12px;">${getPaymentStudentName(payment)}</td>
          <td style="padding:12px;">${formatMonthYear(payment.mes, payment.ano)}</td>
          <td style="padding:12px;">${moneyBRL(payment.valor)}</td>
          <td style="padding:12px;">${formatPaymentMethod(payment.forma_pagamento)}</td>
          <td style="padding:12px;">${formatDateBR(payment.data_pagamento)}</td>
          <td style="padding:12px;">${status}</td>
        </tr>
      `;
    })
    .join("");
}
function getAttendanceStudentName(item) {
  return (
    item.student_nome ??
    item.student_name ??
    item.aluno_nome ??
    item.student?.nome_completo ??
    item.student?.nome ??
    item.aluno?.nome_completo ??
    item.aluno?.nome ??
    "-"
  );
}

function renderUltimasPresencas(records) {
  const tbody = document.getElementById("dashboardUltimasPresencasTbody");
  if (!tbody) return;

  const list = Array.isArray(records)
    ? [...records]
        .sort((a, b) => {
          const dateA = new Date(a.data || 0).getTime();
          const dateB = new Date(b.data || 0).getTime();

          if (dateA !== dateB) {
            return dateB - dateA;
          }

          return Number(b.id || 0) - Number(a.id || 0);
        })
        .slice(0, 5)
    : [];

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding:16px; color:var(--text-muted);">
          Nenhuma presença encontrada.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list
    .map((item) => {
      const status = item.presente === true ? "Presente" : "Faltou";
      const observacao = item.observacao || "-";

      return `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:12px;">${getAttendanceStudentName(item)}</td>
          <td style="padding:12px;">${formatDateBR(item.data)}</td>
          <td style="padding:12px;">${status}</td>
          <td style="padding:12px;">${observacao}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadUltimasPresencas() {
  const data = await fetchJSON("/attendance");
  if (!data) return;

  const records = Array.isArray(data)
    ? data
    : (data.items || data.attendance || data.data || []);

  const { mes, ano } = getSelectedMesAno();

  const recordsPeriodo = records.filter((item) => {
    if (!item.data) return false;

    const dataRegistro = new Date(item.data);
    const mesRegistro = dataRegistro.getMonth() + 1;
    const anoRegistro = dataRegistro.getFullYear();

    return mesRegistro === mes && anoRegistro === ano;
  });

  renderUltimasPresencas(recordsPeriodo);
}
async function loadUltimosPagamentos() {
  const data = await fetchJSON("/payments");
  if (!data) return;

  const payments = Array.isArray(data)
    ? data
    : (data.items || data.payments || data.data || []);

  const { mes, ano } = getSelectedMesAno();

  const paymentsPeriodo = payments.filter((payment) => {
    return Number(payment.mes) === Number(mes) &&
           Number(payment.ano) === Number(ano);
  });

  renderUltimosPagamentos(paymentsPeriodo);
}
async function loadDashboardData() {
  await Promise.all([
    loadAlunosAtivos(),
    loadReceitaMes(),
    loadRiscoFinanceiro(),
    loadAssiduidadeMedia(),
    loadUltimosPagamentos(),
    loadUltimasPresencas(),
  ]);
}

function bindDashboardPeriodEvents() {
  if (els.btnApplyPeriod) {
    els.btnApplyPeriod.addEventListener("click", async () => {
      if (!readDashboardPeriodInputs()) return;

      await loadDashboardData();
    });
  }

  if (els.btnCurrentPeriod) {
    els.btnCurrentPeriod.addEventListener("click", async () => {
      selectedPeriod = getCurrentMesAno();
      syncDashboardPeriodInputs();

      await loadDashboardData();
    });
  }
}
async function init() {
  try {
    fillDashboardYears();
    syncDashboardPeriodInputs();
    bindDashboardPeriodEvents();

    await loadDashboardData();
  } catch (err) {
    console.error(err);
  }
}

  document.addEventListener("DOMContentLoaded", init);
})();
