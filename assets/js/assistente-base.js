/*
 * Base de conhecimento da assistente virtual da Latefy (modo automático).
 *
 * Quando a IA (api/chat.js) não está disponível — por exemplo, num site
 * hospedado sem servidor — o chat usa estas respostas prontas. Elas seguem
 * as mesmas regras da IA: só afirmam o que a Latefy divulga publicamente e
 * mandam para o WhatsApp tudo o que depende da equipe (preços, condições,
 * prazos, cadastro).
 */
(function (root) {
  "use strict";

  function normalizar(texto) {
    return String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function preencher(modelo, dados) {
    return modelo.replace(/\{(\w+)\}/g, function (_, chave) {
      return dados[chave] != null ? String(dados[chave]) : "";
    });
  }

  function contemTermo(norm, termo) {
    return (" " + norm + " ").indexOf(" " + termo + " ") !== -1;
  }

  /* ---------------------------------------------------------------------
   * Lugares, para responder "vocês atendem a minha cidade?".
   * Um item pode ser só o nome ou { nome, termos } quando o nome também é
   * uma palavra comum (ex.: "Franca") e só deve valer com o estado junto.
   * ------------------------------------------------------------------- */
  var CIDADES = {
    PR: [
      "Curitiba", "Londrina", "Maringá", "Ponta Grossa", "Cascavel", "São José dos Pinhais",
      "Foz do Iguaçu", "Colombo", "Guarapuava", "Paranaguá", "Apucarana", "Toledo", "Araucária",
      "Pinhais", "Campo Largo", "Arapongas", "Almirante Tamandaré", "Umuarama", "Cambé",
      "Piraquara", "Campo Mourão", "Fazenda Rio Grande", "Sarandi", "Francisco Beltrão",
      "Paranavaí", "Pato Branco", "Cianorte", "Telêmaco Borba", "Rolândia", "Irati",
      "União da Vitória", "Ibiporã", "Prudentópolis", "Marechal Cândido Rondon",
      "Cornélio Procópio", "Santo Antônio da Platina", "Jacarezinho", "Bandeirantes", "Assaí",
      "Ivaiporã", "Arapoti", "Medianeira", "Lapa", "Jandaia do Sul", "Astorga", "Mandaguari",
      "Mandaguaçu", "Cambará", "Sertanópolis", "Porecatu", "Palotina", "Dois Vizinhos",
      "Goioerê", "Loanda", "Siqueira Campos", "Wenceslau Braz", "Ibaiti", "Jaguariaíva",
      "Sengés", "Rio Negro", "Matinhos", "Guaratuba", "Pontal do Paraná", "Morretes",
      "Quatro Barras", "Campina Grande do Sul",
      { nome: "Castro", termos: ["castro pr", "cidade de castro"] },
    ],
    SC: [
      { nome: "Florianópolis", termos: ["florianopolis", "floripa"] },
      "Joinville", "Blumenau", "São José", "Chapecó", "Itajaí", "Criciúma", "Jaraguá do Sul",
      "Palhoça", "Lages", "Balneário Camboriú", "Brusque", "Tubarão", "São Bento do Sul",
      "Caçador", "Concórdia", "Camboriú", "Navegantes", "Rio do Sul", "Araranguá", "Gaspar",
      "Biguaçu", "Indaial", "Mafra", "Canoinhas", "Itapema", "Videira", "Xanxerê",
      "São Miguel do Oeste", "Curitibanos", "Joaçaba", "Imbituba", "Laguna", "Porto Belo",
      "Bombinhas", "Timbó", "Pomerode", "Guaramirim", "São Francisco do Sul", "Barra Velha",
      "Ibirama", "Ituporanga", "Orleans", "Urussanga", "Içara", "Fraiburgo", "Herval d'Oeste",
      "Palmitos", "Xaxim", "São Lourenço do Oeste",
    ],
    SP: [
      "Campinas", "Ribeirão Preto", "Sorocaba", "São José do Rio Preto", "Bauru", "Piracicaba",
      "Jundiaí", "Limeira", "Presidente Prudente", "Araraquara", "São Carlos", "Araçatuba",
      "Rio Claro", "Assis", "Ourinhos", "Botucatu", "Taubaté", "São José dos Campos", "Jaú",
      "Catanduva", "Barretos", "Bebedouro", "Avaré", "Itapetininga", "Araras", "Indaiatuba",
      "Sumaré", "Hortolândia", "Valinhos", "Vinhedo", "Itu", "Tatuí", "Lins", "Birigui",
      "Penápolis", "Presidente Epitácio", "Tupã", "Adamantina", "Dracena",
      "Santa Cruz do Rio Pardo", "Piraju", "Itapeva", "Mogi Mirim", "Mogi Guaçu",
      "São João da Boa Vista", "Bragança Paulista", "Atibaia", "Jacareí", "Pindamonhangaba",
      "Guaratinguetá", "Lorena", "Sertãozinho", "Jaboticabal", "Matão", "Votuporanga",
      "Fernandópolis", "Jales", "Andradina", "Ituverava", "Batatais", "Mococa", "Pirassununga",
      "Porto Ferreira", "Santa Bárbara d'Oeste", "Nova Odessa", "Paulínia", "Cosmópolis",
      "Capivari", "Tietê", "Cerquilho", "Boituva", "Porto Feliz", "Votorantim", "Itapira",
      "Lençóis Paulista", "Pederneiras", "Garça", "Pompeia", "Osvaldo Cruz", "Rancharia",
      "Paraguaçu Paulista", "Cândido Mota", "Palmital", "Chavantes", "Ipaussu",
      "Bernardino de Campos", "Taquarituba", "Itaí", "Cerqueira César", "Itatinga", "Pirajuí",
      "Cafelândia",
      { nome: "Marília", termos: ["marilia sp", "cidade de marilia"] },
      { nome: "Franca", termos: ["franca sp", "cidade de franca"] },
      { nome: "Americana", termos: ["americana sp", "cidade de americana"] },
    ],
  };

  // Capital, Grande São Paulo e litoral: ficam fora do "interior de SP".
  var SP_FORA_DO_INTERIOR = [
    { nome: "São Paulo (capital)", termos: ["sao paulo capital", "capital de sao paulo", "capital paulista", "capital de sp", "sp capital"] },
    { nome: "a Grande São Paulo", termos: ["grande sao paulo", "grande sp", "regiao metropolitana de sao paulo"] },
    "Guarulhos", "Osasco", "Santo André", "São Bernardo do Campo", "São Caetano do Sul",
    "Diadema", "Mauá", "Carapicuíba", "Barueri", "Cotia", "Taboão da Serra", "Itaquaquecetuba",
    "Suzano", "Mogi das Cruzes", "Embu das Artes", "Guarujá", "Praia Grande", "Cubatão",
    "Bertioga", "Ubatuba", "Caraguatatuba", "Ilhabela", "São Sebastião", "Itanhaém", "Peruíbe",
    "Mongaguá",
    { nome: "Santos", termos: ["santos sp", "cidade de santos", "baixada santista"] },
  ];

  var ESTADOS_ATENDIDOS = [
    { nome: "o Paraná", uf: "PR", termos: ["parana", "estado do parana"] },
    { nome: "Santa Catarina", uf: "SC", termos: ["santa catarina"] },
    { nome: "o interior de São Paulo", uf: "SP", termos: ["interior de sao paulo", "interior de sp", "interior paulista", "interior do estado de sao paulo"] },
  ];

  var OUTROS_LUGARES = [
    "Rio de Janeiro", "Minas Gerais", "Belo Horizonte", "Rio Grande do Sul", "Porto Alegre",
    "Caxias do Sul", "Pelotas", "Bahia", "Salvador", "Ceará", "Fortaleza", "Pernambuco",
    "Recife", "Goiás", "Goiânia", "Distrito Federal", "Brasília", "Mato Grosso do Sul",
    "Campo Grande", "Dourados", "Mato Grosso", "Cuiabá", "Espírito Santo", "Amazonas",
    "Manaus", "Belém", "Maranhão", "São Luís", "Piauí", "Teresina", "Paraíba", "João Pessoa",
    "Rio Grande do Norte", "Alagoas", "Maceió", "Sergipe", "Aracaju", "Tocantins", "Rondônia",
    "Porto Velho", "Roraima", "Amapá", "Macapá", "Acre", "Rio Branco", "Uberlândia",
    "Juiz de Fora", "Niterói", "Paraguai", "Argentina", "Portugal", "Estados Unidos",
    { nome: "Pará", termos: ["estado do para"] },
  ];
  var UFS_FORA = ["RJ", "MG", "RS", "BA", "CE", "PE", "GO", "DF", "MS", "MT", "ES", "AM", "PA", "MA", "PI", "PB", "RN", "AL", "SE", "TO", "RO", "RR", "AP", "AC"];

  function compilarLugares(lista, extra) {
    return lista.map(function (item) {
      var nome = typeof item === "string" ? item : item.nome;
      var termos = typeof item === "string" ? [item] : item.termos;
      var lugar = { nome: nome, termos: termos.map(normalizar) };
      if (extra) Object.keys(extra).forEach(function (k) { lugar[k] = extra[k]; });
      return lugar;
    });
  }

  var LUGARES = {
    cidadesAtendidas: []
      .concat(compilarLugares(CIDADES.PR, { uf: "PR" }))
      .concat(compilarLugares(CIDADES.SC, { uf: "SC" }))
      .concat(compilarLugares(CIDADES.SP, { uf: "SP" })),
    spFora: compilarLugares(SP_FORA_DO_INTERIOR),
    estados: ESTADOS_ATENDIDOS.map(function (e) {
      return { nome: e.nome, uf: e.uf, termos: e.termos.map(normalizar) };
    }),
    outros: compilarLugares(OUTROS_LUGARES),
  };

  // Devolve o lugar cujo termo citado é o mais longo ("São José dos Campos"
  // ganha de "São José"), junto com o tamanho do termo encontrado.
  function procurar(norm, lugares) {
    var achado = null;
    lugares.forEach(function (lugar) {
      lugar.termos.forEach(function (t) {
        if (t && contemTermo(norm, t) && (!achado || t.length > achado.tamanho)) {
          achado = { lugar: lugar, tamanho: t.length };
        }
      });
    });
    return achado;
  }

  function quaseTudoMaiusculo(texto) {
    var letras = texto.replace(/[^A-Za-zÀ-ÿ]/g, "");
    if (letras.length < 6) return false;
    var maiusculas = letras.replace(/[^A-ZÀ-Þ]/g, "").length;
    return maiusculas / letras.length > 0.6;
  }

  // Procura um lugar citado na mensagem. Retorna null se não achar nenhum.
  function detectarLugar(textoOriginal) {
    var original = String(textoOriginal || "");
    var norm = normalizar(original);
    if (!norm) return null;

    var cidade = procurar(norm, LUGARES.cidadesAtendidas);
    var spFora = procurar(norm, LUGARES.spFora);
    if (spFora && (!cidade || spFora.tamanho >= cidade.tamanho)) {
      return { tipo: "sp-fora", nome: spFora.lugar.nome };
    }
    if (cidade) return { tipo: "atende", nome: cidade.lugar.nome, uf: cidade.lugar.uf };

    var estado = procurar(norm, LUGARES.estados);
    var outro = procurar(norm, LUGARES.outros);
    if (outro && (!estado || outro.tamanho > estado.tamanho)) return { tipo: "fora", nome: outro.lugar.nome };
    if (estado) return { tipo: "estado", nome: estado.lugar.nome, uf: estado.lugar.uf };

    // Siglas de outros estados só valem escritas em maiúsculas ("BH - MG"),
    // porque várias são palavras comuns ("se", "to", "pe").
    if (!quaseTudoMaiusculo(original)) {
      for (var u = 0; u < UFS_FORA.length; u++) {
        if (new RegExp("(^|[^A-Za-z])" + UFS_FORA[u] + "([^A-Za-z]|$)").test(original)) {
          return { tipo: "fora", nome: UFS_FORA[u] };
        }
      }
    }

    if (contemTermo(norm, "pr")) return { tipo: "estado", nome: "o Paraná", uf: "PR" };
    if (contemTermo(norm, "sc")) return { tipo: "estado", nome: "Santa Catarina", uf: "SC" };
    if (contemTermo(norm, "sao paulo") || contemTermo(norm, "sp")) return { tipo: "sp-ambiguo", nome: "São Paulo" };
    return null;
  }

  /* ---------------------------------------------------------------------
   * Intenções. Um termo terminado em "*" casa com qualquer palavra que
   * comece com ele ("revend*" casa com revenda, revender, revendedora...).
   * ------------------------------------------------------------------- */
  var CHIPS_INICIAIS = [
    "Como funciona a consignação?",
    "Quero ser revendedora",
    "Quais regiões vocês atendem?",
    "Quero o catálogo",
  ];

  function criarAssistente(cfg) {
    cfg = cfg || {};
    var dados = {
      nome: (cfg.assistente && cfg.assistente.nome) || "Lia",
      anos: cfg.anos || 18,
      regioes: cfg.regioes || "PR, SC e interior de SP",
      waExibicao: cfg.whatsappExibicao || "",
      instagram: cfg.instagram || "",
    };

    var WA = { tipo: "whatsapp", mensagem: "geral" };
    var WA_REVENDA = { tipo: "whatsapp", mensagem: "revenda" };
    var WA_CATALOGO = { tipo: "whatsapp", mensagem: "catalogo" };
    var WA_ATENDENTE = { tipo: "whatsapp", mensagem: "atendente" };
    var INSTAGRAM = { tipo: "instagram" };

    var INTENCOES = [
      {
        id: "saudacao", peso: 0.6, saudacao: true,
        termos: ["oi", "oii", "oie", "ola", "opa", "eai", "e ai", "hey", "hello", "bom dia", "boa tarde", "boa noite", "tudo bem", "tudo bom", "salve"],
        texto: "Oi! 💗 Que bom ter você aqui. Eu sou a {nome}, assistente virtual da Latefy Lingerie. Posso te explicar como funciona a revenda por consignação, quais regiões atendemos e como receber o catálogo. Por onde começamos?",
        chips: CHIPS_INICIAIS,
      },
      {
        id: "consignacao",
        termos: ["consign*", "como funciona", "funciona", "acerto", "acertar", "devolv*", "devoluc*", "o que sobrar", "nao vender", "nao vendi", "sobrar"],
        texto: "Na **consignação** você recebe as peças no conforto da sua casa para vender **sem precisar comprá-las antes**. A cada dois meses é feito o acerto: você paga apenas o que vendeu e devolve o que não vendeu. 💗\n\nPara começar é simples: chame a nossa equipe no WhatsApp, faça seu cadastro, receba as peças e comece a vender.",
        acao: WA_REVENDA,
        chips: ["Quero ser revendedora", "Preciso investir algo?", "Quais regiões vocês atendem?"],
      },
      {
        id: "revenda",
        termos: ["revend*", "quero vender", "vender", "ser revendedora", "trabalhar com voces", "trabalhar", "cadastr*", "como comecar", "comecar", "parceir*", "empreend*", "oportunidade", "quero ser", "fazer parte"],
        texto: "Que alegria saber que você quer fazer parte da Latefy! 💗 Há {anos} anos construímos histórias de sucesso com nossas revendedoras.\n\nO primeiro passo é chamar a nossa equipe no WhatsApp: lá você tira suas dúvidas, conhece as condições e faz o seu cadastro. Atendemos {regioes}.",
        acao: WA_REVENDA,
        chips: ["Como funciona a consignação?", "Preciso ter experiência?", "Quais peças vou vender?"],
      },
      {
        id: "investimento",
        termos: ["investiment*", "investir", "preciso pagar", "pagar algo", "pagar para", "taxa", "taxas", "mensalidade", "custo", "caucao", "entrada", "sem dinheiro", "nao tenho dinheiro", "gratis", "de graca", "comprar estoque", "estoque", "custa para comecar", "custa pra comecar", "para comecar", "pra comecar"],
        texto: "Na consignação você **não precisa comprar estoque antes de vender**: recebe as peças, vende e, no acerto, paga só o que foi vendido.\n\nAs condições do cadastro são explicadas pela nossa equipe no WhatsApp — vale a pena chamar para saber todos os detalhes. 💗",
        acao: WA_REVENDA,
        chips: ["Como funciona a consignação?", "Quero ser revendedora"],
      },
      {
        id: "kit",
        termos: ["maleta", "kit", "mostruario", "sacola", "quantas pecas", "quantidade de pecas", "pecas vem", "vem quantas", "mix"],
        texto: "A quantidade e o mix de peças que você recebe em consignação são combinados com a nossa equipe no cadastro. 💗 Chame no WhatsApp para saber como funciona para a sua região.",
        acao: WA_REVENDA,
        chips: ["Como funciona a consignação?", "Quais regiões vocês atendem?"],
      },
      {
        id: "regioes",
        termos: ["regi*", "atende", "atendem", "atender", "atendidas", "atendido", "atendida", "cidade", "cidades", "estado", "estados", "onde", "minha cidade", "perto", "regiao de", "interior"],
        texto: "Atendemos revendedoras no **Paraná**, em **Santa Catarina** e no **interior de São Paulo**. 📍\n\nMe conta: de qual cidade você é?",
        chips: ["Sou do Paraná", "Sou de Santa Catarina", "Sou do interior de SP"],
      },
      {
        id: "produtos",
        termos: ["produto*", "peca", "pecas", "quais pecas", "que pecas", "pecas vou vender", "lingeri*", "pijama*", "camisol*", "calcinh*", "sutia*", "conjunt*", "body", "bodies", "baby doll", "babydoll", "robe*", "cueca*", "masculin*", "moda intima", "vendem", "modelos", "modelo", "tipos", "tipo de", "linha", "roupa*"],
        texto: "Trabalhamos com **moda íntima**: lingeries, pijamas, camisolas e muito mais, para o dia a dia e para momentos especiais. 💗\n\nPara ver os modelos disponíveis agora, peça o catálogo atualizado à nossa equipe no WhatsApp.",
        acao: WA_CATALOGO,
        chips: ["Quero o catálogo", "Como funciona a consignação?"],
      },
      {
        id: "catalogo",
        termos: ["catalog*", "fotos", "foto", "ver as pecas", "ver pecas", "colec*", "novidade*", "lancament*"],
        texto: "Quem envia o catálogo atualizado é a nossa equipe, direto no seu WhatsApp. 💗 Toque no botão abaixo e peça o seu! Você também pode ver várias peças no nosso Instagram, **@{instagram}**.",
        acao: WA_CATALOGO,
        chips: ["Ver o Instagram", "Como funciona a consignação?"],
      },
      {
        id: "precos",
        termos: ["preco*", "valor", "valores", "quanto custa", "quanto e", "quanto sai", "quanto fica", "tabela", "barato", "caro", "custa"],
        texto: "Os valores das peças estão no catálogo, que a nossa equipe envia pelo WhatsApp — assim você sempre recebe os preços atualizados. 💗",
        acao: WA_CATALOGO,
        chips: ["Quero o catálogo", "Como funciona a consignação?"],
      },
      {
        id: "ganhos",
        termos: ["lucr*", "ganh*", "comiss*", "porcentagem", "percentual", "margem", "renda extra", "dinheiro", "rentavel", "vale a pena"],
        texto: "A comissão é de **30% a 40%** sobre as suas vendas: quanto mais você vende, mais você ganha. 💗 A nossa equipe explica todos os detalhes no cadastro pelo WhatsApp.",
        acao: WA_REVENDA,
        chips: ["Como funciona a consignação?", "Quero ser revendedora"],
      },
      {
        id: "tamanhos",
        termos: ["tamanh*", "numerac*", "plus size", "plus", "gg", "xgg", "g1", "g2", "grade", "medida*", "veste"],
        texto: "Os tamanhos variam de acordo com cada modelo. A nossa equipe mostra a grade disponível de cada peça no catálogo — é só chamar no WhatsApp. 💗",
        acao: WA_CATALOGO,
        chips: ["Quero o catálogo"],
      },
      {
        id: "pagamento",
        termos: ["pagament*", "pix", "cartao", "credito", "debito", "boleto", "parcel*", "forma de pagar", "formas de pagar", "como pago", "como pagar", "pagar"],
        texto: "O acerto da consignação é feito **a cada dois meses**: você paga as peças que vendeu e devolve as que não foram vendidas. As formas de pagamento são combinadas com a nossa equipe no WhatsApp. 💗",
        acao: WA,
        chips: ["Como funciona a consignação?"],
      },
      {
        id: "entrega",
        termos: ["entreg*", "frete", "envi*", "prazo*", "correio*", "transportadora", "chega", "chegam", "demora", "retirar", "retirada"],
        texto: "As peças chegam no conforto da sua casa. 📦 Os prazos de entrega dependem da sua cidade, e a nossa equipe informa tudo certinho pelo WhatsApp.",
        acao: WA,
        chips: ["Quais regiões vocês atendem?"],
      },
      {
        id: "varejo",
        termos: ["comprar", "compra", "uso proprio", "pra mim", "para mim", "consumidor", "varejo", "atacado", "presente", "presentear"],
        texto: "Quer comprar para você ou para presentear? 💗 Fale com a nossa equipe no WhatsApp: eles mostram as peças disponíveis e explicam como comprar.",
        acao: WA_CATALOGO,
        chips: ["Quero o catálogo"],
      },
      {
        id: "experiencia",
        termos: ["experienc*", "nunca vendi", "iniciante", "comecando", "primeira vez", "nao sei vender", "novata", "nunca trabalhei"],
        texto: "Seja você iniciante ou já experiente em vendas, a nossa equipe explica direitinho como funciona a revenda e tira todas as suas dúvidas antes do cadastro. 💗 É só chamar no WhatsApp.",
        acao: WA_REVENDA,
        chips: ["Como funciona a consignação?", "Quero ser revendedora"],
      },
      {
        id: "requisitos",
        termos: ["requisit*", "documento*", "o que precisa", "o que preciso", "precisa de que", "cpf", "cnpj", "mei", "nome sujo", "score", "spc", "serasa", "aprovac*", "aprovad*", "analise", "idade", "menor de idade", "comprovante", "quem pode", "quem pode ser revendedora", "quem pode vender", "posso ser revendedora", "idade minima", "minimo de idade", "idade para vender", "maior de idade", "25 anos", "quantos anos preciso", "quantos anos precisa"],
        texto: "Para vender com a Latefy é preciso ter **acima de 25 anos**. O restante do cadastro é feito com a nossa equipe no WhatsApp. 💗\n\nPor segurança, não envie documentos ou dados pessoais aqui no chat: trate o cadastro direto com a equipe.",
        acao: WA_REVENDA,
        chips: ["Como funciona a consignação?"],
      },
      {
        id: "horario",
        termos: ["horario*", "horario de atendimento", "atendimento", "que horas", "aberto", "aberta", "abre", "fecha", "funcionamento", "final de semana", "sabado", "domingo", "feriado"],
        texto: "Você pode mandar mensagem no WhatsApp a qualquer momento: a nossa equipe responde assim que possível. 💗",
        acao: WA,
        chips: ["Quero ser revendedora"],
      },
      {
        id: "endereco",
        termos: ["endereco", "onde fica", "onde voces ficam", "sede", "loja fisica", "visitar", "pessoalmente", "presencial"],
        texto: "Para informações sobre endereço e atendimento presencial, fale com a nossa equipe no WhatsApp. 💗",
        acao: WA,
        chips: ["Quais regiões vocês atendem?"],
      },
      {
        id: "sobre",
        termos: ["quem sao", "quem e a latefy", "latefy", "sobre", "historia", "empresa", "tempo de mercado", "anos", "confiavel", "confianca", "seguro", "golpe", "e verdade", "marca"],
        texto: "A **Latefy Lingerie** está há **{anos} anos** construindo histórias de sucesso. Somos uma distribuidora de moda íntima por consignação e atendemos revendedoras em {regioes}. 💗 Quer saber como fazer parte?",
        chips: ["Quero ser revendedora", "Como funciona a consignação?"],
      },
      {
        id: "contato",
        termos: ["whatsapp", "whats", "zap", "zapzap", "wpp", "telefone", "contato", "ligar", "ligacao", "numero", "falar com", "atendente", "humano", "humana", "pessoa", "vendedora", "consultora", "equipe"],
        texto: "Claro! Você pode falar com a nossa equipe pelo WhatsApp **{waExibicao}**: é só tocar no botão abaixo. 💗 Se preferir, também estamos no Instagram, **@{instagram}**.",
        acao: WA_ATENDENTE,
        chips: ["Ver o Instagram"],
      },
      {
        id: "instagram",
        termos: ["instagram", "insta", "redes sociais", "rede social", "perfil", "depoiment*"],
        texto: "Siga a gente no Instagram: **@{instagram}** 💗 Lá você vê novidades, peças e os **depoimentos** das nossas revendedoras nos destaques.",
        acao: INSTAGRAM,
        chips: ["Quero ser revendedora"],
      },
      {
        id: "ia", peso: 0.9,
        termos: ["robo", "bot", "inteligencia artificial", "ia", "voce e real", "quem e voce", "seu nome", "voce e uma pessoa", "lia"],
        texto: "Eu sou a {nome}, a assistente virtual da Latefy. 💗 Respondo as dúvidas mais comuns sobre a revenda e a marca. Para falar com uma pessoa da nossa equipe, é só chamar no WhatsApp.",
        acao: WA_ATENDENTE,
        chips: CHIPS_INICIAIS.slice(0, 3),
      },
      {
        id: "agradecimento", peso: 0.7,
        termos: ["obrigad*", "valeu", "brigad*", "gratidao", "agradeco", "otimo", "perfeito", "entendi", "show", "maravilha"],
        texto: "Eu que agradeço! 💗 Se surgir qualquer outra dúvida, é só chamar. E quando quiser dar o próximo passo, a nossa equipe está te esperando no WhatsApp.",
        acao: WA_REVENDA,
        chips: [],
      },
      {
        id: "despedida", peso: 0.7,
        termos: ["tchau", "ate mais", "ate logo", "falou", "bye", "xau"],
        texto: "Até logo! 💗 Foi um prazer conversar com você.",
        chips: [],
      },
    ];

    var FALLBACK = {
      id: "fallback",
      texto: "Hmm, não tenho certeza se entendi. 🤔 Posso te ajudar com:\n• como funciona a revenda por consignação\n• as regiões que atendemos\n• catálogo e peças\n\nSe preferir, fale com a nossa equipe no WhatsApp.",
      acao: WA_ATENDENTE,
      chips: CHIPS_INICIAIS.slice(0, 3),
    };

    var compiladas = INTENCOES.map(function (it) {
      return {
        def: it,
        termos: it.termos.map(function (t) {
          var prefixo = t.charAt(t.length - 1) === "*";
          return { texto: normalizar(prefixo ? t.slice(0, -1) : t), prefixo: prefixo };
        }),
      };
    });

    function pontuar(norm, tokens, comp) {
      var pontos = 0;
      comp.termos.forEach(function (t) {
        if (t.texto.indexOf(" ") !== -1) {
          if (contemTermo(norm, t.texto)) pontos += 2 + t.texto.split(" ").length * 0.5;
        } else if (t.prefixo) {
          for (var i = 0; i < tokens.length; i++) {
            if (tokens[i].indexOf(t.texto) === 0) { pontos += 1.5; break; }
          }
        } else if (tokens.indexOf(t.texto) !== -1) {
          pontos += t.texto.length >= 6 ? 1.5 : 1;
        }
      });
      return pontos * (comp.def.peso || 1);
    }

    function montar(def, prefixo) {
      return {
        id: def.id,
        texto: (prefixo || "") + preencher(def.texto, dados),
        acao: def.acao || null,
        chips: (def.chips || []).slice(),
      };
    }

    function respostaLugar(lugar) {
      var base = { acao: WA_REVENDA, chips: ["Como funciona a consignação?", "Preciso investir algo?"] };
      var texto;
      if (lugar.tipo === "atende") {
        texto = "Que ótimo! " + lugar.nome + " (" + lugar.uf + ") fica na região que a Latefy atende. 💗 Chame a nossa equipe no WhatsApp para confirmar os detalhes da sua cidade e fazer o seu cadastro.";
      } else if (lugar.tipo === "estado") {
        var nome = lugar.nome.charAt(0).toUpperCase() + lugar.nome.slice(1);
        texto = "Ótimo! " + nome + " está entre as regiões que a Latefy atende. 💗 Chame a nossa equipe no WhatsApp para confirmar os detalhes da sua cidade e fazer o seu cadastro.";
      } else if (lugar.tipo === "sp-ambiguo") {
        texto = "Atendemos o **interior de São Paulo**. 💗 Se você é do interior, é só chamar a nossa equipe no WhatsApp. Para a capital e a região metropolitana, confirme a disponibilidade com a equipe.";
        base.chips = ["Como funciona a consignação?"];
      } else if (lugar.tipo === "sp-fora") {
        texto = "Hoje a Latefy atende o **interior de São Paulo**, além do Paraná e de Santa Catarina. Para " + lugar.nome + ", confirme a disponibilidade com a nossa equipe no WhatsApp: eles te orientam direitinho. 💗";
        base.chips = ["Como funciona a consignação?"];
      } else {
        texto = "No momento a Latefy atende revendedoras no Paraná, em Santa Catarina e no interior de São Paulo. Mesmo assim, fale com a nossa equipe no WhatsApp para saber se há alguma possibilidade para " + lugar.nome + ". 💗";
        base.chips = ["Como funciona a consignação?"];
      }
      return { id: "lugar-" + lugar.tipo, texto: texto, acao: base.acao, chips: base.chips };
    }

    // Quando a pessoa cita um lugar, a resposta sobre o lugar ganha destas
    // intenções ("sou de Londrina e quero revender"); das outras, não
    // ("qual o prazo de entrega para Joinville?").
    var LUGAR_VENCE = ["regioes", "revenda", "saudacao", "sobre", "agradecimento", "consignacao"];

    function responder(mensagem) {
      var norm = normalizar(mensagem);
      if (!norm) return montar(FALLBACK);
      var tokens = norm.split(" ");

      var ranking = compiladas
        .map(function (c) { return { def: c.def, pontos: pontuar(norm, tokens, c) }; })
        .filter(function (r) { return r.pontos > 0; })
        .sort(function (a, b) { return b.pontos - a.pontos; });

      var temSaudacao = ranking.some(function (r) { return r.def.saudacao; });
      var melhor = ranking.filter(function (r) { return !r.def.saudacao; })[0];

      var lugar = detectarLugar(mensagem);
      if (lugar && (!melhor || LUGAR_VENCE.indexOf(melhor.def.id) !== -1)) {
        var rl = respostaLugar(lugar);
        if (temSaudacao) rl.texto = "Oi! " + rl.texto;
        return rl;
      }

      if (melhor) return montar(melhor.def, temSaudacao && melhor.def.id !== "despedida" ? "Oi! " : "");
      if (temSaudacao) return montar(ranking[0].def);
      return montar(FALLBACK);
    }

    return {
      responder: responder,
      boasVindas: function () {
        return {
          id: "boas-vindas",
          texto: preencher("Olá! Eu sou a **{nome}**, assistente virtual da Latefy Lingerie. 💗\n\nPosso te explicar como funciona a revenda por consignação, as regiões que atendemos e como receber o catálogo. Como posso te ajudar?", dados),
          acao: null,
          chips: CHIPS_INICIAIS.slice(),
        };
      },
      chipsPadrao: function () {
        return ["Como funciona a consignação?", "Quero ser revendedora", "Falar com atendente"];
      },
    };
  }

  root.LatefyAssistente = {
    criarAssistente: criarAssistente,
    normalizar: normalizar,
    detectarLugar: detectarLugar,
  };
})(typeof window !== "undefined" ? window : globalThis);
