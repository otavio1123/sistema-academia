require("dotenv").config();
const express = require("express");
const path = require("path");

const db = require("./db/postgres");
const authRoutes = require("./routes/auth.routes");
const auth = require("./middlewares/auth");

const app = express();
app.use(express.json());

// ✅ SERVIR FRONTEND (pastas fora de /src)
app.use("/public", express.static(path.join(__dirname, "..", "public")));
app.use("/views", express.static(path.join(__dirname, "..", "views")));

// 🔐 Rotas de autenticação (públicas)
app.use("/auth", authRoutes);

// ✅ Rota protegida de teste (precisa de Bearer Token)
app.get("/me", auth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Teste do banco
app.get("/db-test", async (req, res) => {
  try {
    const result = await db.query(
      "select id, nome, valor_mensal, ativo from public.plans order by id asc"
    );
    res.json({ ok: true, rows: result.rows });
  } catch (err) {
    console.error("DB ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
