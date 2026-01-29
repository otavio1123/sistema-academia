const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const { pool } = require("../db/postgres");

// GET /reports/revenue?mes=1&ano=2026
router.get("/revenue", auth, async (req, res) => {
  try {
    const mes = parseInt(req.query.mes, 10);
    const ano = parseInt(req.query.ano, 10);

    if (!mes || mes < 1 || mes > 12) {
      return res.status(400).json({ ok: false, error: "Parâmetro 'mes' inválido (1-12)." });
    }
    if (!ano || ano < 2000) {
      return res.status(400).json({ ok: false, error: "Parâmetro 'ano' inválido (>=2000)." });
    }

    const totalSql = `
      SELECT
        COALESCE(SUM(valor), 0) AS total_recebido,
        COUNT(*)::int           AS qtd_pagamentos
      FROM payments
      WHERE mes = $1
        AND ano = $2
        AND data_pagamento IS NOT NULL;
    `;

    const byMethodSql = `
      SELECT
        COALESCE(forma_pagamento, 'N/A') AS forma_pagamento,
        COALESCE(SUM(valor), 0)          AS total,
        COUNT(*)::int                    AS qtd
      FROM payments
      WHERE mes = $1
        AND ano = $2
        AND data_pagamento IS NOT NULL
      GROUP BY COALESCE(forma_pagamento, 'N/A')
      ORDER BY total DESC;
    `;

    const totalResult = await pool.query(totalSql, [mes, ano]);
    const methodResult = await pool.query(byMethodSql, [mes, ano]);

    const row = totalResult.rows[0];

    return res.json({
      ok: true,
      periodo: { mes, ano },
      total_recebido: row.total_recebido,
      qtd_pagamentos: row.qtd_pagamentos,
      por_forma_pagamento: methodResult.rows
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Erro ao gerar relatório de receita." });
  }
});

// GET /reports/delinquents?mes=2&ano=2026
router.get("/delinquents", auth, async (req, res) => {
  try {
    const mes = parseInt(req.query.mes, 10);
    const ano = parseInt(req.query.ano, 10);

    if (!mes || mes < 1 || mes > 12) {
      return res.status(400).json({ ok: false, error: "Parâmetro 'mes' inválido (1-12)." });
    }
    if (!ano || ano < 2000) {
      return res.status(400).json({ ok: false, error: "Parâmetro 'ano' inválido (>=2000)." });
    }

    const sql = `
      SELECT
        s.id::text      AS student_id,
        s.nome_completo AS student_nome,
        p.id::text      AS payment_id,
        p.mes,
        p.ano,
        p.valor,
        p.forma_pagamento,
        p.data_pagamento
      FROM payments p
      JOIN students s ON s.id = p.student_id
      WHERE p.mes = $1
        AND p.ano = $2
        AND p.data_pagamento IS NULL
        AND s.ativo = true
      ORDER BY s.nome_completo;
    `;

    const result = await pool.query(sql, [mes, ano]);

    return res.json({
      ok: true,
      periodo: { mes, ano },
      qtd: result.rows.length,
      items: result.rows
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Erro ao listar inadimplentes." });
  }
});

module.exports = router;
