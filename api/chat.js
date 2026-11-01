// Função do suporte com IA (POST /api/chat).
// Na Vercel, todo arquivo em api/ vira uma função; localmente, server.js
// encaminha as requisições para cá. A chave fica só no servidor, na variável
// de ambiente ANTHROPIC_API_KEY.
import { createChatHandler } from "./_lib/handler.js";

export default createChatHandler();
