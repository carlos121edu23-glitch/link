/*
 * Chat de suporte da Latefy ("Lia").
 * Usa a IA (api/chat.js) quando o servidor estiver configurado e, se não
 * estiver, responde com a base de conhecimento de assistente-base.js.
 */
(function () {
  "use strict";

  var cfg = window.LATEFY || {};
  var base = window.LatefyAssistente;
  var links = window.LatefyLinks;
  if (!base || !links) return;

  var opcoes = cfg.assistente || {};
  var NOME = opcoes.nome || "Lia";
  var ENDPOINT = opcoes.endpoint || "api/chat";
  var MAX_CARACTERES = 600;
  var MAX_HISTORICO = 12;
  var CHAVE_CONVERSA = "latefy-chat-v1";
  var CHAVE_SEM_IA = "latefy-chat-sem-ia";
  var CHAVE_TEASER = "latefy-chat-teaser";
  var CHIP_ATENDENTE = "Falar com atendente";
  var LOGO = "assets/img/logo-latefy.webp";

  var assistente = base.criarAssistente(cfg);
  var reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var html = document.documentElement;

  var armazenamento = {
    ler: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    gravar: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* modo privado */ } },
    apagar: function (k) { try { window.sessionStorage.removeItem(k); } catch (e) { /* modo privado */ } },
  };

  var estado = {
    aberto: false,
    ocupado: false,
    mensagens: [],
    // null = ainda não sabemos; true/false depois de consultar o servidor.
    ia: opcoes.usarIA === false || location.protocol === "file:" || armazenamento.ler(CHAVE_SEM_IA) === "1" ? false : null,
    falhasIA: 0,
  };

  /* ---------- Utilidades ---------- */
  function el(tag, classe, attrs) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function icone(nome) {
    return '<svg class="icon" aria-hidden="true"><use href="#i-' + nome + '"/></svg>';
  }
  function esperar(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }
  function escapar(texto) {
    return String(texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Só viram link os endereços da própria Latefy (WhatsApp, Instagram, site).
  function rotuloLink(url) {
    try {
      var u = new URL(url.replace(/&amp;/g, "&"), location.href);
      var host = u.hostname.replace(/^www\./, "");
      if (host === "wa.me" || host === "api.whatsapp.com") return "WhatsApp " + (cfg.whatsappExibicao || "");
      if (host === "instagram.com") {
        var perfil = u.pathname.split("/").filter(Boolean)[0];
        return perfil ? "@" + perfil : "Instagram";
      }
      if (u.origin === location.origin) return u.pathname.replace(/^\//, "") || u.hostname;
      return null;
    } catch (e) {
      return null;
    }
  }

  function formatar(texto) {
    var seguro = escapar(texto.trim());
    seguro = seguro.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    seguro = seguro.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, function (url) {
      var rotulo = rotuloLink(url);
      return rotulo ? '<a href="' + url + '" target="_blank" rel="noopener">' + escapar(rotulo) + "</a>" : url;
    });
    return seguro
      .split(/\n{2,}/)
      .map(function (p) { return "<p>" + p.replace(/\n/g, "<br>") + "</p>"; })
      .join("");
  }

  function textoSimples(texto) {
    return texto.replace(/\*\*/g, "").replace(/https?:\/\/\S+/g, "").trim();
  }

  function mensagemAtendente() {
    var ultima = null;
    for (var i = estado.mensagens.length - 1; i >= 0; i--) {
      if (estado.mensagens[i].role === "user") { ultima = estado.mensagens[i].content; break; }
    }
    var texto = links.mensagem("atendente");
    if (ultima) texto += "\n\nMinha dúvida: \"" + ultima.slice(0, 300) + "\"";
    return texto;
  }

  function urlDaAcao(acao) {
    if (!acao) return null;
    if (acao.tipo === "instagram") return "https://www.instagram.com/" + (cfg.instagram || "") + "/";
    if (acao.tipo === "whatsapp") {
      var texto = acao.texto || (acao.mensagem === "atendente" ? mensagemAtendente() : links.mensagem(acao.mensagem));
      return links.whatsapp(texto);
    }
    return null;
  }

  /* ---------- Montagem da interface ---------- */
  var pilha = document.querySelector("[data-fab-stack]");
  if (!pilha) {
    pilha = el("div", "fab-stack", { "data-fab-stack": "" });
    document.body.appendChild(pilha);
  }

  var lancador = el("button", "chat-launcher", {
    type: "button",
    "aria-controls": "latefy-chat",
    "aria-expanded": "false",
    "aria-label": "Abrir o chat com a " + NOME + ", assistente virtual da Latefy",
  });
  lancador.innerHTML =
    '<span class="chat-launcher__avatar"><img src="' + LOGO + '" alt="" width="44" height="44"></span>' +
    '<span class="chat-launcher__text"><strong>Dúvidas? Fale com a ' + escapar(NOME) + "</strong>" +
    "<small>" + icone("sparkle") + " Suporte com IA · online</small></span>";
  pilha.insertBefore(lancador, pilha.firstChild);

  var painel = el("section", "chat", {
    id: "latefy-chat",
    role: "dialog",
    "aria-modal": "false",
    "aria-labelledby": "latefy-chat-titulo",
    "aria-hidden": "true",
  });
  painel.setAttribute("inert", "");
  painel.innerHTML =
    '<div class="chat__header">' +
      '<div class="chat__avatar"><img src="' + LOGO + '" alt="" width="46" height="46"></div>' +
      '<div class="chat__title"><strong id="latefy-chat-titulo">' + escapar(NOME) + " · Latefy</strong>" +
        '<small><span class="chat__ai-tag" data-tag-ia>' + icone("sparkle") + 'IA</span> <span data-status>Assistente virtual · responde na hora</span></small></div>' +
      '<div class="chat__actions">' +
        '<a class="chat__icon-btn chat__icon-btn--wa" href="#" target="_blank" rel="noopener" data-wa-atendente aria-label="Falar com uma atendente no WhatsApp" title="Falar com uma atendente">' + icone("wa") + "</a>" +
        '<button class="chat__icon-btn" type="button" data-acao="limpar" aria-label="Começar uma nova conversa" title="Nova conversa">' + icone("refresh") + "</button>" +
        '<button class="chat__icon-btn" type="button" data-acao="fechar" aria-label="Fechar o chat" title="Fechar">' + icone("close") + "</button>" +
      "</div>" +
    "</div>" +
    '<div class="chat__body" role="log" aria-live="off"></div>' +
    '<div class="sr-only" aria-live="polite" data-anuncio></div>' +
    '<div class="chat__chips" role="group" aria-label="Sugestões de perguntas"></div>' +
    '<form class="chat__form" novalidate>' +
      '<label class="sr-only" for="latefy-chat-input">Escreva sua mensagem</label>' +
      '<textarea id="latefy-chat-input" class="chat__input" rows="1" maxlength="' + MAX_CARACTERES + '" placeholder="Escreva sua dúvida…" autocomplete="off"></textarea>' +
      '<button class="chat__send" type="submit" aria-label="Enviar mensagem" disabled>' + icone("send") + "</button>" +
    "</form>" +
    '<p class="chat__foot" data-rodape></p>';
  document.body.appendChild(painel);

  var corpo = painel.querySelector(".chat__body");
  var chips = painel.querySelector(".chat__chips");
  var formChat = painel.querySelector(".chat__form");
  var entrada = painel.querySelector(".chat__input");
  var enviarBtn = painel.querySelector(".chat__send");
  var anuncio = painel.querySelector("[data-anuncio]");
  var linkAtendente = painel.querySelector("[data-wa-atendente]");

  function atualizarModo() {
    var tag = painel.querySelector("[data-tag-ia]");
    var status = painel.querySelector("[data-status]");
    var rodape = painel.querySelector("[data-rodape]");
    if (estado.ia === false) {
      tag.hidden = true;
      status.textContent = "Assistente virtual · respostas automáticas";
      rodape.innerHTML = 'Respostas automáticas. Para falar com uma pessoa, use o WhatsApp. <a href="privacidade.html">Privacidade</a>';
    } else {
      tag.hidden = false;
      status.textContent = "Assistente virtual · responde na hora";
      rodape.innerHTML = 'Respostas geradas por IA podem conter erros. Não envie dados pessoais. <a href="privacidade.html">Privacidade</a>';
    }
  }
  atualizarModo();

  /* ---------- Mensagens ---------- */
  function rolarParaFim(forcar) {
    var pertoDoFim = corpo.scrollHeight - corpo.scrollTop - corpo.clientHeight < 120;
    if (forcar || pertoDoFim) corpo.scrollTop = corpo.scrollHeight;
  }

  function criarLinhaBot() {
    var linha = el("div", "msg msg--bot");
    var avatar = el("img", "msg__avatar", { src: LOGO, alt: "", width: "28", height: "28" });
    var conteudo = el("div", "msg__content");
    var bolha = el("div", "msg__bubble");
    conteudo.appendChild(bolha);
    linha.appendChild(avatar);
    linha.appendChild(conteudo);
    return { linha: linha, conteudo: conteudo, bolha: bolha };
  }

  function acoesDaMensagem(msg) {
    var acao = msg.acao;
    if (!acao && msg.role === "assistant" && /wa\.me|api\.whatsapp\.com/i.test(msg.content)) {
      acao = { tipo: "whatsapp", mensagem: "atendente" };
    }
    var url = urlDaAcao(acao);
    if (!url) return null;
    var wrap = el("div", "msg__actions");
    var a = el("a", "msg-btn " + (acao.tipo === "instagram" ? "msg-btn--ig" : "msg-btn--wa"), {
      href: url,
      target: "_blank",
      rel: "noopener",
    });
    a.innerHTML = acao.tipo === "instagram"
      ? icone("ig") + " Abrir o Instagram"
      : icone("wa") + " Falar no WhatsApp";
    wrap.appendChild(a);
    return wrap;
  }

  function renderizar(msg, animar) {
    if (msg.role === "user") {
      var linha = el("div", "msg msg--user");
      var bolha = el("div", "msg__bubble");
      bolha.textContent = msg.content;
      linha.appendChild(bolha);
      if (!animar) linha.style.animation = "none";
      corpo.appendChild(linha);
      return;
    }
    var partes = criarLinhaBot();
    partes.bolha.innerHTML = formatar(msg.content);
    var acoes = acoesDaMensagem(msg);
    if (acoes) partes.conteudo.appendChild(acoes);
    if (!animar) partes.linha.style.animation = "none";
    else if (acoes) acoes.style.animation = "none";
    corpo.appendChild(partes.linha);
  }

  function mostrarChips(lista) {
    chips.innerHTML = "";
    (lista || []).forEach(function (rotulo, i) {
      var b = el("button", "chip" + (rotulo === CHIP_ATENDENTE ? " chip--wa" : ""), { type: "button" });
      b.textContent = rotulo;
      b.style.animationDelay = (i * 0.06).toFixed(2) + "s";
      chips.appendChild(b);
    });
  }

  function salvar() {
    armazenamento.gravar(CHAVE_CONVERSA, JSON.stringify({ mensagens: estado.mensagens.slice(-30), chips: estado.chips || [] }));
  }

  function adicionar(msg, animar) {
    estado.mensagens.push(msg);
    renderizar(msg, animar !== false);
    rolarParaFim(true);
    salvar();
  }

  function boasVindas() {
    var r = assistente.boasVindas();
    adicionar({ role: "assistant", content: r.texto, acao: null, boasVindas: true });
    estado.chips = r.chips;
    mostrarChips(r.chips);
    salvar();
  }

  function restaurar() {
    var salvo = null;
    try { salvo = JSON.parse(armazenamento.ler(CHAVE_CONVERSA) || "null"); } catch (e) { salvo = null; }
    if (!salvo || !Array.isArray(salvo.mensagens) || !salvo.mensagens.length) return false;
    salvo.mensagens.forEach(function (m) {
      if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return;
      estado.mensagens.push(m);
      renderizar(m, false);
    });
    estado.chips = Array.isArray(salvo.chips) ? salvo.chips : [];
    mostrarChips(estado.chips);
    return estado.mensagens.length > 0;
  }

  /* ---------- Resposta: interface de digitação ---------- */
  function respostaEmAndamento() {
    var partes = criarLinhaBot();
    partes.bolha.classList.add("typing");
    partes.bolha.innerHTML = "<span></span><span></span><span></span>";
    partes.bolha.setAttribute("aria-label", NOME + " está digitando");
    corpo.appendChild(partes.linha);
    rolarParaFim(true);

    var pendente = null;
    var quadro = 0;
    return {
      atualizar: function (texto) {
        pendente = texto;
        if (quadro) return;
        quadro = requestAnimationFrame(function () {
          quadro = 0;
          partes.bolha.classList.remove("typing");
          partes.bolha.removeAttribute("aria-label");
          partes.bolha.classList.add("is-streaming");
          partes.bolha.innerHTML = formatar(pendente);
          rolarParaFim(false);
        });
      },
      descartar: function () {
        if (quadro) cancelAnimationFrame(quadro);
        partes.linha.remove();
      },
    };
  }

  async function digitar(texto, ui) {
    if (reduzMovimento) {
      ui.atualizar(texto);
      return;
    }
    var palavras = texto.split(/(\s+)/);
    var atual = "";
    for (var i = 0; i < palavras.length; i++) {
      atual += palavras[i];
      if (i % 2 === 0) {
        ui.atualizar(atual);
        await esperar(14 + Math.random() * 18);
      }
    }
    ui.atualizar(texto);
  }

  /* ---------- IA ---------- */
  function desativarIA() {
    estado.ia = false;
    armazenamento.gravar(CHAVE_SEM_IA, "1");
    atualizarModo();
  }

  var verificacao = null;
  function verificarIA() {
    if (estado.ia !== null) return Promise.resolve(estado.ia);
    if (!verificacao) verificacao = consultarServidor();
    return verificacao;
  }

  async function consultarServidor() {
    try {
      var resp = await fetch(ENDPOINT, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
      var tipo = resp.headers.get("content-type") || "";
      var dados = resp.ok && tipo.indexOf("application/json") !== -1 ? await resp.json() : null;
      if (dados && dados.disponivel === true) {
        estado.ia = true;
      } else {
        desativarIA();
      }
    } catch (e) {
      desativarIA();
    }
    atualizarModo();
    return estado.ia;
  }

  async function perguntarIA(historico, ui) {
    var controle = new AbortController();
    var limite = setTimeout(function () { controle.abort(); }, 35000);
    var texto = "";
    try {
      var resp = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historico }),
        signal: controle.signal,
      });
      var tipo = resp.headers.get("content-type") || "";
      if (!resp.ok || tipo.indexOf("application/x-ndjson") === -1 || !resp.body) {
        if (resp.status === 404 || resp.status === 405 || resp.status === 501 || resp.status === 503) desativarIA();
        else estado.falhasIA++;
        return null;
      }

      var leitor = resp.body.getReader();
      var decodificador = new TextDecoder();
      var buffer = "";
      var fim = null;
      var substituir = null;
      var erro = null;
      for (;;) {
        var parte = await leitor.read();
        if (parte.done) break;
        buffer += decodificador.decode(parte.value, { stream: true });
        var quebra;
        while ((quebra = buffer.indexOf("\n")) !== -1) {
          var linha = buffer.slice(0, quebra).trim();
          buffer = buffer.slice(quebra + 1);
          if (!linha) continue;
          var evento;
          try { evento = JSON.parse(linha); } catch (e) { continue; }
          if (typeof evento.t === "string") {
            texto += evento.t;
            ui.atualizar(texto);
          } else if (evento.substituir) {
            substituir = evento.substituir;
          } else if (evento.fim) {
            fim = evento;
          } else if (evento.erro) {
            erro = evento.erro;
          }
        }
      }

      if (substituir) return { texto: substituir, acao: { tipo: "whatsapp", mensagem: "atendente" }, chips: assistente.chipsPadrao() };
      if (!texto.trim()) {
        estado.falhasIA++;
        return null;
      }
      if (erro || !fim) texto += "\n\n(A resposta foi interrompida. Se precisar, fale com a nossa equipe no WhatsApp.)";
      else if (fim.motivo === "max_tokens") texto += "…";
      estado.falhasIA = 0;
      return { texto: texto, acao: null, chips: assistente.chipsPadrao() };
    } catch (e) {
      estado.falhasIA++;
      if (texto.trim()) {
        return {
          texto: texto + "\n\n(A conexão caiu no meio da resposta. Se precisar, fale com a nossa equipe no WhatsApp.)",
          acao: { tipo: "whatsapp", mensagem: "atendente" },
          chips: assistente.chipsPadrao(),
        };
      }
      return null;
    } finally {
      clearTimeout(limite);
      if (estado.falhasIA >= 2) desativarIA();
    }
  }

  async function responderLocal(pergunta, ui) {
    await esperar(reduzMovimento ? 0 : 450 + Math.random() * 450);
    var r = assistente.responder(pergunta);
    await digitar(r.texto, ui);
    return { texto: r.texto, acao: r.acao, chips: r.chips };
  }

  /* ---------- Envio ---------- */
  function atualizarBotao() {
    enviarBtn.disabled = estado.ocupado || !entrada.value.trim();
  }

  async function enviar(textoBruto) {
    var texto = String(textoBruto || "").replace(/\s+$/g, "").trim().slice(0, MAX_CARACTERES);
    if (!texto || estado.ocupado) return;
    estado.ocupado = true;
    atualizarBotao();
    mostrarChips([]);
    estado.chips = [];
    adicionar({ role: "user", content: texto });

    var historico = estado.mensagens
      .filter(function (m) { return !m.boasVindas && !m.local; })
      .slice(-MAX_HISTORICO)
      .map(function (m) { return { role: m.role, content: m.content.slice(0, 800) }; });

    var ui = respostaEmAndamento();
    var resposta = null;
    if (await verificarIA()) resposta = await perguntarIA(historico, ui);
    if (!resposta) resposta = await responderLocal(texto, ui);
    ui.descartar();

    // A bolha da resposta já estava na tela: troca sem animar de novo.
    adicionar({ role: "assistant", content: resposta.texto, acao: resposta.acao || null }, false);
    anuncio.textContent = NOME + ": " + textoSimples(resposta.texto);
    estado.chips = resposta.chips || [];
    mostrarChips(estado.chips);
    salvar();

    estado.ocupado = false;
    atualizarBotao();
  }

  function falarComAtendente() {
    var texto = mensagemAtendente();
    links.abrirWhatsApp(texto);
    adicionar({
      role: "assistant",
      local: true,
      content: "Perfeito! Abri o WhatsApp da nossa equipe com a sua dúvida. 💗 Se a janela não abriu, é só tocar no botão abaixo.",
      acao: { tipo: "whatsapp", texto: texto },
    });
  }

  /* ---------- Abrir e fechar ---------- */
  var teaser = null;
  function esconderTeaser(lembrar) {
    if (teaser) {
      teaser.remove();
      teaser = null;
    }
    if (lembrar) armazenamento.gravar(CHAVE_TEASER, "1");
  }

  function abrir(pergunta) {
    esconderTeaser(true);
    if (!estado.aberto) {
      estado.aberto = true;
      painel.classList.add("is-open");
      painel.removeAttribute("inert");
      painel.setAttribute("aria-hidden", "false");
      lancador.setAttribute("aria-expanded", "true");
      html.classList.add("chat-is-open");
      if (!estado.mensagens.length) boasVindas();
      rolarParaFim(true);
      if (window.matchMedia("(pointer: fine)").matches) setTimeout(function () { entrada.focus(); }, 250);
      verificarIA();
    }
    if (pergunta) enviar(pergunta);
  }

  function fechar() {
    if (!estado.aberto) return;
    estado.aberto = false;
    painel.classList.remove("is-open");
    painel.setAttribute("inert", "");
    painel.setAttribute("aria-hidden", "true");
    lancador.setAttribute("aria-expanded", "false");
    html.classList.remove("chat-is-open");
    lancador.focus();
  }

  lancador.addEventListener("click", function () {
    if (estado.aberto) fechar();
    else abrir();
  });
  document.addEventListener("latefy:abrir-chat", function (e) {
    abrir(e.detail && e.detail.pergunta);
  });

  painel.addEventListener("click", function (e) {
    var acao = e.target.closest("[data-acao]");
    if (acao && acao.getAttribute("data-acao") === "fechar") fechar();
    if (acao && acao.getAttribute("data-acao") === "limpar" && !estado.ocupado) {
      estado.mensagens = [];
      corpo.innerHTML = "";
      armazenamento.apagar(CHAVE_CONVERSA);
      boasVindas();
      entrada.focus();
    }
    var chip = e.target.closest(".chip");
    if (chip) {
      if (chip.textContent === CHIP_ATENDENTE) falarComAtendente();
      else enviar(chip.textContent);
    }
  });

  linkAtendente.addEventListener("click", function (e) {
    e.preventDefault();
    falarComAtendente();
  });

  painel.addEventListener("keydown", function (e) {
    if (e.key === "Escape") fechar();
  });

  formChat.addEventListener("submit", function (e) {
    e.preventDefault();
    var texto = entrada.value;
    entrada.value = "";
    ajustarAltura();
    enviar(texto);
  });

  entrada.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      formChat.requestSubmit ? formChat.requestSubmit() : formChat.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });

  function ajustarAltura() {
    entrada.style.height = "auto";
    entrada.style.height = Math.min(entrada.scrollHeight, 120) + "px";
    atualizarBotao();
  }
  entrada.addEventListener("input", ajustarAltura);

  /* ---------- Convite (balão) ---------- */
  var conversaSalva = restaurar();
  if (!conversaSalva && armazenamento.ler(CHAVE_TEASER) !== "1") {
    setTimeout(function () {
      if (estado.aberto || armazenamento.ler(CHAVE_TEASER) === "1") return;
      teaser = el("div", "chat-teaser", { role: "status" });
      teaser.innerHTML =
        "<p>Oi! 💗 Sou a <strong>" + escapar(NOME) + "</strong>, assistente virtual da Latefy. Quer saber como ser revendedora?</p>" +
        '<button class="chat-teaser__close" type="button" aria-label="Fechar convite">' + icone("close") + "</button>";
      teaser.addEventListener("click", function (e) {
        if (e.target.closest(".chat-teaser__close")) {
          esconderTeaser(true);
          return;
        }
        abrir();
      });
      pilha.insertBefore(teaser, pilha.firstChild);
    }, 7000);
  }
})();
