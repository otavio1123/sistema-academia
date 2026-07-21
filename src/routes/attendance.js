const express = require("express");
const router = express.Router();

const db = require("../db/postgres");
const auth = require("../middlewares/auth");

router.use(auth);

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

// GET /attendance?student_id=1&data=2026-06-25
router.get("/", async (req, res) => {
  try {
    const { student_id, data } = req.query;

    const params = [];
    let where = "WHERE 1=1";

    if (student_id) {
      params.push(Number(student_id));
      where += ` AND ar.student_id = $${params.length}`;
    }

    if (data) {
      params.push(data);
      where += ` AND s.data = $${params.length}`;
    }

    const result = await db.query(
      `
      SELECT
        ar.id,
        ar.session_id,
        ar.student_id,
        st.nome_completo AS aluno_nome,
        s.data,
        ar.presente,
        ar.observacao,
        ar.created_at
      FROM public.attendance_records ar
      JOIN public.attendance_sessions s
        ON s.id = ar.session_id
      JOIN public.students st
        ON st.id = ar.student_id
      ${where}
      ORDER BY s.data DESC, ar.id DESC
      `,
      params
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("GET /attendance error:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao listar registros de assiduidade"
    });
  }
});

// POST /attendance
router.post("/", async (req, res) => {
  const client = await db.pool.connect();

  try {
    const {
      student_id,
      data,
      presente = true,
      observacao = null
    } = req.body;

    const adminId = req.user?.adminId;

    if (!adminId) {
      return res.status(401).json({
        ok: false,
        error: "Token sem adminId"
      });
    }

    if (!student_id || Number.isNaN(Number(student_id))) {
      return res.status(400).json({
        ok: false,
        error: "Aluno inválido"
      });
    }

    if (!isValidDate(data)) {
      return res.status(400).json({
        ok: false,
        error: "Data inválida. Use o formato YYYY-MM-DD"
      });
    }

    const studentResult = await client.query(
      `
      SELECT id
      FROM public.students
      WHERE id = $1 AND ativo = true
      `,
      [Number(student_id)]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Aluno ativo não encontrado"
      });
    }

    await client.query("BEGIN");

    const sessionResult = await client.query(
      `
      INSERT INTO public.attendance_sessions (data, created_by)
      VALUES ($1, $2)
      ON CONFLICT (data)
      DO UPDATE SET data = EXCLUDED.data
      RETURNING id
      `,
      [data, Number(adminId)]
    );

    const sessionId = sessionResult.rows[0].id;

    const recordResult = await client.query(
      `
      INSERT INTO public.attendance_records
        (session_id, student_id, presente, observacao)
      VALUES
        ($1, $2, $3, $4)
      ON CONFLICT (session_id, student_id)
      DO UPDATE SET
        presente = EXCLUDED.presente,
        observacao = EXCLUDED.observacao
      RETURNING id, session_id, student_id, presente, observacao, created_at
      `,
      [
        sessionId,
        Number(student_id),
        Boolean(presente),
        observacao || null
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      record: recordResult.rows[0]
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error("POST /attendance error:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao registrar presença"
    });
  } finally {
    client.release();
  }
});

// PUT /attendance/:id
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { presente, observacao = null } = req.body;

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({
        ok: false,
        error: "ID inválido"
      });
    }

    if (typeof presente !== "boolean") {
      return res.status(400).json({
        ok: false,
        error: "Informe presente como true ou false"
      });
    }

    const result = await db.query(
      `
      UPDATE public.attendance_records
      SET
        presente = $1,
        observacao = $2
      WHERE id = $3
      RETURNING id, session_id, student_id, presente, observacao, created_at
      `,
      [presente, observacao || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Registro não encontrado"
      });
    }

    return res.json({
      ok: true,
      record: result.rows[0]
    });
  } catch (err) {
    console.error("PUT /attendance/:id error:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao atualizar presença"
    });
  }
});

// DELETE /attendance/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({
        ok: false,
        error: "ID inválido"
      });
    }

    const result = await db.query(
      `
      DELETE FROM public.attendance_records
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Registro não encontrado"
      });
    }

    return res.json({
      ok: true,
      deletedId: result.rows[0].id
    });
  } catch (err) {
    console.error("DELETE /attendance/:id error:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao excluir registro"
    });
  }
});

module.exports = router;