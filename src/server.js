require("dotenv").config();

const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");

const db = require("./db/postgres");
const authRoutes = require("./routes/auth.routes");
const auth = require("./middlewares/auth");

const plansRoutes = require("./routes/plans");
const studentsRoutes = require("./routes/students");
const paymentsRoutes = require("./routes/payments");
const reportsRoutes = require("./routes/reports");
const attendanceRoutes = require("./routes/attendance");
const settingsRoutes = require("./routes/settings");

const app = express();

app.use(express.json());

app.use("/public", express.static(path.join(__dirname, "..", "public")));
app.use("/views", express.static(path.join(__dirname, "..", "views")));

app.use("/auth", authRoutes);

app.use("/plans", plansRoutes);
app.use("/students", studentsRoutes);
app.use("/payments", paymentsRoutes);
app.use("/reports", reportsRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/settings", settingsRoutes);

app.get("/me", auth, async (req, res) => {
  try {
    const adminId = req.user?.adminId;

    if (!adminId) {
      return res.status(401).json({
        ok: false,
        error: "Token sem adminId",
      });
    }

    const result = await db.query(
      `
      SELECT id, nome, email, created_at
      FROM public.admins
      WHERE id = $1
      `,
      [adminId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Administrador não encontrado",
      });
    }

    return res.json({
      ok: true,
      user: result.rows[0],
    });
  } catch (err) {
    console.error("GET /me error:", err);

    return res.status(500).json({
      ok: false,
      error: "Erro ao buscar dados do administrador",
    });
  }
});

app.put("/me/name", auth, async (req, res) => {
  try {
    const adminId = req.user?.adminId;
    const { nome } = req.body;

    if (!adminId) {
      return res.status(401).json({
        ok: false,
        error: "Token sem adminId",
      });
    }

    if (!nome || typeof nome !== "string" || nome.trim().length < 3) {
      return res.status(400).json({
        ok: false,
        error: "Informe um nome válido com pelo menos 3 caracteres.",
      });
    }

    const result = await db.query(
      `
      UPDATE public.admins
      SET nome = $1
      WHERE id = $2
      RETURNING id, nome, email, created_at
      `,
      [nome.trim(), adminId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Administrador não encontrado",
      });
    }

    return res.json({
      ok: true,
      user: result.rows[0],
    });
  } catch (err) {
    console.error("PUT /me/name error:", err);

    return res.status(500).json({
      ok: false,
      error: "Erro ao atualizar nome do administrador",
    });
  }
});

app.put("/me/password", auth, async (req, res) => {
  try {
    const adminId = req.user?.adminId;
    const { senha_atual, nova_senha, confirmar_senha } = req.body;

    if (!adminId) {
      return res.status(401).json({
        ok: false,
        error: "Token sem adminId",
      });
    }

    if (!senha_atual || !nova_senha || !confirmar_senha) {
      return res.status(400).json({
        ok: false,
        error: "Preencha a senha atual, a nova senha e a confirmação.",
      });
    }

    if (String(nova_senha).length < 6) {
      return res.status(400).json({
        ok: false,
        error: "A nova senha deve ter pelo menos 6 caracteres.",
      });
    }

    if (nova_senha !== confirmar_senha) {
      return res.status(400).json({
        ok: false,
        error: "A nova senha e a confirmação não conferem.",
      });
    }

    const adminResult = await db.query(
      `
      SELECT id, senha_hash
      FROM public.admins
      WHERE id = $1
      `,
      [adminId]
    );

    if (adminResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Administrador não encontrado",
      });
    }

    const admin = adminResult.rows[0];

    const senhaCorreta = await bcrypt.compare(senha_atual, admin.senha_hash);

    if (!senhaCorreta) {
      return res.status(400).json({
        ok: false,
        error: "Senha atual incorreta.",
      });
    }

    const novaSenhaHash = await bcrypt.hash(nova_senha, 10);

    await db.query(
      `
      UPDATE public.admins
      SET senha_hash = $1
      WHERE id = $2
      `,
      [novaSenhaHash, adminId]
    );

    return res.json({
      ok: true,
      message: "Senha alterada com sucesso.",
    });
  } catch (err) {
    console.error("PUT /me/password error:", err);

    return res.status(500).json({
      ok: false,
      error: "Erro ao alterar senha.",
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});



const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});