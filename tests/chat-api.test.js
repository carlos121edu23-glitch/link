// Testes da função api/chat.js, com um cliente falso no lugar da API.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import Anthropic from "@anthropic-ai/sdk";
import { createChatHandler, validarMensagens } from "../api/_lib/handler.js";
import { SYSTEM_PROMPT } from "../api/_lib/prompt.js";

const silencioso = { info() {}, error() {} };

function requisicao({ method = "POST", body, headers = {}, ip = "1.2.3.4" } = {}) {
  const texto = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  const req = Readable.from(texto ? [Buffer.from(texto)] : []);
  req.method = method;
  req.headers = { "content-type": "application/json", "x-forwarded-for": ip, ...headers };
  return req;
}

function resposta() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.corpo = "";
  res.writableEnded = false;
  res.setHeader = (nome, valor) => { res.headers[nome.toLowerCase()] = valor; };
  res.write = (parte) => { res.corpo += parte; return true; };
  res.end = (parte) => {
    if (parte) res.corpo += parte;
    res.writableEnded = true;
    res.emit("close");
  };
  res.json = () => JSON.parse(res.corpo);
  res.linhas = () => res.corpo.trim().split("\n").map((l) => JSON.parse(l));
  return res;
}

function texto(t) {
  return { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } };
}

// Imita o MessageStream do SDK: eventos + finalMessage() + abort().
function clienteFalso({ eventos = [], final = { stop_reason: "end_turn" }, erro, erroNoMeio, travar } = {}) {
  const chamadas = [];
  const cliente = {
    chamadas,
    beta: {
      messages: {
        stream(params) {
          chamadas.push(params);
          let abortado = false;
          let liberar;
          const stream = {
            get aborted() { return abortado; },
            abort() {
              abortado = true;
              liberar?.();
            },
            async *[Symbol.asyncIterator]() {
              if (erro) throw erro;
              yield { type: "message_start", message: { model: params.model } };
              yield { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } };
              for (const e of eventos) yield e;
              if (erroNoMeio) throw erroNoMeio;
              if (travar) {
                await new Promise((r) => { liberar = r; });
                throw new Anthropic.APIUserAbortError();
              }
            },
            async finalMessage() {
              return { model: params.model, usage: { input_tokens: 10, output_tokens: 5 }, ...final };
            },
          };
          return stream;
        },
      },
    },
  };
  return cliente;
}

test("GET informa se a IA está configurada", async () => {
  let res = resposta();
  await createChatHandler({ client: clienteFalso(), logger: silencioso })(requisicao({ method: "GET" }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { disponivel: true });

  res = resposta();
  await createChatHandler({ env: {}, logger: silencioso })(requisicao({ method: "GET" }), res);
  assert.deepEqual(res.json(), { disponivel: false });

  res = resposta();
  await createChatHandler({ env: { ANTHROPIC_API_KEY: "x" }, logger: silencioso })(requisicao({ method: "GET" }), res);
  assert.deepEqual(res.json(), { disponivel: true });
});

test("recusa métodos e formatos errados", async () => {
  const handler = createChatHandler({ client: clienteFalso(), logger: silencioso });
  let res = resposta();
  await handler(requisicao({ method: "PUT" }), res);
  assert.equal(res.statusCode, 405);

  res = resposta();
  await handler(requisicao({ body: "oi", headers: { "content-type": "text/plain" } }), res);
  assert.equal(res.statusCode, 415);

  res = resposta();
  await handler(requisicao({ body: "{quebrado" }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "invalid_json");

  res = resposta();
  await handler(requisicao({ body: { messages: [{ role: "system", content: "x" }] } }), res);
  assert.equal(res.json().error, "invalid_messages");

  res = resposta();
  await handler(requisicao({ body: { messages: [{ role: "user", content: "a".repeat(801) }] } }), res);
  assert.equal(res.json().error, "message_too_long");

  res = resposta();
  await handler(requisicao({ body: { messages: [] }, headers: { "content-length": String(64 * 1024) } }), res);
  assert.equal(res.statusCode, 413);
});

test("validarMensagens remove assistente do início e exige pergunta no fim", () => {
  const msgs = validarMensagens({
    messages: [
      { role: "assistant", content: "Olá! Sou a Lia." },
      { role: "user", content: "  Como funciona?  " },
    ],
  });
  assert.deepEqual(msgs, [{ role: "user", content: "Como funciona?" }]);
  assert.throws(() => validarMensagens({ messages: [{ role: "user", content: "oi" }, { role: "assistant", content: "oi!" }] }));
});

test("transmite a resposta e usa os parâmetros certos na API", async () => {
  const cliente = clienteFalso({ eventos: [texto("Na consignação "), texto("você paga só o que vende.")] });
  const res = resposta();
  await createChatHandler({ client: cliente, logger: silencioso })(
    requisicao({ body: { messages: [{ role: "user", content: "Como funciona?" }] } }),
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"], /application\/x-ndjson/);
  assert.deepEqual(res.linhas(), [
    { t: "Na consignação " },
    { t: "você paga só o que vende." },
    { fim: true, motivo: "end_turn" },
  ]);

  const [params] = cliente.chamadas;
  assert.equal(params.model, "claude-opus-5-5");
  assert.equal(params.system, SYSTEM_PROMPT);
  assert.deepEqual(params.messages, [{ role: "user", content: "Como funciona?" }]);
  assert.deepEqual(params.output_config, { effort: "low" });
  assert.deepEqual(params.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(params.fallbacks, "default");
  assert.deepEqual(params.cache_control, { type: "ephemeral" });
  assert.equal(params.thinking, undefined);
  assert.ok(params.max_tokens >= 1024);
});

test("modelo e esforço podem vir das variáveis de ambiente", async () => {
  const cliente = clienteFalso({ eventos: [texto("ok")] });
  const env = { ANTHROPIC_MODEL: "claude-sonnet-5-5", ANTHROPIC_EFFORT: "medium" };
  await createChatHandler({ client: cliente, env, logger: silencioso })(
    requisicao({ body: { messages: [{ role: "user", content: "oi" }] } }),
    resposta(),
  );
  assert.equal(cliente.chamadas[0].model, "claude-sonnet-5-5");
  assert.deepEqual(cliente.chamadas[0].output_config, { effort: "medium" });
});

test("recusa da cadeia inteira troca o texto parcial por uma resposta segura", async () => {
  const cliente = clienteFalso({ eventos: [texto("parcial")], final: { stop_reason: "refusal" } });
  const res = resposta();
  await createChatHandler({ client: cliente, logger: silencioso })(
    requisicao({ body: { messages: [{ role: "user", content: "oi" }] } }),
    res,
  );
  const linhas = res.linhas();
  assert.ok(linhas.some((l) => typeof l.substituir === "string" && l.substituir.includes("wa.me")));
  assert.deepEqual(linhas.at(-1), { fim: true, motivo: "refusal" });
});

test("erros antes do streaming viram status HTTP para o site usar o modo automático", async () => {
  const casos = [
    [new Anthropic.AuthenticationError(401, {}, "chave inválida", new Headers()), 503, "ai_unavailable"],
    [new Anthropic.RateLimitError(429, {}, "limite", new Headers()), 503, "ai_busy"],
    [new Anthropic.InternalServerError(529, {}, "sobrecarga", new Headers()), 502, "ai_error"],
    [new Anthropic.APIConnectionError({ message: "rede" }), 502, "ai_unreachable"],
    [new Anthropic.AnthropicError("sem credenciais"), 503, "ai_not_configured"],
  ];
  for (const [erro, status, codigo] of casos) {
    const res = resposta();
    await createChatHandler({ client: clienteFalso({ erro }), logger: silencioso })(
      requisicao({ body: { messages: [{ role: "user", content: "oi" }] } }),
      res,
    );
    assert.equal(res.statusCode, status, codigo);
    assert.equal(res.json().error, codigo);
  }
});

test("sem chave de API, responde 503 sem chamar a rede", async () => {
  const cliente = new Anthropic({ apiKey: null, authToken: null, baseURL: "http://127.0.0.1:9", maxRetries: 0 });
  const res = resposta();
  await createChatHandler({ client: cliente, logger: silencioso })(
    requisicao({ body: { messages: [{ role: "user", content: "oi" }] } }),
    res,
  );
  assert.equal(res.statusCode, 503);
  assert.equal(res.json().error, "ai_not_configured");
});

test("erro no meio da resposta encerra o streaming avisando o site", async () => {
  const erroNoMeio = new Anthropic.InternalServerError(500, {}, "falhou", new Headers());
  const res = resposta();
  await createChatHandler({ client: clienteFalso({ eventos: [texto("Olá")], erroNoMeio }), logger: silencioso })(
    requisicao({ body: { messages: [{ role: "user", content: "oi" }] } }),
    res,
  );
  assert.deepEqual(res.linhas(), [{ t: "Olá" }, { erro: "ai_error" }]);
  assert.ok(res.writableEnded);
});

test("para de gerar quando a visitante fecha o chat", async () => {
  const cliente = clienteFalso({ eventos: [texto("Olá")], travar: true });
  const res = resposta();
  const pronto = createChatHandler({ client: cliente, logger: silencioso })(
    requisicao({ body: { messages: [{ role: "user", content: "oi" }] } }),
    res,
  );
  await new Promise((r) => setTimeout(r, 20));
  res.emit("close"); // conexão caiu antes do fim
  await pronto;
  assert.ok(res.writableEnded);
  assert.deepEqual(res.linhas(), [{ t: "Olá" }]);
});

test("limita o número de mensagens por visitante", async () => {
  let agora = 0;
  const handler = createChatHandler({
    client: clienteFalso({ eventos: [texto("ok")] }),
    rateLimit: { maximo: 2, janelaMs: 60_000 },
    now: () => agora,
    logger: silencioso,
  });
  const enviar = async (ip = "9.9.9.9") => {
    const res = resposta();
    await handler(requisicao({ body: { messages: [{ role: "user", content: "oi" }] }, ip }), res);
    return res;
  };
  assert.equal((await enviar()).statusCode, 200);
  assert.equal((await enviar()).statusCode, 200);
  const bloqueada = await enviar();
  assert.equal(bloqueada.statusCode, 429);
  assert.equal(bloqueada.headers["retry-after"], "60");
  assert.equal((await enviar("8.8.8.8")).statusCode, 200);
  agora = 61_000;
  assert.equal((await enviar()).statusCode, 200);
});
