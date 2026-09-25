const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

carregarEnv(path.join(__dirname, '.env'));

const MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3-flash-preview';
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const origins = new Set(['http://127.0.0.1:5500', 'http://localhost:5500', 'http://127.0.0.1:8000', 'http://localhost:8000']);
const prompt = 'Você é a NIA, Neuroassistente de Inclusão e Acessibilidade, um protótipo de pesquisa sobre neuroinclusão no trabalho. Responda em português brasileiro, com clareza e concisão. Ajude a simplificar textos, organizar tarefas, resumir informações e preparar reuniões. Preserve os fatos fornecidos; não invente prazos ou dados. Divida atividades em passos pequenos quando útil. Adapte-se às preferências informadas. Não solicite diagnósticos, não diagnostique condições médicas e não avalie trabalhadores para empregadores. Quando não souber, diga. Não afirme ter executado ações externas: você apenas conversa.';
let busy = false;

function carregarEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const texto = linha.trim();
    if (!texto || texto.startsWith('#')) continue;
    const separador = texto.indexOf('=');
    if (separador === -1) continue;
    const chave = texto.slice(0, separador).trim();
    let valor = texto.slice(separador + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (chave && process.env[chave] === undefined) process.env[chave] = valor;
  }
}

function chaveGemini() {
  return process.env.GEMINI_API_KEY?.trim() || '';
}

function cabecalhosGemini() {
  return { 'Content-Type': 'application/json', 'x-goog-api-key': chaveGemini() };
}

function paraConteudosGemini(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

function textoResposta(data) {
  const partes = data.candidates?.[0]?.content?.parts;
  if (!Array.isArray(partes)) return '';
  return partes.map((parte) => parte.text || '').join('').trim();
}

function bloqueada(data) {
  const motivo = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason;
  return motivo === 'SAFETY' || motivo === 'BLOCKLIST' || motivo === 'PROHIBITED_CONTENT';
}

function erroGemini(status, data) {
  if (status === 401 || status === 403) return 'Chave do Gemini inválida. Confira GEMINI_API_KEY no arquivo .env.';
  if (status === 429) return 'A cota do Gemini foi atingida. Aguarde um momento e tente novamente.';
  if (status === 404) return `Modelo ${MODEL} não encontrado. Ajuste GEMINI_MODEL no arquivo .env.`;
  const detalhe = data?.error?.message;
  if (typeof detalhe === 'string' && detalhe.trim()) return 'A IA não conseguiu responder. Tente novamente.';
  return 'A IA não conseguiu responder. Tente novamente.';
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const json = (status, data) => {
    if (!res.destroyed) {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    }
  };
  if (!['127.0.0.1:8000', 'localhost:8000'].includes(req.headers.host)) return json(403, { error: 'Endereço não permitido.' });
  if (origin && !origins.has(origin)) return json(403, { error: 'Origem não permitida.' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/api/status') {
    if (!chaveGemini()) return json(503, { ready: false, error: 'Falta a chave GEMINI_API_KEY no arquivo .env.' });
    try {
      const upstream = await fetch(`${GEMINI}/models/${encodeURIComponent(MODEL)}`, {
        headers: cabecalhosGemini(),
        signal: AbortSignal.timeout(8000),
      });
      if (upstream.ok) return json(200, { ready: true, model: MODEL });
      const data = await upstream.json().catch(() => ({}));
      return json(503, { ready: false, error: erroGemini(upstream.status, data) });
    } catch {
      return json(503, { ready: false, error: 'Não consegui falar com o Gemini. Verifique a internet e tente novamente.' });
    }
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'Envie JSON.' });
    let body = '';
    try {
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 64000) return json(413, { error: 'Texto muito longo. Envie uma parte menor.' });
      }
      body = JSON.parse(body);
    } catch {
      return json(400, { error: 'Mensagem inválida.' });
    }
    const messages = body.messages;
    if (
      !Array.isArray(messages) ||
      messages.length < 1 ||
      messages.length > 13 ||
      messages.some(
        (m, i) =>
          !m ||
          m.role !== (i % 2 === 0 ? 'user' : 'assistant') ||
          typeof m.content !== 'string' ||
          !m.content.trim() ||
          m.content.length > 6000
      ) ||
      messages.length % 2 !== 1
    ) {
      return json(400, { error: 'Conversa inválida ou texto muito longo (máximo de 6.000 caracteres por mensagem).' });
    }
    if (!chaveGemini()) return json(503, { error: 'Falta a chave GEMINI_API_KEY no arquivo .env.' });
    if (busy) return json(429, { error: 'A NIA ainda está respondendo. Aguarde um momento.' });
    busy = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    res.on('close', () => controller.abort());
    try {
      const upstream = await fetch(`${GEMINI}/models/${encodeURIComponent(MODEL)}:generateContent`, {
        method: 'POST',
        headers: cabecalhosGemini(),
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: prompt }] },
          contents: paraConteudosGemini(messages),
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
        }),
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return json(upstream.status === 429 ? 429 : 503, { error: erroGemini(upstream.status, data) });
      if (bloqueada(data)) return json(400, { error: 'O Gemini bloqueou esta resposta por segurança. Reformule o pedido.' });
      const resposta = textoResposta(data);
      if (!resposta) return json(502, { error: 'A IA retornou uma resposta vazia. Tente novamente.' });
      json(200, { resposta });
    } catch {
      json(503, {
        error: controller.signal.aborted
          ? 'A resposta demorou demais. Tente uma mensagem menor.'
          : 'Não consegui acessar o Gemini. Verifique a internet e tente novamente.',
      });
    } finally {
      clearTimeout(timer);
      busy = false;
    }
    return;
  }

  const files = {
    '/': ['index.html', 'text/html'],
    '/index.html': ['index.html', 'text/html'],
    '/script.js': ['script.js', 'text/javascript'],
    '/style.css': ['style.css', 'text/css'],
  };
  const file = files[req.url?.split('?')[0]];
  if (req.method === 'GET' && file) {
    try {
      const data = fs.readFileSync(path.join(__dirname, file[0]));
      res.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(data);
    } catch {
      json(404, { error: 'Arquivo não encontrado.' });
    }
    return;
  }
  json(404, { error: 'Endereço não encontrado.' });
});

server.listen(8000, '127.0.0.1', () => console.log('NIA: http://127.0.0.1:8000'));
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? 'A porta 8000 já está em uso. A NIA pode já estar aberta.' : error.message);
  process.exitCode = 1;
});
