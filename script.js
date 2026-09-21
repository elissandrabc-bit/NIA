const mensagemInput = document.getElementById('mensagem');
const inicio = document.getElementById('inicio');
const chat = document.getElementById('chat');
const mensagens = document.getElementById('mensagens');
const botao = document.getElementById('botaoEnviar');
const API = 'http://127.0.0.1:8000';
let historico = [];
let solicitacao = null;
const statusIA = document.createElement('p');
statusIA.setAttribute('role', 'status');
statusIA.style.cssText = 'font-size:12px;text-align:center;margin:4px;color:#555';
document.querySelector('.area-mensagem').appendChild(statusIA);
mensagens.setAttribute('aria-live','polite');
mensagemInput.maxLength=6000;
async function verificarIA() {
  try {
    const r=await fetch(API+'/api/status',{signal:AbortSignal.timeout(5000)});
    const d=await r.json();
    statusIA.textContent=d.ready?'IA local pronta • Conversa mantida apenas nesta página':(d.error || 'Preparando a IA: falta baixar o modelo.');
  } catch { statusIA.textContent='IA desconectada • Abra Iniciar NIA na pasta do projeto.'; }
}
function usarSugestao(texto) { mensagemInput.value=texto;mensagemInput.focus();ajustarTextarea(); }
function abrirChat() { inicio.style.display='none';chat.style.display='block'; }
function novaConversa() {
  solicitacao?.abort();solicitacao=null;historico=[];mensagens.replaceChildren();
  chat.style.display='none';inicio.style.display='flex';mensagemInput.value='';botao.disabled=false;
  ajustarTextarea();verificarIA();
}
function adicionarMensagem(texto,tipo) {
  const linha=document.createElement('div');linha.className='mensagem '+tipo;
  const conteudo=document.createElement('div');conteudo.className='conteudo';
  if(tipo==='nia') {const nome=document.createElement('div');nome.className='nome-nia';nome.textContent='✦ NIA';conteudo.appendChild(nome);}
  const corpo=document.createElement('div');corpo.textContent=texto;corpo.style.whiteSpace='pre-wrap';conteudo.appendChild(corpo);
  linha.appendChild(conteudo);mensagens.appendChild(linha);rolarParaBaixo();return linha;
}
async function enviarMensagem() {
  const texto=mensagemInput.value.trim();if(!texto || solicitacao)return;
  abrirChat();adicionarMensagem(texto,'usuario');mensagemInput.value='';ajustarTextarea();
  const controller=new AbortController();solicitacao=controller;botao.disabled=true;
  const indicador=adicionarMensagem('Pensando… A primeira resposta pode levar mais tempo.','nia');
  const timer=setTimeout(()=>controller.abort(),245000);
  try {
    const contexto=[...historico.slice(-12),{role:'user',content:texto}];
    const r=await fetch(API+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:contexto}),signal:controller.signal});
    const d=await r.json();if(!r.ok)throw new Error(d.error || 'Não foi possível obter uma resposta.');
    if(solicitacao!==controller)return;
    historico=[...contexto,{role:'assistant',content:d.resposta}];indicador.remove();adicionarMensagem(d.resposta,'nia');
    statusIA.textContent='IA local conectada • Conversa mantida apenas nesta página';
  } catch(error) {
    if(solicitacao!==controller)return;
    indicador.remove();adicionarMensagem(error.name==='AbortError'?'A resposta demorou demais. Tente novamente com um texto menor.':(error instanceof TypeError?'Não consegui conectar. Abra Iniciar NIA e confirme que o Ollama está aberto.':error.message),'nia');
    mensagemInput.value=texto;ajustarTextarea();
  } finally {clearTimeout(timer);if(solicitacao===controller){solicitacao=null;botao.disabled=false;mensagemInput.focus();}}
}
mensagemInput.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();enviarMensagem();}});
mensagemInput.addEventListener('input',ajustarTextarea);
function ajustarTextarea(){mensagemInput.style.height='auto';mensagemInput.style.height=Math.min(mensagemInput.scrollHeight,150)+'px';}
function rolarParaBaixo(){window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});}
verificarIA();
