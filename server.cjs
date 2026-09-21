const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const MODEL = 'llama3.2:1b';
const origins = new Set(['http://127.0.0.1:5500', 'http://localhost:5500', 'http://127.0.0.1:8000', 'http://localhost:8000']);
const prompt = 'Você é a NIA, Neuroassistente de Inclusão e Acessibilidade, um protótipo de pesquisa sobre neuroinclusão no trabalho. Responda em português brasileiro, com clareza e concisão. Ajude a simplificar textos, organizar tarefas, resumir informações e preparar reuniões. Preserve os fatos fornecidos; não invente prazos ou dados. Divida atividades em passos pequenos quando útil. Adapte-se às preferências informadas. Não solicite diagnósticos, não diagnostique condições médicas e não avalie trabalhadores para empregadores. Quando não souber, diga. Não afirme ter executado ações externas: você apenas conversa.';
let busy = false;
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const json = (status, data) => { if (!res.destroyed) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); } };
  if (!['127.0.0.1:8000','localhost:8000'].includes(req.headers.host)) return json(403,{error:'Endereço não permitido.'});
  if (origin && !origins.has(origin)) return json(403,{error:'Origem não permitida.'});
  if (origin) { res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Vary','Origin'); }
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  if(req.method==='OPTIONS') {res.writeHead(204);return res.end();}
  if(req.method==='GET' && req.url==='/api/status') {
    try {
      const upstream=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(3000)});
      if(!upstream.ok) throw new Error();
      const data=await upstream.json();
      return json(200,{ready:data.models?.some(m=>m.name===MODEL)===true,model:MODEL});
    } catch { return json(503,{ready:false,error:'Abra o Ollama para ativar a IA.'}); }
  }
  if(req.method==='POST' && req.url==='/api/chat') {
    if(!req.headers['content-type']?.startsWith('application/json')) return json(415,{error:'Envie JSON.'});
    let body='';
    try {
      for await (const chunk of req) { body+=chunk; if(Buffer.byteLength(body)>64000) return json(413,{error:'Texto muito longo. Envie uma parte menor.'}); }
      body=JSON.parse(body);
    } catch { return json(400,{error:'Mensagem inválida.'}); }
    const messages=body.messages;
    if(!Array.isArray(messages) || messages.length<1 || messages.length>13 || messages.some((m,i)=>!m || m.role!==(i%2===0?'user':'assistant') || typeof m.content!=='string' || !m.content.trim() || m.content.length>6000) || messages.length%2!==1) return json(400,{error:'Conversa inválida ou texto muito longo (máximo de 6.000 caracteres por mensagem).'});
    if(busy) return json(429,{error:'A NIA ainda está respondendo. Aguarde um momento.'});
    busy=true;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),240000);
    res.on('close',()=>controller.abort());
    try {
      const upstream=await fetch('http://127.0.0.1:11434/api/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({model:MODEL,messages:[{role:'system',content:prompt},...messages],stream:false,options:{num_ctx:4096,num_predict:500,temperature:0.3},keep_alive:'2m'})
      });
      if(!upstream.ok) return json(503,{error:upstream.status===404?'O modelo ainda não foi baixado. Execute ollama pull llama3.2:1b.':'A IA não conseguiu responder. Verifique se há memória livre e tente novamente.'});
      const data=await upstream.json();
      if(!data.message?.content?.trim()) return json(502,{error:'A IA retornou uma resposta vazia. Tente novamente.'});
      json(200,{resposta:data.message.content});
    } catch { json(503,{error:controller.signal.aborted?'A resposta demorou demais. Tente uma mensagem menor.':'Não consegui acessar a IA. Abra o Ollama e tente novamente.'}); }
    finally {clearTimeout(timer);busy=false;}
    return;
  }
  const files={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/script.js':['script.js','text/javascript'],'/style.css':['style.css','text/css']};
  const file=files[req.url?.split('?')[0]];
  if(req.method==='GET' && file) {
    try { const data=fs.readFileSync(path.join(__dirname,file[0]));res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8','Cache-Control':'no-store'});res.end(data); } catch {json(404,{error:'Arquivo não encontrado.'});}
    return;
  }
  json(404,{error:'Endereço não encontrado.'});
});
server.listen(8000,'127.0.0.1',()=>console.log('NIA: http://127.0.0.1:8000'));
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'A porta 8000 já está em uso. A NIA pode já estar aberta.':error.message);process.exitCode=1;});
