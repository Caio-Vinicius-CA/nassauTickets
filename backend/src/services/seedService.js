const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { pool } = require('../config/db');

const HASH_INICIAL_SCHEMA =
  '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQ16p1R.qT8bA5s1B6wP2z6yZ9K8W2';

const USUARIOS_PADRAO = [
  {
    nome: 'Gestor Laboratório',
    matricula: '20260001',
    login: 'gestor',
    perfil: 'GESTOR',
  },
  {
    nome: 'Atendente Padrão',
    matricula: '20260002',
    login: 'atendente1',
    perfil: 'ATENDENTE',
  },
];

const GUICHES_PADRAO = [
  [1, 'Guichê 01 - Recepção Principal'],
  [2, 'Guichê 02 - Recepção Central'],
  [3, 'Guichê 03 - Atendimento Rápido / Geral'],
];

function configuracaoAdmin() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    multipleStatements: true,
  };
}

async function aplicarSchema() {
  const arquivo = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  const sql = fs.readFileSync(arquivo, 'utf8');
  const connection = await mysql.createConnection(configuracaoAdmin());
  try {
    await connection.query(sql);
  } finally {
    await connection.end();
  }
}

async function bancoDisponivel() {
  try {
    await pool.query('SELECT 1 FROM usuarios LIMIT 1');
    return true;
  } catch (err) {
    if (err.code === 'ER_BAD_DB_ERROR' || err.code === 'ER_NO_SUCH_TABLE') {
      return false;
    }
    throw err;
  }
}

async function senhaConfere(senhaHash) {
  try {
    return await bcrypt.compare('123456', senhaHash);
  } catch {
    return false;
  }
}

async function garantirUsuariosPadrao() {
  const senhaHash = await bcrypt.hash('123456', 10);

  for (const usuario of USUARIOS_PADRAO) {
    const [linhas] = await pool.query(
      'SELECT id, senha_hash FROM usuarios WHERE login = ?',
      [usuario.login]
    );

    if (!linhas.length) {
      await pool.query(
        `INSERT INTO usuarios (nome, matricula, login, senha_hash, perfil, ativo)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [usuario.nome, usuario.matricula, usuario.login, senhaHash, usuario.perfil]
      );
      console.log(`Usuário padrão criado: ${usuario.login}`);
      continue;
    }

    const hashAtual = linhas[0].senha_hash;
    const formatoBcrypt = /^\$2[aby]\$\d{2}\$.{53}$/.test(String(hashAtual || ''));
    const senhaOk = formatoBcrypt && (await senhaConfere(hashAtual));
    const hashInicialInvalido = hashAtual === HASH_INICIAL_SCHEMA || !formatoBcrypt;

    if (!senhaOk && hashInicialInvalido) {
      await pool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [senhaHash, linhas[0].id]);
      console.log(`Hash inicial inválido corrigido para ${usuario.login}. Senha de teste: 123456`);
    }
  }
}

async function garantirGuichesPadrao() {
  const [contagem] = await pool.query('SELECT COUNT(*) AS total FROM guiches');
  if (Number(contagem[0].total) > 0) return;

  await pool.query(
    `INSERT INTO guiches (numero, descricao, ativo) VALUES (?, ?, 1), (?, ?, 1), (?, ?, 1)`,
    GUICHES_PADRAO.flat()
  );
}

async function prepararBanco() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não configurado.');
  }

  const pronto = await bancoDisponivel();
  if (!pronto) {
    await aplicarSchema();
  }

  await garantirUsuariosPadrao();
  await garantirGuichesPadrao();
}

module.exports = {
  prepararBanco,
};
