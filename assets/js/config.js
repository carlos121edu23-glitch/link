/*
 * Configurações do site da Latefy Lingerie.
 * Edite aqui os dados de contato, mensagens prontas e depoimentos:
 * o resto do site lê tudo deste arquivo.
 */
window.LATEFY = {
  nome: "Latefy Lingerie Oficial",

  // WhatsApp no formato internacional, só números (55 + DDD + número).
  whatsapp: "5543980053825",
  whatsappExibicao: "(43) 98005-3825",
  telefone: "+5543980053825",

  instagram: "latefy_lingerieof",
  seguidoras: 4680,
  anos: 18,
  regioes: "PR, SC e interior de SP",

  // Mensagens que já vão escritas quando a pessoa abre o WhatsApp.
  mensagens: {
    geral: "Olá! Vim pelo site da Latefy Lingerie e gostaria de mais informações. 💗",
    revenda: "Olá! Vim pelo site e quero ser revendedora Latefy. Pode me explicar como funciona? 💗",
    catalogo: "Olá! Vim pelo site e gostaria de receber o catálogo da Latefy Lingerie. 💗",
    categoria: "Olá! Vim pelo site e gostaria de receber o catálogo de {categoria} da Latefy. 💗",
    atendente: "Olá! Vim pelo site da Latefy e conversei com a assistente virtual. Gostaria de falar com uma atendente. 💗",
  },

  // Assistente virtual (suporte com IA).
  assistente: {
    nome: "Lia",
    // Endereço da função de IA (api/chat.js). Na Vercel ou com "npm start" ela
    // responde com IA de verdade. Sem servidor (ex.: GitHub Pages), o chat
    // continua funcionando no modo automático, com respostas prontas.
    endpoint: "api/chat",
    usarIA: true,
  },

  /*
   * Depoimentos de revendedoras. Enquanto a lista estiver vazia, o site
   * mostra um convite para ver os depoimentos reais no Instagram.
   * Use somente depoimentos reais, com autorização da revendedora:
   *
   * depoimentos: [
   *   { nome: "Nome da revendedora", cidade: "Cidade/UF", texto: "O que ela contou sobre a Latefy." },
   * ],
   */
  depoimentos: [],
};
