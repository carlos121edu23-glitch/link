import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt.js";

// Modelo e esforço podem ser trocados pelas variáveis ANTHROPIC_MODEL e
// ANTHROPIC_EFFORT. "low" deixa as respostas do chat rápidas e baratas.
const MODELO_PADRAO = "claude-opus-5-5";
const ESFORCO_PADRAO = "low";

// Limite por resposta: as respostas são curtas; isto só segura o custo de
// abusos num endpoint público. Inclui o raciocínio interno do modelo.
const MAX_TOKENS = 2048;

const MAX_MENSAGENS = 16;
const MAX_CARACTERES = 800;
const MAX_CORPO_BYTES = 32 * 1024;
const LIMITE_PADRAO = { janelaMs: 10 * 60 * 1000, maximo: 30 };

const RESPOSTA_RECUSA =
  "Desculpe, não consigo ajudar com isso por aqui. 💗 Para qualquer dúvida sobre a Latefy, fale com a nossa equipe no WhatsApp: https://wa.me/5543980053825";

class ErroHttp extends Error {
  constructor(status, codigo) {
    super(codigo);
    this.status = status;
    this.codigo = codigo;
  }
}

function enviarJson(res, status, corpo, cabecalhos = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [nome, valor] of Object.entries(cabecalhos)) res.setHeader(nome, valor);
  res.end(JSON.stringify(corpo));
}

function ipDoCliente(req) {
  const encaminhado = req.headers?.["x-forwarded-for"];
  const primeiro = Array.isArray(encaminhado) ? encaminhado[0] : encaminhado;
  if (primeiro) return String(primeiro).split(",")[0].trim();
  return req.socket?.remoteAddress || "desconhecido";
}

async function lerCorpo(req) {
  const tamanho = Number(req.headers?.["content-length"] || 0);
  if (tamanho > MAX_CORPO_BYTES) throw new ErroHttp(413, "payload_too_large");

  let corpo;
  try {
    // Na Vercel, req.body já vem lido (e lança erro se o JSON for inválido).
    corpo = req.body;
  } catch {
    throw new ErroHttp(400, "invalid_json");
  }
  if (corpo === undefined || corpo === null) {
    const partes = [];
    let total = 0;
    for await (const parte of req) {
      total += parte.length;
      if (total > MAX_CORPO_BYTES) throw new ErroHttp(413, "payload_too_large");
      partes.push(parte);
    }
    corpo = Buffer.concat(partes).toString("utf8");
  }
  if (Buffer.isBuffer(corpo)) corpo = corpo.toString("utf8");
  if (typeof corpo === "string") {
    try {
      corpo = JSON.parse(corpo);
    } catch {
      throw new ErroHttp(400, "invalid_json");
    }
  }
  return corpo;
}

// Aceita só o formato que o chat do site envia: [{ role, content: texto }].
export function validarMensagens(corpo) {
  if (!corpo || typeof corpo !== "object" || !Array.isArray(corpo.messages)) {
    throw new ErroHttp(400, "invalid_messages");
  }
  const mensagens = [];
  for (const item of corpo.messages.slice(-MAX_MENSAGENS)) {
    if (!item || (item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") {
      throw new ErroHttp(400, "invalid_messages");
    }
    const conteudo = item.content.trim();
    if (!conteudo) throw new ErroHttp(400, "invalid_messages");
    if (conteudo.length > MAX_CARACTERES) throw new ErroHttp(400, "message_too_long");
    mensagens.push({ role: item.role, content: conteudo });
  }
  while (mensagens.length && mensagens[0].role !== "user") mensagens.shift();
  if (!mensagens.length || mensagens[mensagens.length - 1].role !== "user") {
    throw new ErroHttp(400, "invalid_messages");
  }
  return mensagens;
}

function classificarErro(erro) {
  if (erro instanceof ErroHttp) return { status: erro.status, codigo: erro.codigo };
  if (erro instanceof Anthropic.AuthenticationError || erro instanceof Anthropic.PermissionDeniedError) {
    return { status: 503, codigo: "ai_unavailable" };
  }
  if (erro instanceof Anthropic.RateLimitError) return { status: 503, codigo: "ai_busy" };
  if (erro instanceof Anthropic.APIConnectionError) return { status: 502, codigo: "ai_unreachable" };
  if (erro instanceof Anthropic.APIError) return { status: 502, codigo: "ai_error" };
  // Erro do SDK antes de chegar na API, como a falta da ANTHROPIC_API_KEY.
  if (erro instanceof Anthropic.AnthropicError) return { status: 503, codigo: "ai_not_configured" };
  return { status: 500, codigo: "internal_error" };
}

function criarLimitador({ janelaMs, maximo }, agora) {
  const acessos = new Map();
  return function verificar(chave) {
    const instante = agora();
    const recentes = (acessos.get(chave) || []).filter((t) => instante - t < janelaMs);
    if (recentes.length >= maximo) {
      acessos.set(chave, recentes);
      return Math.max(1, Math.ceil((recentes[0] + janelaMs - instante) / 1000));
    }
    recentes.push(instante);
    acessos.set(chave, recentes);
    if (acessos.size > 5000) {
      for (const [ip, tempos] of acessos) {
        if (!tempos.length || instante - tempos[tempos.length - 1] >= janelaMs) acessos.delete(ip);
      }
    }
    return 0;
  };
}

export function createChatHandler(opcoes = {}) {
  const env = opcoes.env ?? process.env;
  const modelo = opcoes.model ?? env.ANTHROPIC_MODEL ?? MODELO_PADRAO;
  const esforco = opcoes.effort ?? env.ANTHROPIC_EFFORT ?? ESFORCO_PADRAO;
  const agora = opcoes.now ?? Date.now;
  const limitar = criarLimitador({ ...LIMITE_PADRAO, ...opcoes.rateLimit }, agora);
  const log = opcoes.logger ?? console;
  let cliente = opcoes.client ?? null;

  function obterCliente() {
    if (!cliente) cliente = new Anthropic({ maxRetries: 1, timeout: 25_000 });
    return cliente;
  }

  // O chat do site consulta isto (GET) para saber se usa a IA ou o modo automático.
  const iaConfigurada = () => Boolean(opcoes.client || env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);

  return async function chatHandler(req, res) {
    if (req.method === "GET") {
      return enviarJson(res, 200, { disponivel: iaConfigurada() });
    }
    if (req.method !== "POST") {
      return enviarJson(res, 405, { error: "method_not_allowed" }, { Allow: "GET, POST" });
    }
    const tipo = String(req.headers?.["content-type"] || "");
    if (!tipo.includes("application/json")) {
      return enviarJson(res, 415, { error: "unsupported_media_type" });
    }
    const espera = limitar(ipDoCliente(req));
    if (espera) {
      return enviarJson(res, 429, { error: "rate_limited" }, { "Retry-After": String(espera) });
    }

    let iniciou = false;
    const enviar = (objeto) => {
      if (!iniciou) {
        iniciou = true;
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Accel-Buffering", "no");
      }
      res.write(JSON.stringify(objeto) + "\n");
    };

    const inicio = agora();
    let stream = null;
    try {
      const mensagens = validarMensagens(await lerCorpo(req));

      stream = obterCliente().beta.messages.stream({
        model: modelo,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: mensagens,
        ...(esforco ? { output_config: { effort: esforco } } : {}),
        // Reaproveita o prefixo (instruções + conversa) entre as mensagens.
        cache_control: { type: "ephemeral" },
        // Se o modelo recusar por política, a API tenta de novo num modelo
        // alternativo recomendado, na mesma chamada.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      // Visitante fechou o chat no meio da resposta: para de gerar tokens.
      res.on?.("close", () => {
        if (!res.writableEnded) stream.abort();
      });

      for await (const evento of stream) {
        if (evento.type === "content_block_delta" && evento.delta.type === "text_delta" && evento.delta.text) {
          enviar({ t: evento.delta.text });
        }
      }
      const final = await stream.finalMessage();

      // Recusa da cadeia inteira: o texto parcial não vale como resposta.
      if (final.stop_reason === "refusal") enviar({ substituir: RESPOSTA_RECUSA });
      enviar({ fim: true, motivo: final.stop_reason });
      res.end();

      const uso = final.usage || {};
      log.info?.(
        JSON.stringify({
          evento: "chat",
          modelo: final.model,
          motivo: final.stop_reason,
          entrada: uso.input_tokens,
          saida: uso.output_tokens,
          cache_lido: uso.cache_read_input_tokens,
          cache_criado: uso.cache_creation_input_tokens,
          ms: agora() - inicio,
        }),
      );
    } catch (erro) {
      if (erro instanceof Anthropic.APIUserAbortError || stream?.aborted) {
        if (!res.writableEnded) res.end();
        return;
      }
      const { status, codigo } = classificarErro(erro);
      if (!(erro instanceof ErroHttp)) {
        log.error?.(
          JSON.stringify({ evento: "chat_erro", codigo, status: erro?.status, tipo: erro?.constructor?.name, detalhe: erro?.message }),
        );
      }
      if (res.writableEnded) return;
      if (!iniciou) return enviarJson(res, status, { error: codigo });
      enviar({ erro: codigo });
      res.end();
    }
  };
}
