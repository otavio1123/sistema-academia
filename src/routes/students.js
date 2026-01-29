const express = require("express");
const router = express.Router();

const db = require("../db/postgres");
const auth = require("../middlewares/auth");

// Helpers
function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}
function toInt(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

/**
 * GET /students
 * Query opcional:
 *  - ?ativo=true|false
 *  - ?search=texto (nome ou cpf)
 */
router.get("/", auth, async (req, res) => {
  try {
    const { ativo, search } = req.query;

    const where = [];
    const params = [];

    if (ativo === "true" || ativo === "false") {
      params.push(ativo === "true");
      where.push(`s.ativo = $${params.length}`);
    }

    if (isNonEmptyString(search)) {
      const q = search.trim();
      const cpfDigits = onlyDigits(q);

      params.push(`%${q}%`);
      params.push(`%${cpfDigits}%`);

      where.push(
        `(s.nome_completo ILIKE $${params.length - 1} OR s.cpf LIKE $${params.length})`
      );
    }

    const sql = `
      SELECT
        s.id,
        s.nome_completo AS nome,
        s.cpf,
        s.telefone,
        s.email,
        s.plan_id AS plano_id,
        p.nome AS plano_nome,
        s.data_inicio,
        s.ativo,
        s.created_at
      FROM public.students s
      LEFT JOIN public.plans p ON p.id = s.plan_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY s.id ASC
    `;

    const result = await db.query(sql, params);
    return res.json(result.rows);
  } catch (err) {
    console.error("GET /students error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao listar alunos." });
  }
});

/**
 * GET /students/:id
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ ok: false, error: "ID inválido." });
    }

    const result = await db.query(
      `
      SELECT
        s.id,
        s.nome_completo AS nome,
        s.cpf,
        s.telefone,
        s.email,
        s.plan_id AS plano_id,
        p.nome AS plano_nome,
        s.data_inicio,
        s.ativo,
        s.created_at
      FROM public.students s
      LEFT JOIN public.plans p ON p.id = s.plan_id
      WHERE s.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Aluno não encontrado." });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /students/:id error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao buscar aluno." });
  }
});

/**
 * POST /students
 * Body (aceita PT e EN para compatibilidade):
 * {
 *   "nome": "...",            // ou "nome_completo"
 *   "cpf": "12345678901",
 *   "telefone": "...",
 *   "email": "...",
 *   "plano_id": 2,           // ou "plan_id"
 *   "data_inicio": "2026-01-26"
 * }
 *
 * IMPORTANTE: no seu banco, plan_id e data_inicio são NOT NULL.
 */
router.post("/", auth, async (req, res) => {
  try {
    const {
      nome,
      nome_completo,
      cpf,
      telefone,
      email,
      plano_id,
      plan_id,
      data_inicio,
    } = req.body;

    const nomeFinal = isNonEmptyString(nome) ? nome : nome_completo;

    if (!isNonEmptyString(nomeFinal)) {
      return res.status(400).json({ ok: false, error: "Campo 'nome' é obrigatório." });
    }

    const cpfDigits = onlyDigits(cpf);
    if (cpfDigits.length !== 11) {
      return res.status(400).json({ ok: false, error: "CPF inválido. Envie 11 dígitos." });
    }

    // No banco é NOT NULL: exige plano
    const planoIdRaw = plano_id ?? plan_id;
    const planoId = toInt(planoIdRaw);

    if (!planoId || planoId <= 0) {
      return res.status(400).json({ ok: false, error: "plano_id é obrigatório e deve ser válido." });
    }

    // No banco é NOT NULL: exige data_inicio
    if (!isNonEmptyString(data_inicio)) {
      return res.status(400).json({ ok: false, error: "data_inicio é obrigatório (YYYY-MM-DD)." });
    }

    // Validar se plano existe e está ativo
    const planCheck = await db.query("SELECT id, ativo FROM public.plans WHERE id = $1", [planoId]);

    if (planCheck.rows.length === 0) {
      return res.status(400).json({ ok: false, error: "plano_id não existe." });
    }
    if (planCheck.rows[0].ativo !== true) {
      return res.status(400).json({ ok: false, error: "Não é permitido vincular a plano inativo." });
    }

    const insert = await db.query(
      `
      INSERT INTO public.students (nome_completo, cpf, telefone, email, plan_id, data_inicio, ativo)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING
        id,
        nome_completo AS nome,
        cpf,
        telefone,
        email,
        plan_id AS plano_id,
        data_inicio,
        ativo,
        created_at
      `,
      [
        nomeFinal.trim(),
        cpfDigits,
        telefone ? String(telefone).trim() : null,
        email ? String(email).trim().toLowerCase() : null,
        planoId,
        data_inicio, // YYYY-MM-DD
      ]
    );

    return res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error("POST /students error:", err);

    // CPF duplicado (se você criou índice único parcial)
    if (err.code === "23505") {
      return res.status(409).json({ ok: false, error: "Já existe um aluno ativo com este CPF." });
    }

    return res.status(500).json({ ok: false, error: "Erro ao criar aluno." });
  }
});

/**
 * PUT /students/:id
 * Atualiza aluno
 */
router.put("/:id", auth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ ok: false, error: "ID inválido." });
    }

    const {
      nome,
      nome_completo,
      cpf,
      telefone,
      email,
      plano_id,
      plan_id,
      data_inicio,
      ativo,
    } = req.body;

    const nomeFinal = isNonEmptyString(nome) ? nome : nome_completo;

    if (!isNonEmptyString(nomeFinal)) {
      return res.status(400).json({ ok: false, error: "Campo 'nome' é obrigatório." });
    }

    const cpfDigits = onlyDigits(cpf);
    if (cpfDigits.length !== 11) {
      return res.status(400).json({ ok: false, error: "CPF inválido. Envie 11 dígitos." });
    }

    const planoIdRaw = plano_id ?? plan_id;
    const planoId = toInt(planoIdRaw);
    if (!planoId || planoId <= 0) {
      return res.status(400).json({ ok: false, error: "plano_id é obrigatório e deve ser válido." });
    }

    if (!isNonEmptyString(data_inicio)) {
      return res.status(400).json({ ok: false, error: "data_inicio é obrigatório (YYYY-MM-DD)." });
    }

    // Validar se plano existe e está ativo
    const planCheck = await db.query("SELECT id, ativo FROM public.plans WHERE id = $1", [planoId]);
    if (planCheck.rows.length === 0) {
      return res.status(400).json({ ok: false, error: "plano_id não existe." });
    }
    if (planCheck.rows[0].ativo !== true) {
      return res.status(400).json({ ok: false, error: "Não é permitido vincular a plano inativo." });
    }

    const ativoBool = typeof ativo === "boolean" ? ativo : null;

    const result = await db.query(
      `
      UPDATE public.students
      SET
        nome_completo = $1,
        cpf = $2,
        telefone = $3,
        email = $4,
        plan_id = $5,
        data_inicio = $6,
        ativo = COALESCE($7, ativo)
      WHERE id = $8
      RETURNING
        id,
        nome_completo AS nome,
        cpf,
        telefone,
        email,
        plan_id AS plano_id,
        data_inicio,
        ativo,
        created_at
      `,
      [
        nomeFinal.trim(),
        cpfDigits,
        telefone ? String(telefone).trim() : null,
        email ? String(email).trim().toLowerCase() : null,
        planoId,
        data_inicio,
        ativoBool,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Aluno não encontrado." });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /students/:id error:", err);

    if (err.code === "23505") {
      return res.status(409).json({ ok: false, error: "Já existe um aluno ativo com este CPF." });
    }

    return res.status(500).json({ ok: false, error: "Erro ao atualizar aluno." });
  }
});

/**
 * DELETE /students/:id
 * Exclusão lógica: desativa e registra deleted_at / deleted_by (se existir req.user.adminId)
 */
router.delete("/:id", auth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ ok: false, error: "ID inválido." });
    }

    const adminId = req.user?.adminId ? String(req.user.adminId) : null;

    const result = await db.query(
      `
      UPDATE public.students
      SET
        ativo = false,
        deleted_at = NOW(),
        deleted_by = $2
      WHERE id = $1
      RETURNING
        id,
        nome_completo AS nome,
        cpf,
        telefone,
        email,
        plan_id AS plano_id,
        data_inicio,
        ativo,
        deleted_at,
        deleted_by,
        created_at
      `,
      [id, adminId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Aluno não encontrado." });
    }

    return res.json({
      message: "Aluno desativado com sucesso (exclusão lógica).",
      student: result.rows[0],
    });
  } catch (err) {
    console.error("DELETE /students/:id error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao desativar aluno." });
  }
});

module.exports = router;
