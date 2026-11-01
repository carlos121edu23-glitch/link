// Servidor local: mostra o site e responde o chat com IA em /api/chat.
// Uso: npm start  (depois abra http://localhost:3000)
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(fileURLToPath(import.meta.url));

// Lê o .env (se existir) antes de carregar a função de IA.
try {
  process.loadEnvFile(path.join(raiz, ".env"));
} catch {
  // Sem .env: o chat funciona no modo automático, sem IA.
}

const { default: chat } = await import("./api/chat.js");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// Só estes caminhos são públicos; o resto (api/, .env, node_modules...) não.
const PUBLICOS = new Set(["index.html", "privacidade.html", "404.html", "robots.txt", "site.webmanifest"]);

function ehPublico(relativo) {
  if (relativo.split("/").some((parte) => parte.startsWith("."))) return false;
  return PUBLICOS.has(relativo) || relativo.startsWith("assets/");
}

async function servirArquivo(req, res, caminhoUrl) {
  let relativo;
  try {
    relativo = decodeURIComponent(caminhoUrl).replace(/^\/+/, "");
  } catch {
    return naoEncontrado(res);
  }
  if (relativo === "" || relativo.endsWith("/")) relativo += "index.html";
  const absoluto = path.resolve(raiz, relativo);
  if (!absoluto.startsWith(raiz + path.sep) || !ehPublico(path.relative(raiz, absoluto).split(path.sep).join("/"))) {
    return naoEncontrado(res);
  }
  try {
    const info = await stat(absoluto);
    if (!info.isFile()) return naoEncontrado(res);
    const conteudo = await readFile(absoluto);
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(absoluto).toLowerCase()] || "application/octet-stream",
      "Content-Length": conteudo.length,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : conteudo);
  } catch {
    naoEncontrado(res);
  }
}

async function naoEncontrado(res) {
  try {
    const pagina = await readFile(path.join(raiz, "404.html"));
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(pagina);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Página não encontrada");
  }
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/chat") return await chat(req, res);
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      return res.end();
    }
    await servirArquivo(req, res, url.pathname);
  } catch (erro) {
    console.error(erro);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

const porta = Number(process.env.PORT) || 3000;
servidor.listen(porta, () => {
  const ia = process.env.ANTHROPIC_API_KEY ? "IA ativada" : "sem ANTHROPIC_API_KEY: chat no modo automático";
  console.log(`Latefy Lingerie rodando em http://localhost:${porta} (${ia})`);
});
