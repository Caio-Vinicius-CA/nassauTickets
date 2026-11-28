const bcrypt = require('bcryptjs');
const { pool, erroHttp } = require('../config/db');

const PERFIS = ['ATENDENTE', 'GESTOR'];
const COLUNAS = 'id, nome, matricula, login, perfil, ativo, criado_em';

function validarTexto(valor, campo, maximo) {
  const texto = String(valor || '').trim();
  if (!texto || texto.length > maximo) {
    throw erroHttp(400, `Informe ${campo} com até ${maximo} caracteres.`);
  }
  return texto;
}

function validarPerfil(perfil) {
  const valor = String(perfil || '').trim().toUpperCase();
  if (!PERFIS.includes(valor)) {
    throw erroHttp(400, 'Perfil inválido. Use ATENDENTE ou GESTOR.');
  }
  return valor;
}

function validarSenha(senha) {
  const valor = String(senha || '');
  if (valor.length < 6 || valor.length > 72) {
    throw erroHttp(400, 'A senha deve ter entre 6 e 72 caracteres.');
  }
  return valor;
}

function validarAtivo(ativo) {
  if (ativo === undefined) return undefined;
  if (ativo === true || ativo === 1 || ativo === '1') return 1;
  if (ativo === false || ativo === 0 || ativo === '0') return 0;
  throw erroHttp(400, 'O campo ativo deve ser 0 ou 1.');
}

function tratarDuplicidade(err) {
  if (err.code === 'ER_DUP_ENTRY') {
    const detalhe = String(err.message || '');
    if (detalhe.includes('matricula')) {
      throw erroHttp(409, 'Já existe um usuário com esta matrícula.');
    }
    throw erroHttp(409, 'Já existe um usuário com este login.');
  }
  throw err;
}

async function listar() {
  const [linhas] = await pool.query(
    `SELECT ${COLUNAS} FROM usuarios ORDER BY nome ASC`
  );
  return linhas;
}

async function criar({ nome, matricula, login, senha, perfil, ativo }) {
  const dados = {
    nome: validarTexto(nome, 'o nome', 120),
    matricula: validarTexto(matricula, 'a matrícula', 30),
    login: validarTexto(login, 'o login', 50),
    senhaHash: await bcrypt.hash(validarSenha(senha), 10),
    perfil: validarPerfil(perfil || 'ATENDENTE'),
    ativo: validarAtivo(ativo) ?? 1,
  };

  try {
    const [resultado] = await pool.query(
      `INSERT INTO usuarios (nome, matricula, login, senha_hash, perfil, ativo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dados.nome, dados.matricula, dados.login, dados.senhaHash, dados.perfil, dados.ativo]
    );
    const [linhas] = await pool.query(
      `SELECT ${COLUNAS} FROM usuarios WHERE id = ?`,
      [resultado.insertId]
    );
    return linhas[0];
  } catch (err) {
    tratarDuplicidade(err);
  }
}

async function atualizar(id, corpo) {
  const usuarioId = Number(id);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    throw erroHttp(400, 'Identificador de usuário inválido.');
  }

  const campos = [];
  const valores = [];

  if (corpo.nome !== undefined) {
    campos.push('nome = ?');
    valores.push(validarTexto(corpo.nome, 'o nome', 120));
  }
  if (corpo.matricula !== undefined) {
    campos.push('matricula = ?');
    valores.push(validarTexto(corpo.matricula, 'a matrícula', 30));
  }
  if (corpo.login !== undefined) {
    campos.push('login = ?');
    valores.push(validarTexto(corpo.login, 'o login', 50));
  }
  if (corpo.perfil !== undefined) {
    campos.push('perfil = ?');
    valores.push(validarPerfil(corpo.perfil));
  }
  if (corpo.ativo !== undefined) {
    campos.push('ativo = ?');
    valores.push(validarAtivo(corpo.ativo));
  }
  if (corpo.senha !== undefined) {
    campos.push('senha_hash = ?');
    valores.push(await bcrypt.hash(validarSenha(corpo.senha), 10));
  }

  if (!campos.length) {
    throw erroHttp(400, 'Informe ao menos um campo para atualizar.');
  }

  const [existente] = await pool.query('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
  if (!existente.length) {
    throw erroHttp(404, 'Usuário não encontrado.');
  }

  try {
    await pool.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, [...valores, usuarioId]);
  } catch (err) {
    tratarDuplicidade(err);
  }

  const [linhas] = await pool.query(`SELECT ${COLUNAS} FROM usuarios WHERE id = ?`, [usuarioId]);
  return linhas[0];
}

module.exports = {
  listar,
  criar,
  atualizar,
};
