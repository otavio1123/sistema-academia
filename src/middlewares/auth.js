const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "Token não informado" });
    }

    const token = header.substring("Bearer ".length);
    const payload = jwt.verify(token, process.env.SESSION_SECRET);

    // deixa disponível para as rotas
    req.user = payload; // { adminId, email, iat, exp }
    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Token inválido ou expirado" });
  }
}

module.exports = auth;
