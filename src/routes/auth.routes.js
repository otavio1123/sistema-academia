const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db/postgres");

const router = express.Router();

/**
 * POST /auth/register
 * body: { nome, email, senha }
 */
router.post("/register", async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ ok: false, error: "nome, email e senha são obrigatórios" });
    }

    // Verifica se email já existe
    const exists = await db.query("select id from public.admins where email = $1", [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ ok: false, error: "E-mail já cadastrado" });
    }

    const senha_hash = await bcrypt.hash(senha, 10);

    const inserted = await db.query(
      "insert into public.admins (nome, email, senha_hash) values ($1, $2, $3) returning id, nome, email, created_at",
      [nome, email, senha_hash]
    );

    return res.json({ ok: true, admin: inserted.rows[0] });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /auth/login
 * body: { email, senha }
 */
router.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ ok: false, error: "email e senha são obrigatórios" });
    }

    const result = await db.query(
      "select id, nome, email, senha_hash from public.admins where email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ ok: false, error: "Credenciais inválidas" });
    }

    const admin = result.rows[0];
    const okSenha = await bcrypt.compare(senha, admin.senha_hash);
    if (!okSenha) {
      return res.status(401).json({ ok: false, error: "Credenciais inválidas" });
    }

    const token = jwt.sign(
      { adminId: admin.id, email: admin.email },
      process.env.SESSION_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({
      ok: true,
      token,
      admin: { id: admin.id, nome: admin.nome, email: admin.email }
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
