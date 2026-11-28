const { pool, erroHttp } = require('../config/db');

function validarNumero(numero) {
  const valor = Number(numero);
  if (!Number.isInteger(valor) || valor <= 0) {
    throw erroHttp(400, 'Informe um número de guichê inteiro e positivo.');
  }
  return valor;
}

function validarDescricao(descricao) {
  const texto = String(descricao || '').trim();
  if (!texto || texto.length > 80) {
    throw erroHttp(400, 'Informe uma descrição de guichê com até 80 caracteres.');
  }
  return texto;
}

function validarAtivo(ativo) {
  if (ativo === undefined) return undefined;
  if (ativo === true || ativo === 1 || ativo === '1') return 1;
  if (ativo === false || ativo === 0 || ativo === '0') return 0;
  throw erroHttp(400, 'O campo ativo deve ser 0 ou 1.');
}

function tratarDuplicidade(err) {
  if (err.code === 'ER_DUP_ENTRY') {
    throw erroHttp(409, 'Já existe um guichê com este número.');
  }
  throw err;
}

async function listar() {
  const [linhas] = await pool.query(
    'SELECT id, numero, descricao, ativo FROM guiches ORDER BY numero ASC'
  );
  return linhas;
}

async function criar({ numero, descricao, ativo }) {
  const dados = {
    numero: validarNumero(numero),
    descricao: validarDescricao(descricao),
    ativo: validarAtivo(ativo) ?? 1,
  };

  try {
    const [resultado] = await pool.query(
      'INSERT INTO guiches (numero, descricao, ativo) VALUES (?, ?, ?)',
      [dados.numero, dados.descricao, dados.ativo]
    );
    const [linhas] = await pool.query(
      'SELECT id, numero, descricao, ativo FROM guiches WHERE id = ?',
      [resultado.insertId]
    );
    return linhas[0];
  } catch (err) {
    tratarDuplicidade(err);
  }
}

async function atualizar(id, { numero, descricao, ativo }) {
  const guicheId = Number(id);
  if (!Number.isInteger(guicheId) || guicheId <= 0) {
    throw erroHttp(400, 'Identificador de guichê inválido.');
  }

  const campos = [];
  const valores = [];

  if (numero !== undefined) {
    campos.push('numero = ?');
    valores.push(validarNumero(numero));
  }
  if (descricao !== undefined) {
    campos.push('descricao = ?');
    valores.push(validarDescricao(descricao));
  }
  if (ativo !== undefined) {
    campos.push('ativo = ?');
    valores.push(validarAtivo(ativo));
  }

  if (!campos.length) {
    throw erroHttp(400, 'Informe ao menos um campo para atualizar.');
  }

  const [existente] = await pool.query('SELECT id FROM guiches WHERE id = ?', [guicheId]);
  if (!existente.length) {
    throw erroHttp(404, 'Guichê não encontrado.');
  }

  try {
    await pool.query(`UPDATE guiches SET ${campos.join(', ')} WHERE id = ?`, [...valores, guicheId]);
  } catch (err) {
    tratarDuplicidade(err);
  }

  const [linhas] = await pool.query(
    'SELECT id, numero, descricao, ativo FROM guiches WHERE id = ?',
    [guicheId]
  );
  return linhas[0];
}

module.exports = {
  listar,
  criar,
  atualizar,
};
