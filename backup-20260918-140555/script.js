const mensagemInput =
  document.getElementById("mensagem");

const inicio =
  document.getElementById("inicio");

const chat =
  document.getElementById("chat");

const mensagens =
  document.getElementById("mensagens");


/* =========================
   SUGESTÕES DA TELA INICIAL
========================= */

function usarSugestao(texto) {

  mensagemInput.value = texto;

  mensagemInput.focus();

  ajustarTextarea();

}


/* =========================
   ENVIAR MENSAGEM
========================= */

function enviarMensagem() {

  const texto =
    mensagemInput.value.trim();

  if (!texto) {
    return;
  }


  abrirChat();


  adicionarMensagem(
    texto,
    "usuario"
  );


  mensagemInput.value = "";

  ajustarTextarea();


  mostrarDigitando();


  /*
    RESPOSTA PROVISÓRIA

    Posteriormente este trecho será
    substituído pela conexão com
    o backend da NIA.
  */

  setTimeout(() => {

    removerDigitando();

    const resposta =
      gerarRespostaProvisoria(texto);

    adicionarMensagem(
      resposta,
      "nia"
    );

  }, 700);

}


/* =========================
   ABRIR CHAT
========================= */

function abrirChat() {

  inicio.style.display =
    "none";

  chat.style.display =
    "block";

}


/* =========================
   NOVA CONVERSA
========================= */

function novaConversa() {

  mensagens.innerHTML = "";

  chat.style.display =
    "none";

  inicio.style.display =
    "flex";

  mensagemInput.value = "";

  ajustarTextarea();

}


/* =========================
   ADICIONAR MENSAGEM
========================= */

function adicionarMensagem(
  texto,
  tipo
) {

  const mensagem =
    document.createElement("div");

  mensagem.classList.add(
    "mensagem",
    tipo
  );


  const conteudo =
    document.createElement("div");

  conteudo.classList.add(
    "conteudo"
  );


  if (tipo === "nia") {

    const nome =
      document.createElement("div");

    nome.classList.add(
      "nome-nia"
    );

    nome.innerHTML =
      "✦ NIA";

    conteudo.appendChild(nome);

  }


  const textoMensagem =
    document.createElement("div");

  textoMensagem.innerText =
    texto;


  conteudo.appendChild(
    textoMensagem
  );

  mensagem.appendChild(
    conteudo
  );

  mensagens.appendChild(
    mensagem
  );


  rolarParaBaixo();

}


/* =========================
   RESPOSTAS TEMPORÁRIAS
========================= */

function gerarRespostaProvisoria(
  texto
) {

  const mensagem =
    texto.toLowerCase();


  if (
    mensagem.includes("simpl")
  ) {

    return `
Entendi. A função de simplificação já está preparada na interface.

Quando conectarmos a inteligência artificial ao sistema, a NIA poderá reorganizar textos extensos, reduzir ambiguidades e apresentar as informações de maneira mais objetiva.

Neste momento, esta resposta ainda é uma simulação do protótipo.
    `.trim();

  }


  if (
    mensagem.includes("tarefa") ||
    mensagem.includes("organize")
  ) {

    return `
Posso ajudar a transformar atividades extensas em etapas menores, estabelecer prioridades e reduzir a quantidade de informações apresentadas ao mesmo tempo.

Essa função será integrada ao modelo de inteligência artificial na próxima etapa do desenvolvimento.
    `.trim();

  }


  if (
    mensagem.includes("resuma") ||
    mensagem.includes("resum")
  ) {

    return `
A NIA foi projetada para apoiar a redução da sobrecarga informacional. Uma das funcionalidades previstas é identificar as informações essenciais de conteúdos extensos e apresentá-las de maneira mais clara.

Por enquanto, esta é uma resposta de demonstração da interface.
    `.trim();

  }


  if (
    mensagem.includes("reuni")
  ) {

    return `
A NIA poderá ajudar a estruturar reuniões apresentando objetivo, pauta, informações essenciais e próximos passos em uma sequência mais previsível e organizada.

Essa funcionalidade ainda será conectada ao backend inteligente.
    `.trim();

  }


  return `
Recebi sua mensagem.

Esta versão da NIA já permite testar a experiência de conversa, mas ainda não está conectada ao modelo de inteligência artificial.

Na próxima etapa, conectaremos esta interface ao backend para que a NIA possa analisar sua solicitação e responder de maneira adaptativa.
  `.trim();

}


/* =========================
   INDICADOR "DIGITANDO"
========================= */

function mostrarDigitando() {

  const mensagem =
    document.createElement("div");

  mensagem.classList.add(
    "mensagem",
    "nia"
  );

  mensagem.id =
    "digitando";


  const conteudo =
    document.createElement("div");

  conteudo.classList.add(
    "conteudo"
  );

  conteudo.innerHTML =
    `
      <div class="nome-nia">
        ✦ NIA
      </div>

      <div>
        Pensando...
      </div>
    `;


  mensagem.appendChild(
    conteudo
  );

  mensagens.appendChild(
    mensagem
  );

  rolarParaBaixo();

}


function removerDigitando() {

  const digitando =
    document.getElementById(
      "digitando"
    );

  if (digitando) {

    digitando.remove();

  }

}


/* =========================
   ENTER PARA ENVIAR
========================= */

mensagemInput.addEventListener(
  "keydown",
  function(event) {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      enviarMensagem();

    }

  }
);


/* =========================
   ALTURA DO TEXTAREA
========================= */

mensagemInput.addEventListener(
  "input",
  ajustarTextarea
);


function ajustarTextarea() {

  mensagemInput.style.height =
    "auto";

  mensagemInput.style.height =
    Math.min(
      mensagemInput.scrollHeight,
      150
    ) + "px";

}


/* =========================
   ROLAR CHAT
========================= */

function rolarParaBaixo() {

  setTimeout(() => {

    window.scrollTo({
      top:
        document.body.scrollHeight,

      behavior:
        "smooth"
    });

  }, 50);

}