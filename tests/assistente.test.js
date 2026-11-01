// Testes da base de conhecimento usada pelo chat no modo automático.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const codigo = await readFile(new URL("../assets/js/assistente-base.js", import.meta.url), "utf8");
const contexto = {};
vm.runInNewContext(codigo, contexto);
const { criarAssistente, normalizar, detectarLugar } = contexto.LatefyAssistente;

const assistente = criarAssistente({
  anos: 18,
  regioes: "PR, SC e interior de SP",
  whatsappExibicao: "(43) 98005-3825",
  instagram: "latefy_lingerieof",
  assistente: { nome: "Lia" },
});

test("normalizar tira acentos, pontuação e espaços extras", () => {
  assert.equal(normalizar("  Olá, Consignação!  São   José "), "ola consignacao sao jose");
});

test("detecta cidades e estados atendidos", () => {
  const casos = [
    ["Sou de Londrina", "atende", "Londrina", "PR"],
    ["moro em floripa", "atende", "Florianópolis", "SC"],
    ["Moro em São José dos Campos", "atende", "São José dos Campos", "SP"],
    ["sou de são josé", "atende", "São José", "SC"],
    ["Sou do Paraná", "estado", "o Paraná", "PR"],
    ["Sou do interior de SP", "estado", "o interior de São Paulo", "SP"],
  ];
  for (const [frase, tipo, nome, uf] of casos) {
    const lugar = detectarLugar(frase);
    assert.ok(lugar, frase);
    assert.equal(lugar.tipo, tipo, frase);
    assert.equal(lugar.nome, nome, frase);
    assert.equal(lugar.uf, uf, frase);
  }
});

test("separa capital/litoral de SP e outros estados", () => {
  assert.equal(detectarLugar("Sou de Guarulhos").tipo, "sp-fora");
  assert.equal(detectarLugar("moro na capital paulista").tipo, "sp-fora");
  assert.equal(detectarLugar("moro em são paulo").tipo, "sp-ambiguo");
  assert.equal(detectarLugar("Sou de Belo Horizonte").tipo, "fora");
  assert.equal(detectarLugar("sou de BH - MG").nome, "MG");
});

test("não confunde palavras comuns e nomes com cidades", () => {
  for (const frase of [
    "SE EU QUISER REVENDER COMO FAÇO",
    "Meu nome é Maria dos Santos",
    "vou ser franca com você",
    "que maravilha",
    "se eu vender pouco, tudo bem?",
  ]) {
    assert.equal(detectarLugar(frase), null, frase);
  }
});

test("entende as perguntas mais comuns", () => {
  const casos = {
    "oi": "saudacao",
    "Oi, como funciona a revenda?": "consignacao",
    "Quero ser revendedora": "revenda",
    "Quais regiões vocês atendem?": "regioes",
    "Preciso investir algo?": "investimento",
    "quanto custa pra começar?": "investimento",
    "Quais peças vou vender?": "produtos",
    "Quero o catálogo": "catalogo",
    "qual a comissão?": "ganhos",
    "tem plus size?": "tamanhos",
    "vocês aceitam pix?": "pagamento",
    "qual o prazo de entrega pra Joinville?": "entrega",
    "quero comprar pra mim": "varejo",
    "Preciso ter experiência?": "experiencia",
    "precisa de CPF?": "requisitos",
    "qual o horário de atendimento?": "horario",
    "qual o instagram de vocês?": "instagram",
    "quero falar com uma atendente": "contato",
    "quem é você?": "ia",
    "obrigada!": "agradecimento",
    "tchau": "despedida",
    "asdfgh": "fallback",
  };
  for (const [pergunta, esperado] of Object.entries(casos)) {
    assert.equal(assistente.responder(pergunta).id, esperado, pergunta);
  }
});

test("lugar citado junto com interesse em revender responde sobre o lugar", () => {
  const r = assistente.responder("sou de londrina e quero revender");
  assert.equal(r.id, "lugar-atende");
  assert.match(r.texto, /Londrina \(PR\)/);
  assert.equal(r.acao.tipo, "whatsapp");
});

test("cumprimento junto com pergunta responde a pergunta", () => {
  const r = assistente.responder("Bom dia! Vocês atendem Curitiba?");
  assert.equal(r.id, "lugar-atende");
  assert.match(r.texto, /^Oi! /);
});

test("nenhuma resposta inventa preço, comissão ou prazo", () => {
  const perguntas = [
    "quanto custa", "qual a comissão", "qual o prazo de entrega", "quantas peças vem",
    "como funciona", "quero revender", "preciso investir", "tamanhos", "formas de pagamento",
  ];
  for (const p of perguntas) {
    const { texto } = assistente.responder(p);
    assert.doesNotMatch(texto, /R\$|\d+\s*%|\d+\s*dias/, p);
  }
});

test("boas-vindas apresenta a assistente e sugere perguntas", () => {
  const r = assistente.boasVindas();
  assert.match(r.texto, /Lia/);
  assert.ok(r.chips.length >= 3);
});
