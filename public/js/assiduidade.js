// public/js/assiduidade.js

(() => {
  const TOKEN_KEY = "token";
  const API_BASE = window.API_BASE_URL || "";

  const els = {
    tbody: document.querySelector("#attendanceTbody"),
    btnNova: document.querySelector("#btnNovaPresenca"),

filterAluno: document.querySelector("#filterAluno"),
filterData: document.querySelector("#filterData"),
filterStatus: document.querySelector("#filterStatus"),
btnFilter: document.querySelector("#btnFilterAttendance"),
btnClear: document.querySelector("#btnClearAttendance"),

resumoPresencas: document.querySelector("#assiduidadeResumoPresencas"),
resumoFaltas: document.querySelector("#assiduidadeResumoFaltas"),
resumoFrequencia: document.querySelector("#assiduidadeResumoFrequencia"),
resumoTotal: document.querySelector("#assiduidadeResumoTotal"),

    modal: document.querySelector("#attendanceModal"),
    modalTitle: document.querySelector("#attendanceModalTitle"),
    form: document.querySelector("#attendanceForm"),
    btnClose: document.querySelector("#attendanceModalClose"),
    btnCancel: document.querySelector("#attendanceCancel"),
    btnSubmit: document.querySelector("#attendanceSubmit"),

    inpId: document.querySelector("#attendance_id"),
    selStudent: document.querySelector("#attendance_student_id"),
    inpData: document.querySelector("#attendance_data"),
    selPresente: document.querySelector("#attendance_presente"),
    inpObs: document.querySelector("#attendance_observacao"),
  };

  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    window.location.href = "/views/login.html";
    return;
  }

  let attendanceCache = [];
  let studentsCache = [];
  let editingAttendanceId = null;

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
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
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.error || data?.message || data || `Erro ${response.status} em ${path}`
      );
    }

    return data;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDateBR(value) {
    if (!value) return "--";

    const [year, month, day] = String(value).slice(0, 10).split("-");

    if (!year || !month || !day) return "--";

    return `${day}/${month}/${year}`;
  }

  function getStatusText(presente) {
    return presente ? "Presente" : "Faltou";
  }

  function getStatusColor(presente) {
    return presente ? "#3ddc84" : "#ff4d4d";
  }
function updateAttendanceSummary(list) {
  const records = Array.isArray(list) ? list : [];

  const total = records.length;
  const presencas = records.filter((item) => item.presente === true).length;
  const faltas = records.filter((item) => item.presente === false).length;

  const frequencia = total > 0
    ? Math.round((presencas / total) * 100)
    : 0;

  if (els.resumoPresencas) {
    els.resumoPresencas.textContent = String(presencas);
  }

  if (els.resumoFaltas) {
    els.resumoFaltas.textContent = String(faltas);
  }

  if (els.resumoFrequencia) {
    els.resumoFrequencia.textContent = `${frequencia}%`;
  }

  if (els.resumoTotal) {
    els.resumoTotal.textContent = String(total);
  }
}
function renderAttendance(list) {
  if (!els.tbody) return;

  updateAttendanceSummary(list);

  if (!list.length) {
      els.tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">
            Nenhum registro de assiduidade encontrado.
          </td>
        </tr>
      `;
      return;
    }

    els.tbody.innerHTML = list
      .map((item) => {
        const statusText = getStatusText(item.presente);
        const statusColor = getStatusColor(item.presente);

        return `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:12px;">${item.id ?? "-"}</td>
            <td style="padding:12px;">${formatDateBR(item.data)}</td>
            <td style="padding:12px;">${item.aluno_nome || "-"}</td>
            <td style="padding:12px; color:${statusColor}; font-weight:700;">
              ${statusText}
            </td>
            <td style="padding:12px;">${item.observacao || "-"}</td>
            <td style="padding:12px;">
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button 
                  class="btn btn-small btn-edit js-edit-attendance"
                  data-id="${item.id}"
                  data-student_id="${item.student_id}"
                  data-data="${String(item.data || "").slice(0, 10)}"
                  data-presente="${item.presente}"
                  data-observacao="${item.observacao || ""}"
                >
                  Editar
                </button>

                <button 
                  class="btn btn-small btn-delete js-delete-attendance"
                  data-id="${item.id}"
                >
                  Excluir
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadStudents() {
    const students = await apiFetch("/students", { method: "GET" });
    studentsCache = Array.isArray(students) ? students : students?.data || [];

    const activeStudents = studentsCache.filter((s) => s.ativo !== false);

    if (els.selStudent) {
      els.selStudent.innerHTML = `
        <option value="" disabled selected>Selecione um aluno</option>
        ${activeStudents
          .map((s) => {
            const nome = s.nome_completo || s.nome || s.name || `Aluno ${s.id}`;
            return `<option value="${s.id}">${nome}</option>`;
          })
          .join("")}
      `;
    }

    if (els.filterAluno) {
      els.filterAluno.innerHTML = `
        <option value="">Aluno</option>
        ${activeStudents
          .map((s) => {
            const nome = s.nome_completo || s.nome || s.name || `Aluno ${s.id}`;
            return `<option value="${s.id}">${nome}</option>`;
          })
          .join("")}
      `;
    }
  }

async function loadAttendance() {
  const params = new URLSearchParams();

  if (els.filterAluno?.value) {
    params.set("student_id", els.filterAluno.value);
  }

  if (els.filterData?.value) {
    params.set("data", els.filterData.value);
  }

  const query = params.toString();
  const path = query ? `/attendance?${query}` : "/attendance";

  const attendance = await apiFetch(path, { method: "GET" });
  attendanceCache = Array.isArray(attendance) ? attendance : attendance?.data || [];

  let list = [...attendanceCache];

  if (els.filterStatus?.value) {
    const wantPresente = els.filterStatus.value === "true";
    list = list.filter((item) => item.presente === wantPresente);
  }

  renderAttendance(list);
}
function clearAttendanceFilters() {
  if (els.filterAluno) {
    els.filterAluno.value = "";
  }

  if (els.filterData) {
    els.filterData.value = "";
  }

  if (els.filterStatus) {
    els.filterStatus.value = "";
  }

  loadAttendance().catch((err) => {
    console.error("ERRO LIMPAR FILTROS ASSIDUIDADE:", err);
    alert(err.message || "Erro ao limpar filtros.");
  });
}

  function openCreateModal() {
    editingAttendanceId = null;

    if (els.modalTitle) {
      els.modalTitle.textContent = "Registrar presença";
    }

    els.inpId.value = "";
    els.selStudent.value = "";
    els.inpData.value = todayISO();
    els.selPresente.value = "true";
    els.inpObs.value = "";

    els.selStudent.disabled = false;
    els.inpData.disabled = false;

    els.modal.classList.add("open");
  }

  function openEditModal(item) {
    editingAttendanceId = Number(item.id);

    if (els.modalTitle) {
      els.modalTitle.textContent = "Editar presença";
    }

    els.inpId.value = String(item.id);
    els.selStudent.value = String(item.student_id);
    els.inpData.value = String(item.data || "").slice(0, 10);
    els.selPresente.value = String(item.presente) === "true" ? "true" : "false";
    els.inpObs.value = item.observacao || "";

    els.selStudent.disabled = true;
    els.inpData.disabled = true;

    els.modal.classList.add("open");
  }

  function closeModal() {
    els.modal.classList.remove("open");

    editingAttendanceId = null;

    els.selStudent.disabled = false;
    els.inpData.disabled = false;
  }

  async function createAttendance(payload) {
    await apiFetch("/attendance", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async function updateAttendance(id, payload) {
    await apiFetch(`/attendance/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async function deleteAttendance(id) {
    await apiFetch(`/attendance/${id}`, {
      method: "DELETE",
    });
  }

  function bindEvents() {
    if (els.btnNova) {
      els.btnNova.addEventListener("click", () => {
        openCreateModal();
      });
    }

    if (els.btnClose) {
      els.btnClose.addEventListener("click", closeModal);
    }

    if (els.btnCancel) {
      els.btnCancel.addEventListener("click", closeModal);
    }

    if (els.modal) {
      els.modal.addEventListener("click", (e) => {
        if (e.target === els.modal) {
          closeModal();
        }
      });
    }

    if (els.btnFilter) {
      els.btnFilter.addEventListener("click", () => {
        loadAttendance().catch((err) => {
          console.error("ERRO FILTRO ASSIDUIDADE:", err);
          alert(err.message || "Erro ao filtrar registros.");
        });
      });
    }
if (els.btnClear) {
  els.btnClear.addEventListener("click", clearAttendanceFilters);
}
    if (els.form) {
      els.form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const presente = els.selPresente.value === "true";

        try {
          if (els.btnSubmit) {
            els.btnSubmit.disabled = true;
            els.btnSubmit.textContent = "Salvando...";
          }

          if (editingAttendanceId) {
            const payloadUpdate = {
              presente,
              observacao: els.inpObs.value.trim() || null,
            };

            await updateAttendance(editingAttendanceId, payloadUpdate);
          } else {
            const payloadCreate = {
              student_id: Number(els.selStudent.value),
              data: els.inpData.value,
              presente,
              observacao: els.inpObs.value.trim() || null,
            };

            if (!payloadCreate.student_id) {
              alert("Selecione um aluno.");
              return;
            }

            if (!payloadCreate.data) {
              alert("Informe a data.");
              return;
            }

            await createAttendance(payloadCreate);
          }

          closeModal();
          await loadAttendance();
        } catch (err) {
          console.error("ERRO SALVAR ASSIDUIDADE:", err);
          alert(err.message || "Erro ao salvar presença.");
        } finally {
          if (els.btnSubmit) {
            els.btnSubmit.disabled = false;
            els.btnSubmit.textContent = "Salvar";
          }
        }
      });
    }

    if (els.tbody) {
      els.tbody.addEventListener("click", async (e) => {
        const btnEdit = e.target.closest(".js-edit-attendance");
        const btnDelete = e.target.closest(".js-delete-attendance");

        if (btnEdit) {
          openEditModal({
            id: btnEdit.dataset.id,
            student_id: btnEdit.dataset.student_id,
            data: btnEdit.dataset.data,
            presente: btnEdit.dataset.presente,
            observacao: btnEdit.dataset.observacao,
          });
          return;
        }

        if (btnDelete) {
          const id = btnDelete.dataset.id;

          const ok = confirm("Deseja excluir este registro de presença?");
          if (!ok) return;

          try {
            btnDelete.disabled = true;
            btnDelete.textContent = "Excluindo...";

            await deleteAttendance(id);
            await loadAttendance();
          } catch (err) {
            console.error("ERRO EXCLUIR ASSIDUIDADE:", err);
            alert(err.message || "Erro ao excluir registro.");
            btnDelete.disabled = false;
            btnDelete.textContent = "Excluir";
          }
        }
      });
    }
  }

  async function init() {
    try {
      bindEvents();
      await loadStudents();
      await loadAttendance();
    } catch (err) {
      console.error("ERRO INIT ASSIDUIDADE:", err);
      alert(err.message || "Erro ao carregar assiduidade.");
    }
  }

  init();
})();