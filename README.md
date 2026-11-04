# Latefy Lingerie · site oficial

Site da **Latefy Lingerie Oficial**, distribuidora de moda íntima por consignação
(PR, SC e interior de SP). Inclui:

- página única com abertura animada, hero com fotos, faixa animada, nossa história,
  passo a passo da revenda, coleções, depoimentos, Instagram, dúvidas e contato;
- botões de WhatsApp com mensagem pronta (revenda, catálogo, cada coleção);
- formulário "Quero ser revendedora" que abre o WhatsApp com nome, cidade e estado;
- **Lia, suporte com IA**: chat que responde dúvidas com a API do Claude e passa
  para o WhatsApp quando precisa de uma pessoa;
- layout responsivo, acessível e leve (sem frameworks; fontes e imagens locais).

## Colocar no ar

### Opção 1: Vercel (recomendada, com a IA funcionando)

1. Entre em [vercel.com](https://vercel.com) com a conta do GitHub.
2. Clique em **Add New → Project** e importe o repositório `link`.
3. Em *Framework Preset* deixe **Other** e clique em **Deploy**. Não precisa de
   comando de build.
4. Para ligar a IA: em **Settings → Environment Variables**, crie
   `ANTHROPIC_API_KEY` com uma chave de [console.anthropic.com](https://console.anthropic.com)
   e faça um **Redeploy**.

Sem a chave, o site funciona normalmente e o chat responde no **modo automático**
(respostas prontas sobre revenda, regiões, catálogo etc.).

### Opção 2: GitHub Pages (grátis, chat no modo automático)

1. No repositório, abra **Settings → Pages**.
2. Em *Source* escolha **Deploy from a branch**, selecione o branch do site e a
   pasta **/ (root)** e clique em **Save**.
3. Em alguns minutos o site fica em `https://<usuario>.github.io/link/`.

O GitHub Pages não roda a função de IA; o chat usa o modo automático. Em
repositórios privados, o Pages exige um plano pago do GitHub.

### Depois de publicar

- Em `index.html`, troque `og:image` por um endereço completo
  (ex.: `https://seusite.com.br/assets/img/og-latefy.jpg`). Assim a prévia aparece
  quando o link é compartilhado no WhatsApp e no Instagram.
- Se tiver domínio próprio, conecte nas configurações da Vercel (ou do Pages).

## Editar o conteúdo

| O que | Onde |
| --- | --- |
| WhatsApp, Instagram, mensagens prontas, nome da assistente | `assets/js/config.js` |
| Depoimentos de revendedoras (só reais e autorizados) | `assets/js/config.js` → `depoimentos` |
| Textos do site | `index.html` |
| Condições da revenda (comissão, acerto, idade) | `index.html` (bloco "Condições para revendedoras" e dúvidas), `assets/js/assistente-base.js` e `api/_lib/prompt.js` |
| Respostas do modo automático do chat | `assets/js/assistente-base.js` |
| O que a IA sabe e como responde | `api/_lib/prompt.js` |
| Cores, fontes e animações | `assets/css/style.css` (variáveis no topo) |

As fotos em `assets/img/` foram recortadas do Instagram da marca e estão em
resolução baixa. Para um resultado melhor, substitua pelos arquivos originais em
alta, mantendo os mesmos nomes (formato `.webp` ou ajuste o nome no HTML).

Revise com a Latefy os textos de marketing e a página `privacidade.html` antes de
divulgar o site.

## Suporte com IA (como funciona)

- O chat do site (`assets/js/chat.js`) consulta `GET /api/chat`. Se a IA estiver
  configurada, envia a conversa para `POST /api/chat` e mostra a resposta enquanto
  ela é gerada. Se não estiver, usa a base de respostas de `assistente-base.js`.
- A função `api/chat.js` usa o SDK oficial `@anthropic-ai/sdk` com o modelo
  `claude-opus-5-5` em esforço `low` (respostas curtas e rápidas). Dá para trocar
  com as variáveis `ANTHROPIC_MODEL` e `ANTHROPIC_EFFORT`. Por exemplo,
  `ANTHROPIC_MODEL=claude-haiku-5-5` custa bem menos por mensagem.
- Se o modelo recusar uma pergunta por política de segurança, a API tenta de novo
  automaticamente num modelo alternativo (`fallbacks: "default"`).
- A chave fica só no servidor. Há limite de 30 mensagens a cada 10 minutos por
  visitante e de 800 caracteres por mensagem, para segurar custos e abusos.
- A API da Anthropic cobra por uso: cada resposta curta custa poucos centavos de
  dólar. Acompanhe o consumo no console da Anthropic.
- A Lia (com ou sem IA) informa só as condições oficiais da revenda (comissão de 30% a
  40%, peças em casa, acerto a cada dois meses, acima de 25 anos) e não inventa preços,
  prazos ou outras condições: para isso ela manda a pessoa para o WhatsApp da equipe.

## Rodar no computador

Requer Node.js 20.12 ou mais novo.

```bash
npm install
cp .env.example .env   # opcional: coloque sua ANTHROPIC_API_KEY
npm start              # abre em http://localhost:3000
npm test               # testes do chat e da função de IA
```

## Estrutura

```
index.html            página principal
privacidade.html      política de privacidade
404.html              página de erro
assets/css/           estilos
assets/js/            config, interações, chat e base de respostas
assets/img/           fotos, logo, ícones e imagem de compartilhamento
assets/fonts/         fontes (licença OFL)
api/chat.js           função de IA (Vercel)
api/_lib/             lógica da função e instruções da assistente
server.js             servidor local (site + IA)
tests/                testes automatizados
```
