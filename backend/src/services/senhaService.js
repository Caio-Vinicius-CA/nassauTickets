const { pool, transacao, erroHttp } = require('../config/db');

const TIPOS = ['SP', 'SE', 'SG'];
const STATUS_CHAMADOS = ['CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO', 'ATENDIDA'];

function modoSimulacao() {
  return String(process.env.MODO_SIMULACAO || '').trim().toLowerCase() === 'true';
}

function dentroDoExpediente(agora = new Date()) {
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  return minutos >= 7 * 60 && minutos <= 17 * 60;
}

function normalizarTipo(tipo) {
  const valor = String(tipo || '').trim().toUpperCase();
  if (!TIPOS.includes(valor)) {
    throw erroHttp(400, 'Tipo inválido. Use SP, SE ou SG.');
  }
  return valor;
}

function maisAntiga(fila, tipo) {
  return fila
    .filter((senha) => senha.tipo === tipo)
    .sort((a, b) => a.sequencia - b.sequencia || a.id - b.id)[0] || null;
}

/**
 * Ciclo [SP] -> [SE|SG] -> [SP] -> [SE|SG].
 * Se a última chamada do dia não foi SP e existe SP na fila, chama SP.
 * Caso contrário chama SE, depois SG e, se as demais filas estiverem vazias, SP.
 */
function selecionarProxima(aguardando, ultimoTipo) {
  const sp = maisAntiga(aguardando, 'SP');
  const se = maisAntiga(aguardando, 'SE');
  const sg = maisAntiga(aguardando, 'SG');

  if (ultimoTipo !== 'SP' && sp) return sp;
  if (se) return se;
  if (sg) return sg;
  if (sp) return sp;
  return null;
}

async function registrarAuditoria(connection, { senhaId, atendenteId, guicheId, acao, statusAnterior, statusNovo }) {
  await connection.query(
    `INSERT INTO auditoria_chamadas
      (senha_id, atendente_id, guiche_id, acao, status_anterior, status_novo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [senhaId, atendenteId ?? null, guicheId ?? null, acao, statusAnterior ?? null, statusNovo]
  );
}

async function buscarSenhaCompleta(connection, id) {
  const [linhas] = await connection.query(
    `SELECT s.*, g.numero AS guiche_numero, g.descricao AS guiche_descricao
     FROM senhas s
     LEFT JOIN guiches g ON g.id = s.guiche_id
     WHERE s.id = ?`,
    [id]
  );
  return linhas[0] || null;
}

async function emitir({ tipo }) {
  const tipoNormalizado = normalizarTipo(tipo);

  if (!modoSimulacao() && !dentroDoExpediente()) {
    throw erroHttp(403, 'Emissão permitida apenas no expediente, das 07:00 às 17:00.');
  }

  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await transacao(async (connection) => {
        const [datas] = await connection.query(
          `SELECT CURDATE() AS hoje, DATE_FORMAT(CURDATE(), '%y%m%d') AS prefixo`
        );
        const { hoje, prefixo } = datas[0];

        const [atuais] = await connection.query(
          `SELECT sequencia
           FROM senhas
           WHERE data_emissao = ? AND tipo = ?
           ORDER BY sequencia DESC
           LIMIT 1
           FOR UPDATE`,
          [hoje, tipoNormalizado]
        );

        const sequencia = (atuais[0]?.sequencia || 0) + 1;
        if (sequencia > 999) {
          throw erroHttp(409, 'Limite diário de 999 senhas atingido para este tipo.');
        }

        const codigo = `${prefixo}-${tipoNormalizado}${String(sequencia).padStart(3, '0')}`;
        const [insercao] = await connection.query(
          `INSERT INTO senhas (codigo, data_emissao, tipo, sequencia, status)
           VALUES (?, ?, ?, ?, 'AGUARDANDO')`,
          [codigo, hoje, tipoNormalizado, sequencia]
        );

        await registrarAuditoria(connection, {
          senhaId: insercao.insertId,
          acao: 'EMISSAO',
          statusAnterior: null,
          statusNovo: 'AGUARDANDO',
        });

        return buscarSenhaCompleta(connection, insercao.insertId);
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' && tentativa < 3) continue;
      throw err;
    }
  }

  throw erroHttp(409, 'Não foi possível gerar o código da senha. Tente novamente.');
}

async function chamarProxima({ guicheId, atendenteId }) {
  const guiche = Number(guicheId);
  if (!Number.isInteger(guiche) || guiche <= 0) {
    throw erroHttp(400, 'Informe um guiche_id válido.');
  }

  return transacao(async (connection) => {
    const [guiches] = await connection.query(
      'SELECT id, numero, ativo FROM guiches WHERE id = ? FOR UPDATE',
      [guiche]
    );

    if (!guiches.length || !guiches[0].ativo) {
      throw erroHttp(400, 'Guichê inválido ou inativo.');
    }

    const [aguardando] = await connection.query(
      `SELECT id, tipo, sequencia
       FROM senhas
       WHERE status = 'AGUARDANDO' AND data_emissao = CURDATE()
       ORDER BY id
       FOR UPDATE`
    );

    if (!aguardando.length) {
      throw erroHttp(404, 'Não há senhas aguardando atendimento.');
    }

    const [ultimas] = await connection.query(
      `SELECT id, tipo
       FROM senhas
       WHERE data_emissao = CURDATE() AND primeira_chamada_em IS NOT NULL
       ORDER BY primeira_chamada_em DESC, id DESC
       LIMIT 1
       FOR UPDATE`
    );

    const escolhida = selecionarProxima(aguardando, ultimas[0]?.tipo ?? null);
    if (!escolhida) {
      throw erroHttp(404, 'Não há senhas aguardando atendimento.');
    }

    await connection.query(
      `UPDATE senhas
       SET status = 'CHAMADA',
           primeira_chamada_em = NOW(),
           guiche_id = ?,
           atendente_id = ?
       WHERE id = ? AND status = 'AGUARDANDO'`,
      [guiche, atendenteId, escolhida.id]
    );

    await registrarAuditoria(connection, {
      senhaId: escolhida.id,
      atendenteId,
      guicheId: guiche,
      acao: 'CHAMADA',
      statusAnterior: 'AGUARDANDO',
      statusNovo: 'CHAMADA',
    });

    return buscarSenhaCompleta(connection, escolhida.id);
  });
}

const ATUALIZACAO_TEMPO = {
  segunda_chamada_em: 'UPDATE senhas SET status = ?, segunda_chamada_em = NOW() WHERE id = ?',
  inicio_atendimento_em: 'UPDATE senhas SET status = ?, inicio_atendimento_em = NOW() WHERE id = ?',
  fim_atendimento_em: 'UPDATE senhas SET status = ?, fim_atendimento_em = NOW() WHERE id = ?',
};

async function transicionar(id, { statusPermitidos, statusNovo, campoTempo, acao, atendenteId }) {
  const senhaId = Number(id);
  if (!Number.isInteger(senhaId) || senhaId <= 0) {
    throw erroHttp(400, 'Identificador de senha inválido.');
  }

  const sqlTempo = ATUALIZACAO_TEMPO[campoTempo];
  if (!sqlTempo) {
    throw erroHttp(500, 'Transição de senha mal configurada.');
  }

  return transacao(async (connection) => {
    const [linhas] = await connection.query(
      `SELECT id, status, guiche_id, atendente_id, primeira_chamada_em
       FROM senhas
       WHERE id = ?
       FOR UPDATE`,
      [senhaId]
    );

    const senha = linhas[0];
    if (!senha) {
      throw erroHttp(404, 'Senha não encontrada.');
    }

    if (!statusPermitidos.includes(senha.status)) {
      throw erroHttp(409, `A senha está em ${senha.status} e não pode ir para ${statusNovo}.`);
    }

    await connection.query(sqlTempo, [statusNovo, senhaId]);

    await registrarAuditoria(connection, {
      senhaId,
      atendenteId,
      guicheId: senha.guiche_id,
      acao,
      statusAnterior: senha.status,
      statusNovo,
    });

    return buscarSenhaCompleta(connection, senhaId);
  });
}

function rechamar(id, atendenteId) {
  return transicionar(id, {
    statusPermitidos: ['CHAMADA'],
    statusNovo: 'CHAMADA_NOVAMENTE',
    campoTempo: 'segunda_chamada_em',
    acao: 'RECHAMADA',
    atendenteId,
  });
}

function iniciar(id, atendenteId) {
  return transicionar(id, {
    statusPermitidos: ['CHAMADA', 'CHAMADA_NOVAMENTE'],
    statusNovo: 'EM_ATENDIMENTO',
    campoTempo: 'inicio_atendimento_em',
    acao: 'INICIO_ATENDIMENTO',
    atendenteId,
  });
}

function finalizar(id, atendenteId) {
  return transicionar(id, {
    statusPermitidos: ['EM_ATENDIMENTO'],
    statusNovo: 'ATENDIDA',
    campoTempo: 'fim_atendimento_em',
    acao: 'FIM_ATENDIMENTO',
    atendenteId,
  });
}

function naoCompareceu(id, atendenteId) {
  return transacao(async (connection) => {
    const senhaId = Number(id);
    if (!Number.isInteger(senhaId) || senhaId <= 0) {
      throw erroHttp(400, 'Identificador de senha inválido.');
    }

    const [linhas] = await connection.query(
      `SELECT id, status, guiche_id, primeira_chamada_em
       FROM senhas
       WHERE id = ?
       FOR UPDATE`,
      [senhaId]
    );

    const senha = linhas[0];
    if (!senha) {
      throw erroHttp(404, 'Senha não encontrada.');
    }

    if (!senha.primeira_chamada_em) {
      throw erroHttp(409, 'A senha precisa ter sido chamada antes de registrar não comparecimento.');
    }

    if (!['CHAMADA', 'CHAMADA_NOVAMENTE'].includes(senha.status)) {
      throw erroHttp(409, `A senha está em ${senha.status} e não pode ser marcada como não compareceu.`);
    }

    await connection.query(
      `UPDATE senhas SET status = 'NAO_COMPARECEU' WHERE id = ?`,
      [senhaId]
    );

    await registrarAuditoria(connection, {
      senhaId,
      atendenteId,
      guicheId: senha.guiche_id,
      acao: 'NAO_COMPARECEU',
      statusAnterior: senha.status,
      statusNovo: 'NAO_COMPARECEU',
    });

    return buscarSenhaCompleta(connection, senhaId);
  });
}

async function encerrarExpediente(atendenteId) {
  return transacao(async (connection) => {
    const [senhas] = await connection.query(
      `SELECT id, status, guiche_id
       FROM senhas
       WHERE status = 'AGUARDANDO'
       ORDER BY id
       FOR UPDATE`
    );

    for (const senha of senhas) {
      await connection.query(
        `UPDATE senhas SET status = 'DESCARTADA' WHERE id = ?`,
        [senha.id]
      );
      await registrarAuditoria(connection, {
        senhaId: senha.id,
        atendenteId,
        guicheId: senha.guiche_id,
        acao: 'DESCARTE_EXPEDIENTE',
        statusAnterior: 'AGUARDANDO',
        statusNovo: 'DESCARTADA',
      });
    }

    return { descartadas: senhas.length };
  });
}

async function painel() {
  const [linhas] = await pool.query(
    `SELECT
       s.id,
       s.codigo,
       s.tipo,
       s.status,
       s.primeira_chamada_em,
       s.segunda_chamada_em,
       g.numero AS guiche_numero,
       g.descricao AS guiche_descricao
     FROM senhas s
     LEFT JOIN guiches g ON g.id = s.guiche_id
     WHERE s.status IN (?, ?, ?, ?)
     ORDER BY COALESCE(s.segunda_chamada_em, s.primeira_chamada_em) DESC, s.id DESC
     LIMIT 5`,
    STATUS_CHAMADOS
  );

  return {
    senhas: linhas.map((senha) => ({
      id: senha.id,
      codigo: senha.codigo,
      tipo: senha.tipo,
      status: senha.status,
      guiche_numero: senha.guiche_numero,
      guiche_descricao: senha.guiche_descricao,
      primeira_chamada_em: senha.primeira_chamada_em,
      segunda_chamada_em: senha.segunda_chamada_em,
      ultima_chamada: senha.status === 'CHAMADA_NOVAMENTE',
      aviso: senha.status === 'CHAMADA_NOVAMENTE' ? 'Última chamada' : null,
    })),
  };
}

module.exports = {
  emitir,
  chamarProxima,
  rechamar,
  iniciar,
  finalizar,
  naoCompareceu,
  encerrarExpediente,
  painel,
  selecionarProxima,
};
