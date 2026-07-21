const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const db = require("../db/postgres");

function toInt(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function validarPeriodo(req, res) {
  const mes = toInt(req.query.mes);
  const ano = toInt(req.query.ano);

  if (!mes || mes < 1 || mes > 12) {
    res.status(400).json({ ok: false, error: "Parâmetro 'mes' inválido (1-12)." });
    return null;
  }

  if (!ano || ano < 2000) {
    res.status(400).json({ ok: false, error: "Parâmetro 'ano' inválido (>=2000)." });
    return null;
  }

  return { mes, ano };
}

// GET /reports/revenue?mes=1&ano=2026
router.get("/revenue", auth, async (req, res) => {
  try {
    const periodo = validarPeriodo(req, res);
    if (!periodo) return;

    const { mes, ano } = periodo;

    const totalSql = `
      SELECT
        COALESCE(SUM(valor), 0) AS total_recebido,
        COUNT(*)::int AS qtd_pagamentos
      FROM public.payments
      WHERE mes = $1
        AND ano = $2
        AND data_pagamento IS NOT NULL
    `;

    const byMethodSql = `
      SELECT
        COALESCE(forma_pagamento, 'N/A') AS forma_pagamento,
        COALESCE(SUM(valor), 0) AS total,
        COUNT(*)::int AS qtd
      FROM public.payments
      WHERE mes = $1
        AND ano = $2
        AND data_pagamento IS NOT NULL
      GROUP BY COALESCE(forma_pagamento, 'N/A')
      ORDER BY total DESC
    `;

    const totalResult = await db.query(totalSql, [mes, ano]);
    const methodResult = await db.query(byMethodSql, [mes, ano]);

    const row = totalResult.rows[0];

    return res.json({
      ok: true,
      periodo: { mes, ano },
      total_recebido: row.total_recebido,
      qtd_pagamentos: row.qtd_pagamentos,
      por_forma_pagamento: methodResult.rows
    });
  } catch (err) {
    console.error("GET /reports/revenue error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao gerar relatório de receita." });
  }
});

// GET /reports/delinquents?mes=2&ano=2026
router.get("/delinquents", auth, async (req, res) => {
  try {
    const periodo = validarPeriodo(req, res);
    if (!periodo) return;

    const { mes, ano } = periodo;

    const sql = `
      SELECT
        s.id AS student_id,
        s.nome_completo AS student_nome,
        s.cpf,
        s.telefone,
        s.email,
        s.plan_id AS plano_id,
        pl.nome AS plano_nome,
        p.id AS payment_id,
        p.mes,
        p.ano,
        p.valor,
        p.forma_pagamento,
        p.data_pagamento,
        CASE
          WHEN p.id IS NULL THEN 'SEM_LANCAMENTO'
          WHEN p.data_pagamento IS NULL THEN 'PENDENTE'
          ELSE 'PAGO'
        END AS status_financeiro
      FROM public.students s
      LEFT JOIN public.plans pl ON pl.id = s.plan_id
      LEFT JOIN public.payments p
        ON p.student_id = s.id
       AND p.mes = $1
       AND p.ano = $2
      WHERE s.ativo = true
        AND (
          p.id IS NULL
          OR p.data_pagamento IS NULL
        )
      ORDER BY s.nome_completo ASC
    `;

    const result = await db.query(sql, [mes, ano]);

    return res.json({
      ok: true,
      periodo: { mes, ano },
      qtd: result.rows.length,
      items: result.rows
    });
  } catch (err) {
    console.error("GET /reports/delinquents error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao listar inadimplentes." });
  }
});

module.exports = router;