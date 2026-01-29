const express = require("express");
const router = express.Router();

const db = require("../db/postgres");
const auth = require("../middlewares/auth");

// ==============================
// LISTAR PLANOS
// GET /plans
// ==============================
router.get("/", auth, async (req, res) => {
  try {
    const { ativo } = req.query;

    let query = `
      SELECT id, nome, valor_mensal, ativo, created_at
      FROM plans
    `;
    const params = [];

    if (ativo === "true" || ativo === "false") {
      query += " WHERE ativo = $1";
      params.push(ativo === "true");
    }

    query += " ORDER BY id ASC";

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao listar planos:", err);
    res.status(500).json({ error: "Erro ao listar planos" });
  }
});

// ==============================
// BUSCAR PLANO POR ID
// GET /plans/:id
// ==============================
router.get("/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await db.query(
      "SELECT id, nome, valor_mensal, ativo, created_at FROM plans WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Plano não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao buscar plano:", err);
    res.status(500).json({ error: "Erro ao buscar plano" });
  }
});

// ==============================
// CRIAR PLANO
// POST /plans
// ==============================
router.post("/", auth, async (req, res) => {
  try {
    const { nome, valor_mensal } = req.body;

    if (!nome || valor_mensal === undefined) {
      return res.status(400).json({
        error: "Nome e valor_mensal são obrigatórios"
      });
    }

    const result = await db.query(
      `
      INSERT INTO plans (nome, valor_mensal)
      VALUES ($1, $2)
      RETURNING id, nome, valor_mensal, ativo, created_at
      `,
      [nome, valor_mensal]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao criar plano:", err);
    res.status(500).json({ error: "Erro ao criar plano" });
  }
});

// ==============================
// ATUALIZAR PLANO
// PUT /plans/:id
// ==============================
router.put("/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, valor_mensal, ativo } = req.body;

    if (!nome || valor_mensal === undefined) {
      return res.status(400).json({
        error: "Nome e valor_mensal são obrigatórios"
      });
    }

    const result = await db.query(
      `
      UPDATE plans
      SET nome = $1,
          valor_mensal = $2,
          ativo = COALESCE($3, ativo)
      WHERE id = $4
      RETURNING id, nome, valor_mensal, ativo, created_at
      `,
      [nome, valor_mensal, ativo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Plano não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao atualizar plano:", err);
    res.status(500).json({ error: "Erro ao atualizar plano" });
  }
});

// ==============================
// ATIVAR / DESATIVAR PLANO
// PATCH /plans/:id/status
// ==============================
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { ativo } = req.body;

    if (typeof ativo !== "boolean") {
      return res.status(400).json({ error: "Campo ativo deve ser boolean" });
    }

    const result = await db.query(
      `
      UPDATE plans
      SET ativo = $1
      WHERE id = $2
      RETURNING id, nome, valor_mensal, ativo, created_at
      `,
      [ativo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Plano não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao alterar status:", err);
    res.status(500).json({ error: "Erro ao alterar status do plano" });
  }
});

// ==============================
// EXCLUSÃO LÓGICA (DESATIVAR)
// DELETE /plans/:id
// ==============================
router.delete("/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await db.query(
      `
      UPDATE plans
      SET ativo = false
      WHERE id = $1
      RETURNING id, nome, valor_mensal, ativo, created_at
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Plano não encontrado" });
    }

    res.json({
      message: "Plano desativado com sucesso",
      plano: result.rows[0]
    });
  } catch (err) {
    console.error("Erro ao desativar plano:", err);
    res.status(500).json({ error: "Erro ao desativar plano" });
  }
});

module.exports = router;
