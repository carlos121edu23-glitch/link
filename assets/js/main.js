/* Interações e animações do site da Latefy. */
(function () {
  "use strict";

  var cfg = window.LATEFY || {};
  var html = document.documentElement;
  var reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ponteiroFino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Links de WhatsApp e Instagram ---------- */
  function linkWhatsApp(texto) {
    var base = "https://wa.me/" + (cfg.whatsapp || "5543980053825");
    return texto ? base + "?text=" + encodeURIComponent(texto) : base;
  }
  function mensagemPronta(chave) {
    var msgs = cfg.mensagens || {};
    if (chave && chave.indexOf("categoria:") === 0) {
      var categoria = chave.slice("categoria:".length);
      return (msgs.categoria || "").replace("{categoria}", categoria);
    }
    return msgs[chave] || msgs.geral || "";
  }
  window.LatefyLinks = { whatsapp: linkWhatsApp, mensagem: mensagemPronta };

  function abrirWhatsApp(texto) {
    var url = linkWhatsApp(texto);
    var janela = window.open(url, "_blank", "noopener");
    if (!janela) window.location.href = url;
  }
  window.LatefyLinks.abrirWhatsApp = abrirWhatsApp;

  document.querySelectorAll("[data-wa]").forEach(function (a) {
    a.href = linkWhatsApp(mensagemPronta(a.getAttribute("data-wa")));
  });
  if (cfg.instagram) {
    document.querySelectorAll("[data-ig]").forEach(function (a) {
      a.href = "https://www.instagram.com/" + cfg.instagram + "/";
    });
  }
  document.querySelectorAll("[data-ano]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- Título do hero: palavras entram uma a uma ---------- */
  function separarPalavras(el) {
    var indice = 0;
    function percorrer(no) {
      Array.prototype.slice.call(no.childNodes).forEach(function (filho) {
        if (filho.nodeType === 3) {
          var partes = filho.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          partes.forEach(function (parte) {
            if (!parte) return;
            if (/^\s+$/.test(parte)) {
              frag.appendChild(document.createTextNode(" "));
              return;
            }
            var w = document.createElement("span");
            w.className = "w";
            var interno = document.createElement("span");
            interno.textContent = parte;
            interno.style.setProperty("--d", (0.35 + indice * 0.07).toFixed(2) + "s");
            w.appendChild(interno);
            frag.appendChild(w);
            indice++;
          });
          no.replaceChild(frag, filho);
        } else if (filho.nodeType === 1) {
          percorrer(filho);
        }
      });
    }
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    percorrer(el);
    Array.prototype.forEach.call(el.querySelectorAll(".w"), function (w) {
      w.setAttribute("aria-hidden", "true");
    });
  }
  document.querySelectorAll("[data-split]").forEach(separarPalavras);

  /* ---------- Abertura ---------- */
  var inicio = performance.now();
  function liberar() {
    var espera = reduzMovimento ? 0 : Math.max(0, 700 - (performance.now() - inicio));
    setTimeout(function () { html.classList.add("is-loaded"); }, espera);
  }
  if (document.readyState === "complete") liberar();
  else window.addEventListener("load", liberar, { once: true });
  setTimeout(function () { html.classList.add("is-loaded"); }, 2600);

  /* ---------- Cabeçalho, barra de leitura e parallax na rolagem ---------- */
  var header = document.querySelector("[data-header]");
  var steps = document.querySelector("[data-steps]");
  var stepItems = steps ? steps.querySelectorAll(".steps__item") : [];
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  var ultimoY = window.scrollY;
  var agendado = false;

  function aoRolar() {
    agendado = false;
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    html.style.setProperty("--scroll", max > 0 ? (y / max).toFixed(4) : "0");

    if (header) {
      header.classList.toggle("is-scrolled", y > 10);
      var descendo = y > ultimoY;
      var menuAberto = html.classList.contains("menu-is-open");
      header.classList.toggle("is-hidden", descendo && y > 420 && !menuAberto);
    }
    ultimoY = y;

    if (steps) {
      var r = steps.getBoundingClientRect();
      var alvo = window.innerHeight * 0.62;
      var progresso = Math.min(1, Math.max(0, (alvo - r.top) / r.height));
      steps.style.setProperty("--progress", progresso.toFixed(3));
      Array.prototype.forEach.call(stepItems, function (item) {
        var ri = item.getBoundingClientRect();
        item.classList.toggle("is-active", ri.top + 29 < alvo);
      });
    }

    if (!reduzMovimento && window.innerWidth > 900) {
      parallaxEls.forEach(function (el) {
        var rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        var fator = parseFloat(el.getAttribute("data-parallax")) || 0.05;
        var centro = rect.top + rect.height / 2 - window.innerHeight / 2;
        el.style.transform = "translate3d(0," + (centro * -fator).toFixed(1) + "px,0)";
      });
    }
  }
  function agendar() {
    if (!agendado) {
      agendado = true;
      requestAnimationFrame(aoRolar);
    }
  }
  window.addEventListener("scroll", agendar, { passive: true });
  window.addEventListener("resize", agendar);
  aoRolar();

  /* ---------- Menu no celular ---------- */
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("menu");
  function definirMenu(aberto) {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", String(aberto));
    toggle.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    nav.classList.toggle("is-open", aberto);
    header.classList.toggle("menu-open", aberto);
    html.classList.toggle("menu-is-open", aberto);
    if (aberto) header.classList.remove("is-hidden");
  }
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      definirMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) definirMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        definirMenu(false);
        toggle.focus();
      }
    });
    window.matchMedia("(min-width: 1024px)").addEventListener("change", function (m) {
      if (m.matches) definirMenu(false);
    });
  }

  /* ---------- Link ativo no menu ---------- */
  var linksMenu = Array.prototype.slice.call(document.querySelectorAll(".nav__list a[href^='#']"));
  if ("IntersectionObserver" in window && linksMenu.length) {
    var observaSecao = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        var id = "#" + entrada.target.id;
        linksMenu.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    linksMenu.forEach(function (a) {
      var secao = document.querySelector(a.getAttribute("href"));
      if (secao) observaSecao.observe(secao);
    });
  }

  /* ---------- Revelar ao rolar + contadores ---------- */
  function contar(el) {
    var alvo = parseFloat(el.getAttribute("data-count")) || 0;
    var prefixo = el.getAttribute("data-prefix") || "";
    var formato = new Intl.NumberFormat("pt-BR");
    if (reduzMovimento) {
      el.textContent = prefixo + formato.format(alvo);
      return;
    }
    var duracao = 1600 + Math.min(alvo, 5000) / 10;
    var t0 = performance.now();
    function passo(t) {
      var p = Math.min(1, (t - t0) / duracao);
      var suave = 1 - Math.pow(1 - p, 4);
      el.textContent = prefixo + formato.format(Math.round(alvo * suave));
      if (p < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }

  var revelaveis = document.querySelectorAll("[data-reveal]");
  var contadores = document.querySelectorAll("[data-count]");
  if (!("IntersectionObserver" in window) || reduzMovimento) {
    Array.prototype.forEach.call(revelaveis, function (el) { el.classList.add("is-visible"); });
    Array.prototype.forEach.call(contadores, contar);
  } else {
    var observaReveal = new IntersectionObserver(function (entradas, obs) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add("is-visible");
          obs.unobserve(entrada.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    Array.prototype.forEach.call(revelaveis, function (el) { observaReveal.observe(el); });

    var observaContador = new IntersectionObserver(function (entradas, obs) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          // No hero, espera a abertura terminar antes de contar.
          var noHero = entrada.target.closest(".hero");
          setTimeout(function () { contar(entrada.target); }, noHero ? 1300 : 0);
          obs.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(contadores, function (el) {
      el.textContent = (el.getAttribute("data-prefix") || "") + "0";
      observaContador.observe(el);
    });
  }

  /* ---------- Movimento com o mouse ---------- */
  if (ponteiroFino && !reduzMovimento) {
    document.querySelectorAll("[data-tilt-group]").forEach(function (grupo) {
      grupo.querySelectorAll("[data-depth]").forEach(function (camada) {
        camada.style.setProperty("--depth", camada.getAttribute("data-depth"));
      });
      var area = grupo.closest("section") || grupo;
      area.addEventListener("pointermove", function (e) {
        var r = grupo.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) / r.width;
        var y = (e.clientY - (r.top + r.height / 2)) / r.height;
        grupo.style.setProperty("--px", (x * -18).toFixed(2) + "px");
        grupo.style.setProperty("--py", (y * -18).toFixed(2) + "px");
      });
      area.addEventListener("pointerleave", function () {
        grupo.style.setProperty("--px", "0px");
        grupo.style.setProperty("--py", "0px");
      });
    });

    document.querySelectorAll("[data-tilt]").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty("--ry", (x * 8).toFixed(2) + "deg");
        card.style.setProperty("--rx", (y * -8).toFixed(2) + "deg");
      });
      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--rx", "0deg");
      });
    });

    document.querySelectorAll(".benefit").forEach(function (item) {
      item.addEventListener("pointermove", function (e) {
        var r = item.getBoundingClientRect();
        item.style.setProperty("--mx", (e.clientX - r.left) + "px");
        item.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  /* ---------- Perguntas frequentes ---------- */
  document.querySelectorAll("[data-accordion]").forEach(function (acc) {
    acc.addEventListener("click", function (e) {
      var botao = e.target.closest("button[aria-controls]");
      if (!botao || !acc.contains(botao)) return;
      var item = botao.closest(".accordion__item");
      var painel = document.getElementById(botao.getAttribute("aria-controls"));
      var abrir = botao.getAttribute("aria-expanded") !== "true";
      botao.setAttribute("aria-expanded", String(abrir));
      item.classList.toggle("is-open", abrir);
      if (abrir) painel.removeAttribute("inert");
      else painel.setAttribute("inert", "");
    });
  });

  /* ---------- Formulário "Quero ser revendedora" ---------- */
  var form = document.querySelector("[data-lead-form]");
  if (form) {
    var aviso = form.querySelector("[data-estado-aviso]");
    var estado = form.querySelector("[name=estado]");
    estado.addEventListener("change", function () {
      aviso.hidden = estado.value !== "Outro";
      marcarErro(estado, false);
    });
    form.querySelectorAll("input[type=text]").forEach(function (campo) {
      campo.addEventListener("input", function () { marcarErro(campo, false); });
    });

    function marcarErro(campo, erro) {
      var field = campo.closest(".field");
      var msg = document.getElementById(campo.id + "-erro");
      field.classList.toggle("has-error", erro);
      if (msg) msg.hidden = !erro;
      if (erro) {
        campo.setAttribute("aria-invalid", "true");
        if (msg) campo.setAttribute("aria-describedby", msg.id);
      } else {
        campo.removeAttribute("aria-invalid");
        campo.removeAttribute("aria-describedby");
      }
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var nome = form.nome.value.trim();
      var cidade = form.cidade.value.trim();
      var uf = estado.value;
      var primeiroErro = null;
      [[form.nome, !nome], [form.cidade, !cidade], [estado, !uf]].forEach(function (par) {
        marcarErro(par[0], par[1]);
        if (par[1] && !primeiroErro) primeiroErro = par[0];
      });
      if (primeiroErro) {
        primeiroErro.focus();
        return;
      }

      var experiencia = (form.querySelector("[name=experiencia]:checked") || {}).value;
      var local = uf === "Outro" ? cidade + " (outro estado)" : cidade + "/" + uf;
      var texto = "Olá! Meu nome é " + nome + ", sou de " + local + " e quero ser revendedora Latefy. 💗";
      texto += experiencia === "sim" ? "\nJá trabalho com vendas." : "\nEstou começando agora nas vendas.";
      if (uf === "Outro") texto += "\nSei que vocês atendem PR, SC e interior de SP: há alguma possibilidade para a minha região?";
      texto += "\nPode me explicar como funciona?";
      abrirWhatsApp(texto);

      var botao = form.querySelector("button[type=submit]");
      var original = botao.innerHTML;
      botao.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg> Abrindo o WhatsApp…';
      setTimeout(function () { botao.innerHTML = original; }, 3500);
    });
  }

  /* ---------- Depoimentos (de config.js) ---------- */
  var lista = document.querySelector("[data-depoimentos]");
  var depoimentos = Array.isArray(cfg.depoimentos) ? cfg.depoimentos : [];
  if (lista && depoimentos.length) {
    depoimentos.forEach(function (d) {
      if (!d || !d.texto) return;
      var fig = document.createElement("figure");
      fig.className = "testimonial";
      var estrelas = document.createElement("div");
      estrelas.className = "testimonial__stars";
      estrelas.setAttribute("aria-hidden", "true");
      estrelas.innerHTML = new Array(6).join('<svg class="icon"><use href="#i-star"/></svg>');
      var citacao = document.createElement("blockquote");
      citacao.textContent = "“" + d.texto + "”";
      var legenda = document.createElement("figcaption");
      var nome = document.createElement("strong");
      nome.textContent = d.nome || "Revendedora Latefy";
      legenda.appendChild(nome);
      if (d.cidade) {
        var cidade = document.createElement("span");
        cidade.textContent = d.cidade;
        legenda.appendChild(cidade);
      }
      fig.appendChild(estrelas);
      fig.appendChild(citacao);
      fig.appendChild(legenda);
      lista.appendChild(fig);
    });
    lista.hidden = false;
  }

  /* ---------- Botões que abrem o chat ---------- */
  document.addEventListener("click", function (e) {
    var botao = e.target.closest("[data-open-chat]");
    if (!botao) return;
    e.preventDefault();
    var pergunta = botao.getAttribute("data-open-chat") || "";
    document.dispatchEvent(new CustomEvent("latefy:abrir-chat", { detail: { pergunta: pergunta } }));
  });
})();
