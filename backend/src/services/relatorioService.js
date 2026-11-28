const { pool, erroHttp } = require('../config/db');

const TIPOS = ['SP', 'SE', 'SG'];

function validarConsulta(periodo, data) {
  if (!['diario', 'mensal'].includes(periodo)) {
    throw erroHttp(400, 'Período inválido. Use diario ou mensal.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) {
    throw erroHttp(400, 'Data inválida. Use o formato YYYY-MM-DD.');
  }

  const [ano, mes, dia] = data.split('-').map(Number);
  const calendario = new Date(Date.UTC(ano, mes - 1, dia));
  const dataReal =
    calendario.getUTCFullYear() === ano &&
    calendario.getUTCMonth() === mes - 1 &&
    calendario.getUTCDate() === dia;

  if (!dataReal) {
    throw erroHttp(400, 'Data inválida. Use o formato YYYY-MM-DD.');
  }

  return { periodo, data };
}

function mapaPorTipo(linhas, campo) {
  const mapa = { SP: 0, SE: 0, SG: 0 };
  for (const linha of linhas) {
    if (TIPOS.includes(linha.tipo)) {
      mapa[linha.tipo] = Number(linha[campo]) || 0;
    }
  }
  return mapa;
}

function filtroPeriodo(periodo) {
  if (periodo === 'diario') {
    return 's.data_emissao = ?';
  }
  return `s.data_emissao >= DATE_FORMAT(?, '%Y-%m-01')
          AND s.data_emissao < DATE_ADD(DATE_FORMAT(?, '%Y-%m-01'), INTERVAL 1 MONTH)`;
}

function parametrosPeriodo(periodo, data) {
  return periodo === 'diario' ? [data] : [data, data];
}

async function gerar({ periodo, data }) {
  const consulta = validarConsulta(periodo, data);
  const where = filtroPeriodo(consulta.periodo);
  const params = parametrosPeriodo(consulta.periodo, consulta.data);

  const [totais] = await pool.query(
    `SELECT
       COUNT(*) AS emitidas,
       SUM(status = 'ATENDIDA') AS atendidas
     FROM senhas s
     WHERE ${where}`,
    params
  );

  const [emitidasTipo] = await pool.query(
    `SELECT tipo, COUNT(*) AS total
     FROM senhas s
     WHERE ${where}
     GROUP BY tipo`,
    params
  );

  const [atendidasTipo] = await pool.query(
    `SELECT tipo, COUNT(*) AS total
     FROM senhas s
     WHERE ${where} AND s.status = 'ATENDIDA'
     GROUP BY tipo`,
    params
  );

  const [tempos] = await pool.query(
    `SELECT
       tipo,
       ROUND(AVG(TIMESTAMPDIFF(SECOND, inicio_atendimento_em, fim_atendimento_em)) / 60, 2) AS media
     FROM senhas s
     WHERE ${where}
       AND s.status = 'ATENDIDA'
       AND s.inicio_atendimento_em IS NOT NULL
       AND s.fim_atendimento_em IS NOT NULL
     GROUP BY tipo`,
    params
  );

  const [senhas] = await pool.query(
    `SELECT
       s.id,
       s.codigo,
       s.data_emissao,
       s.tipo,
       s.sequencia,
       s.status,
       s.emitida_em,
       s.primeira_chamada_em,
       s.segunda_chamada_em,
       s.guiche_id,
       g.numero AS guiche_numero,
       s.atendente_id,
       u.nome AS atendente_nome,
       CASE WHEN s.status = 'ATENDIDA' THEN s.inicio_atendimento_em ELSE NULL END AS inicio_atendimento_em,
       CASE WHEN s.status = 'ATENDIDA' THEN s.fim_atendimento_em ELSE NULL END AS fim_atendimento_em,
       CASE
         WHEN s.status = 'ATENDIDA'
          AND s.inicio_atendimento_em IS NOT NULL
          AND s.fim_atendimento_em IS NOT NULL
         THEN ROUND(TIMESTAMPDIFF(SECOND, s.inicio_atendimento_em, s.fim_atendimento_em) / 60, 2)
         ELSE NULL
       END AS tempo_atendimento_min
     FROM senhas s
     LEFT JOIN guiches g ON g.id = s.guiche_id
     LEFT JOIN usuarios u ON u.id = s.atendente_id
     WHERE ${where}
     ORDER BY s.emitida_em ASC, s.id ASC`,
    params
  );

  const [auditoria] = await pool.query(
    `SELECT
       a.id,
       a.senha_id,
       s.codigo AS senha_codigo,
       s.tipo AS senha_tipo,
       a.atendente_id,
       u.nome AS atendente_nome,
       a.guiche_id,
       g.numero AS guiche_numero,
       a.acao,
       a.status_anterior,
       a.status_novo,
       a.registrado_em
     FROM auditoria_chamadas a
     INNER JOIN senhas s ON s.id = a.senha_id
     LEFT JOIN usuarios u ON u.id = a.atendente_id
     LEFT JOIN guiches g ON g.id = a.guiche_id
     WHERE ${where}
     ORDER BY a.registrado_em ASC, a.id ASC`,
    params
  );

  const tempoMedio = { SP: null, SE: null, SG: null };
  for (const linha of tempos) {
    if (TIPOS.includes(linha.tipo)) {
      tempoMedio[linha.tipo] = linha.media === null ? null : Number(linha.media);
    }
  }

  return {
    periodo: consulta.periodo,
    data: consulta.data,
    quantitativo: {
      emitidas: Number(totais[0].emitidas) || 0,
      atendidas: Number(totais[0].atendidas) || 0,
      emitidas_por_prioridade: mapaPorTipo(emitidasTipo, 'total'),
      atendidas_por_prioridade: mapaPorTipo(atendidasTipo, 'total'),
      tempo_medio_minutos: tempoMedio,
    },
    senhas,
    auditoria,
  };
}

module.exports = {
  gerar,
};
