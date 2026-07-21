const express = require("express");
const router = express.Router();

const db = require("../db/postgres");
const auth = require("../middlewares/auth");

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// GET /settings
// Lista todas as configurações
router.get("/", auth, async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT id, chave, valor, created_at, updated_at
      FROM public.settings
      ORDER BY chave ASC
      `
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("GET /settings error:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao listar configurações.",
    });
  }
});

// GET /settings/:chave
// Busca uma configuração específica
router.get("/:chave", auth, async (req, res) => {
  try {
    const { chave } = req.params;

    if (!isNonEmptyString(chave)) {
      return res.status(400).json({
        ok: false,
        error: "Chave inválida.",
      });
    }

    const result = await db.query(
      `
      SELECT id, chave, valor, created_at, updated_at
      FROM public.settings
      WHERE chave = $1
      `,
      [chave.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Configuração não encontrada.",
      });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /settings/:chave error:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao buscar configuração.",
    });
  }
});

// PUT /settings/:chave
// Atualiza uma configuração
router.put("/:chave", auth, async (req, res) => {
  try {
    const { chave } = req.params;
    const { valor } = req.body;

    if (!isNonEmptyString(chave)) {
      return res.status(400).json({
        ok: false,
        error: "Chave inválida.",
      });
    }

    if (typeof valor !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Valor inválido.",
      });
    }

    const result = await db.query(
      `
      UPDATE public.settings
      SET valor = $1,
          updated_at = NOW()
      WHERE chave = $2
      RETURNING id, chave, valor, created_at, updated_at
      `,
      [valor.trim(), chave.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Configuração não encontrada.",
      });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /settings/:chave error:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao atualizar configuração.",
    });
  }
});

module.exports = router;