const express = require("express");
const router = express.Router();

const db = require("../db/postgres");
const auth = require("../middlewares/auth");

// Helpers
function toInt(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}
function toMoney(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * GET /payments
 * Filtros opcionais:
 *  - ?student_id=1
 *  - ?mes=1..12
 *  - ?ano=2026
 *  - ?paid=true|false   (true => data_pagamento IS NOT NULL)
 */
router.get("/", auth, async (req, res) => {
  try {
    const { student_id, mes, ano, paid } = req.query;

    const where = [];
    const params = [];

    if (student_id !== undefined) {
      const sid = toInt(student_id);
      if (!sid || sid <= 0) return res.status(400).json({ ok: false, error: "student_id inválido." });
      params.push(sid);
      where.push(`p.student_id = $${params.length}`);
    }

    if (mes !== undefined) {
      const m = toInt(mes);
      if (!m || m < 1 || m > 12) return res.status(400).json({ ok: false, error: "mes inválido (1-12)." });
      params.push(m);
      where.push(`p.mes = $${params.length}`);
    }

    if (ano !== undefined) {
      const y = toInt(ano);
      if (!y || y < 2000) return res.status(400).json({ ok: false, error: "ano inválido (>= 2000)." });
      params.push(y);
      where.push(`p.ano = $${params.length}`);
    }

    if (paid === "true") where.push(`p.data_pagamento IS NOT NULL`);
    if (paid === "false") where.push(`p.data_pagamento IS NULL`);

    const sql = `
      SELECT
        p.id,
        p.student_id,
        s.nome_completo AS student_nome,
        p.mes,
        p.ano,
        p.valor,
        p.forma_pagamento,
        p.data_pagamento,
        p.created_at,
        p.created_by,
        a.nome AS admin_nome
      FROM public.payments p
      JOIN public.students s ON s.id = p.student_id
      JOIN public.admins a ON a.id = p.created_by
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY p.ano DESC, p.mes DESC, p.id DESC
    `;

    const result = await db.query(sql, params);
    return res.json(result.rows);
  } catch (err) {
    console.error("GET /payments error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao listar pagamentos." });
  }
});

/**
 * GET /payments/:id
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id || id <= 0) return res.status(400).json({ ok: false, error: "ID inválido." });

    const result = await db.query(
      `
      SELECT
        p.id,
        p.student_id,
        s.nome_completo AS student_nome,
        p.mes,
        p.ano,
        p.valor,
        p.forma_pagamento,
        p.data_pagamento,
        p.created_at,
        p.created_by,
        a.nome AS admin_nome
      FROM public.payments p
      JOIN public.students s ON s.id = p.student_id
      JOIN public.admins a ON a.id = p.created_by
      WHERE p.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ ok: false, error: "Pagamento não encontrado." });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /payments/:id error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao buscar pagamento." });
  }
});

/**
 * POST /payments
 * Body:
 * {
 *   "student_id": 1,
 *   "mes": 1,
 *   "ano": 2026,
 *   "valor": 99.90,
 *   "forma_pagamento": "PIX",
 *   "data_pagamento": "2026-01-27"   // opcional (se não mandar, vira pendente)
 * }
 *
 * created_by vem do token (req.user.adminId)
 */
router.post("/", auth, async (req, res) => {
  try {
    const { student_id, mes, ano, valor, forma_pagamento, data_pagamento } = req.body;

    const sid = toInt(student_id);
    if (!sid || sid <= 0) return res.status(400).json({ ok: false, error: "student_id é obrigatório e válido." });

    const m = toInt(mes);
    if (!m || m < 1 || m > 12) return res.status(400).json({ ok: false, error: "mes é obrigatório (1-12)." });

    const y = toInt(ano);
    if (!y || y < 2000) return res.status(400).json({ ok: false, error: "ano é obrigatório (>= 2000)." });

    const v = toMoney(valor);
    if (v === null || v < 0) return res.status(400).json({ ok: false, error: "valor é obrigatório (>= 0)." });

    const adminId = toInt(req.user?.adminId);
    if (!adminId) return res.status(401).json({ ok: false, error: "Token sem adminId." });

    // valida se aluno existe e está ativo
    const studentCheck = await db.query("SELECT id, ativo FROM public.students WHERE id = $1", [sid]);
    if (studentCheck.rows.length === 0) return res.status(400).json({ ok: false, error: "student_id não existe." });
    if (studentCheck.rows[0].ativo !== true) return res.status(400).json({ ok: false, error: "Aluno inativo não pode receber pagamento." });

    // Insere
    const result = await db.query(
      `
      INSERT INTO public.payments (student_id, mes, ano, valor, forma_pagamento, data_pagamento, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, student_id, mes, ano, valor, forma_pagamento, data_pagamento, created_at, created_by
      `,
      [
        sid,
        m,
        y,
        v,
        isNonEmptyString(forma_pagamento) ? forma_pagamento.trim() : null,
        isNonEmptyString(data_pagamento) ? data_pagamento : null,
        adminId,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /payments error:", err);

    // Se você tiver índice único (student_id, mes, ano), cai aqui:
    if (err.code === "23505") {
      return res.status(409).json({ ok: false, error: "Já existe pagamento lançado para este aluno neste mês/ano." });
    }

    return res.status(500).json({ ok: false, error: "Erro ao criar pagamento." });
  }
});

/**
 * PUT /payments/:id
 * Atualiza pagamento
 * Body:
 * {
 *   "valor": 120.00,
 *   "forma_pagamento": "Cartão",
 *   "data_pagamento": "2026-01-27" // pode setar ou limpar (null)
 * }
 */
router.put("/:id", auth, async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id || id <= 0) return res.status(400).json({ ok: false, error: "ID inválido." });

    const { valor, forma_pagamento, data_pagamento } = req.body;

    const v = toMoney(valor);
    if (v === null || v < 0) return res.status(400).json({ ok: false, error: "valor é obrigatório (>= 0)." });

    const result = await db.query(
      `
      UPDATE public.payments
      SET
        valor = $1,
        forma_pagamento = $2,
        data_pagamento = $3
      WHERE id = $4
      RETURNING id, student_id, mes, ano, valor, forma_pagamento, data_pagamento, created_at, created_by
      `,
      [
        v,
        isNonEmptyString(forma_pagamento) ? forma_pagamento.trim() : null,
        data_pagamento === null ? null : (isNonEmptyString(data_pagamento) ? data_pagamento : null),
        id,
      ]
    );

    if (result.rows.length === 0) return res.status(404).json({ ok: false, error: "Pagamento não encontrado." });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /payments/:id error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao atualizar pagamento." });
  }
});

module.exports = router;
