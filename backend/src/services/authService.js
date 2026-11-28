const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, erroHttp } = require('../config/db');

async function login({ login, senha }) {
  const identificador = String(login || '').trim();
  const senhaInformada = String(senha || '');

  if (!identificador || !senhaInformada) {
    throw erroHttp(400, 'Informe login e senha.');
  }

  const [linhas] = await pool.query(
    `SELECT id, nome, login, senha_hash, perfil, ativo
     FROM usuarios
     WHERE login = ?
     LIMIT 1`,
    [identificador]
  );

  const usuario = linhas[0];
  const hashComparacao = usuario?.senha_hash || '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  let senhaOk = false;
  try {
    senhaOk = await bcrypt.compare(senhaInformada, hashComparacao);
  } catch {
    senhaOk = false;
  }

  if (!usuario || !senhaOk) {
    throw erroHttp(401, 'Login ou senha inválidos.');
  }

  if (!usuario.ativo) {
    throw erroHttp(403, 'Usuário inativo.');
  }

  const payload = {
    id: usuario.id,
    nome: usuario.nome,
    perfil: usuario.perfil,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  return { token, usuario: payload };
}

module.exports = {
  login,
};
