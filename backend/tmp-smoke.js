const mysql = require('mysql2/promise');
require('dotenv').config();

const base = 'http://127.0.0.1:3000';

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await response.text();
  let json = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = { bruto: texto };
  }
  return { status: response.status, json };
}

function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

async function main() {
  const gestor = await api('/api/auth/login', {
    method: 'POST',
    body: { login: 'gestor', senha: '123456' },
  });
  assert(gestor.status === 200 && gestor.json.token, `login gestor falhou: ${gestor.status} ${JSON.stringify(gestor.json)}`);
  assert(gestor.json.usuario.perfil === 'GESTOR', 'perfil gestor');

  const atendente = await api('/api/auth/login', {
    method: 'POST',
    body: { login: 'atendente1', senha: '123456' },
  });
  assert(atendente.status === 200, `login atendente falhou: ${JSON.stringify(atendente.json)}`);

  const senhaErrada = await api('/api/auth/login', {
    method: 'POST',
    body: { login: 'gestor', senha: '000000' },
  });
  assert(senhaErrada.status === 401, 'senha errada deveria ser 401');

  const semToken = await api('/api/senhas/chamar-proxima', { method: 'POST', body: { guiche_id: 1 } });
  assert(semToken.status === 401, 'chamada sem token deveria ser 401');

  const relatorioNegado = await api('/api/relatorios?periodo=diario&data=2026-11-28', {
    token: atendente.json.token,
  });
  assert(relatorioNegado.status === 403, 'atendente nao pode ver relatorio');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,
  });

  const [guiches] = await connection.query('SELECT id FROM guiches WHERE ativo = 1 ORDER BY id LIMIT 1');
  assert(guiches.length, 'nenhum guiche ativo');
  const guicheId = guiches[0].id;

  const emitidas = [];
  for (const tipo of ['SP', 'SE', 'SG', 'SP']) {
    const resposta = await api('/api/senhas/emitir', { method: 'POST', body: { tipo } });
    assert(resposta.status === 201, `emitir ${tipo}: ${JSON.stringify(resposta.json)}`);
    assert(/^\d{6}-(SP|SE|SG)\d{3}$/.test(resposta.json.codigo), `codigo invalido ${resposta.json.codigo}`);
    assert(resposta.json.codigo.includes(`-${tipo}`), `prefixo do tipo ${resposta.json.codigo}`);
    assert(resposta.json.status === 'AGUARDANDO', 'status inicial');
    const sufixo = resposta.json.codigo.slice(-3);
    assert(sufixo === String(resposta.json.sequencia).padStart(3, '0'), 'pad da sequencia');
    emitidas.push(resposta.json);
  }

  const painelAntes = await api('/api/senhas/painel');
  assert(painelAntes.status === 200, 'painel');
  assert(!painelAntes.json.senhas.some((senha) => emitidas.some((item) => item.codigo === senha.codigo)), 'painel vazou senha da fila');

  const primeira = await api('/api/senhas/chamar-proxima', {
    method: 'POST',
    token: atendente.json.token,
    body: { guiche_id: guicheId },
  });
  assert(primeira.status === 200, `chamar 1: ${JSON.stringify(primeira.json)}`);
  assert(primeira.json.tipo === 'SP', `primeira chamada deveria ser SP e foi ${primeira.json.tipo}`);
  assert(primeira.json.status === 'CHAMADA', 'status chamada');

  const segunda = await api('/api/senhas/chamar-proxima', {
    method: 'POST',
    token: gestor.json.token,
    body: { guiche_id: guicheId },
  });
  assert(segunda.status === 200, `chamar 2: ${JSON.stringify(segunda.json)}`);
  assert(segunda.json.tipo === 'SE', `segunda chamada deveria ser SE e foi ${segunda.json.tipo}`);

  const terceira = await api('/api/senhas/chamar-proxima', {
    method: 'POST',
    token: atendente.json.token,
    body: { guiche_id: guicheId },
  });
  assert(terceira.status === 200, `chamar 3: ${JSON.stringify(terceira.json)}`);
  assert(terceira.json.tipo === 'SP', `terceira chamada deveria ser SP e foi ${terceira.json.tipo}`);

  const rechamar = await api(`/api/senhas/${primeira.json.id}/rechamar`, {
    method: 'POST',
    token: atendente.json.token,
  });
  assert(rechamar.status === 200 && rechamar.json.status === 'CHAMADA_NOVAMENTE', 'rechamar');
  assert(rechamar.json.segunda_chamada_em, 'segunda chamada');

  const painel = await api('/api/senhas/painel');
  const destaque = painel.json.senhas.find((senha) => senha.id === primeira.json.id);
  assert(destaque && destaque.ultima_chamada && destaque.aviso === 'Última chamada', 'painel ultima chamada');
  assert(destaque.guiche_numero, 'painel sem guiche');
  assert(painel.json.senhas.length <= 5, 'painel acima de 5');
  assert(!painel.json.senhas.some((senha) => senha.status === 'AGUARDANDO'), 'painel com fila');

  const faltou = await api(`/api/senhas/${primeira.json.id}/nao-compareceu`, {
    method: 'POST',
    token: atendente.json.token,
  });
  assert(faltou.status === 200 && faltou.json.status === 'NAO_COMPARECEU', 'nao compareceu');

  const iniciar = await api(`/api/senhas/${segunda.json.id}/iniciar`, {
    method: 'POST',
    token: atendente.json.token,
  });
  assert(iniciar.status === 200 && iniciar.json.status === 'EM_ATENDIMENTO', 'iniciar');

  const finalizar = await api(`/api/senhas/${segunda.json.id}/finalizar`, {
    method: 'POST',
    token: atendente.json.token,
  });
  assert(finalizar.status === 200 && finalizar.json.status === 'ATENDIDA', 'finalizar');
  assert(finalizar.json.fim_atendimento_em, 'fim atendimento');

  const hoje = new Date();
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const relatorio = await api(`/api/relatorios?periodo=diario&data=${data}`, { token: gestor.json.token });
  assert(relatorio.status === 200, `relatorio: ${JSON.stringify(relatorio.json)}`);
  assert(relatorio.json.quantitativo.emitidas >= 4, 'quantitativo emitidas');
  assert(relatorio.json.quantitativo.atendidas >= 1, 'quantitativo atendidas');
  assert(relatorio.json.quantitativo.emitidas_por_prioridade.SP >= 2, 'emitidas SP');
  assert(Array.isArray(relatorio.json.senhas) && Array.isArray(relatorio.json.auditoria), 'listas do relatorio');
  const naoAtendida = relatorio.json.senhas.find((senha) => senha.id === terceira.json.id);
  assert(naoAtendida && naoAtendida.inicio_atendimento_em === null && naoAtendida.fim_atendimento_em === null, 'campos de atendimento da senha nao atendida');

  const guichesLista = await api('/api/guiches', { token: gestor.json.token });
  assert(guichesLista.status === 200 && guichesLista.json.length >= 1, 'listar guiches');
  const novoGuiche = await api('/api/guiches', {
    method: 'POST',
    token: gestor.json.token,
    body: { numero: 9901, descricao: 'Guichê teste smoke' },
  });
  assert(novoGuiche.status === 201, `criar guiche: ${JSON.stringify(novoGuiche.json)}`);
  const patchGuiche = await api(`/api/guiches/${novoGuiche.json.id}`, {
    method: 'PATCH',
    token: gestor.json.token,
    body: { ativo: 0 },
  });
  assert(patchGuiche.status === 200 && patchGuiche.json.ativo === 0, 'patch guiche');

  const novoUsuario = await api('/api/usuarios', {
    method: 'POST',
    token: gestor.json.token,
    body: {
      nome: 'Atendente Smoke',
      matricula: 'SMOKE9901',
      login: 'smoke9901',
      senha: '123456',
      perfil: 'ATENDENTE',
    },
  });
  assert(novoUsuario.status === 201 && !novoUsuario.json.senha_hash, `criar usuario: ${JSON.stringify(novoUsuario.json)}`);
  const patchUsuario = await api(`/api/usuarios/${novoUsuario.json.id}`, {
    method: 'PATCH',
    token: gestor.json.token,
    body: { ativo: 0 },
  });
  assert(patchUsuario.status === 200 && patchUsuario.json.ativo === 0, 'patch usuario');

  const ids = emitidas.map((senha) => senha.id);
  await connection.query('DELETE FROM senhas WHERE id IN (?)', [ids]);
  await connection.query('DELETE FROM guiches WHERE id = ?', [novoGuiche.json.id]);
  await connection.query('DELETE FROM usuarios WHERE id = ?', [novoUsuario.json.id]);
  await connection.end();

  console.log('smoke ok', {
    codigos: emitidas.map((senha) => senha.codigo),
    chamadas: [primeira.json.tipo, segunda.json.tipo, terceira.json.tipo],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
