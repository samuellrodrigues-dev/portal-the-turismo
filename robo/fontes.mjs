// De onde vêm as promoções. Para tirar uma fonte, apague a linha; para pôr outra, copie uma linha parecida.
// tipo: "passagens" | "milhas" | "misto" (as duas abas) | "noticias" (só entra o que for promoção ou falar de Teresina)
// url: o feed (RSS). site: a página inicial, usada para achar o feed sozinho se o endereço mudar.

const noticias = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:7d")}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

export const FONTES = [
  // ─── blogs de promoção ───
  { id: "md", nome: "Melhores Destinos", tipo: "misto", url: "https://www.melhoresdestinos.com.br/feed", site: "https://www.melhoresdestinos.com.br/" },
  { id: "catraca", nome: "Catraca Livre Viagem", tipo: "passagens", url: "https://catracalivre.com.br/viagem-livre/feed/", site: "https://catracalivre.com.br/viagem-livre/" },
  { id: "vt", nome: "Viagem e Turismo", tipo: "passagens", url: "https://viagemeturismo.abril.com.br/feed/", site: "https://viagemeturismo.abril.com.br/" },
  { id: "farejador", nome: "Farejador de Milhas", tipo: "misto", url: "https://farejadordemilhas.com.br/feed/", site: "https://farejadordemilhas.com.br/" },

  // ─── blogs de milhas e pontos ───
  { id: "pp", nome: "Passageiro de Primeira", tipo: "milhas", url: "https://passageirodeprimeira.com/feed/", site: "https://passageirodeprimeira.com/" },
  { id: "ppv", nome: "Pontos pra Voar", tipo: "milhas", url: "https://pontospravoar.com/feed/", site: "https://pontospravoar.com/" },
  { id: "melhorescartoes", nome: "Melhores Cartões", tipo: "milhas", url: "https://www.melhorescartoes.com.br/feed", site: "https://www.melhorescartoes.com.br/" },
  { id: "cartoesme", nome: "Cartões de Crédito.me", tipo: "milhas", url: "https://www.cartoesdecredito.me/feed/", site: "https://www.cartoesdecredito.me/" },
  { id: "flipmilhas", nome: "Flip Milhas", tipo: "milhas", url: "https://flipmilhas.com/blog/feed/", site: "https://flipmilhas.com/blog/" },

  // ─── sites que bloqueiam robôs ou não têm feed: lidos pelo Google Notícias ───
  // (notícias do setor: só entra o que for promoção ou falar de Teresina)
  { id: "gn-voopter", nome: "Voopter (via Google Notícias)", tipo: "passagens", url: noticias("site:voopter.com.br"), google: true },
  { id: "gn-viajanamilha", nome: "Viaja na Milha (via Google Notícias)", tipo: "milhas", url: noticias("site:viajanamilha.com.br"), google: true },
  { id: "gn-meumilhao", nome: "Meu Milhão de Milhas (via Google Notícias)", tipo: "milhas", url: noticias("site:meumilhaodemilhas.com"), google: true },
  { id: "gn-aeroin", nome: "AEROIN (via Google Notícias)", tipo: "noticias", url: noticias("site:aeroin.net (promoção OR passagens OR Teresina OR milhas)"), google: true },
  { id: "gn-aeroflap", nome: "AEROFLAP (via Google Notícias)", tipo: "noticias", url: noticias("site:aeroflap.com.br (promoção OR passagens OR Teresina OR milhas)"), google: true },
  { id: "gn-mercado", nome: "Mercado & Eventos (via Google Notícias)", tipo: "noticias", url: noticias("site:mercadoeeventos.com.br (promoção OR passagens OR Teresina)"), google: true },
  { id: "gn-panrotas", nome: "PANROTAS (via Google Notícias)", tipo: "noticias", url: noticias("site:panrotas.com.br (promoção OR passagens OR Teresina)"), google: true },

  // ─── Google Notícias: pega o que outros sites publicaram ───
  { id: "gn-promo", nome: "Google Notícias · promoção de passagens", tipo: "passagens", url: noticias('"promoção" passagens aéreas'), google: true },
  { id: "gn-apartir", nome: "Google Notícias · passagens a partir de R$", tipo: "passagens", url: noticias('passagens "a partir de R$"'), google: true },
  { id: "gn-teresina", nome: "Google Notícias · Teresina", tipo: "passagens", url: noticias("(voos OR passagens OR aeroporto) Teresina"), google: true },
  { id: "gn-cias", nome: "Google Notícias · Latam, Gol e Azul", tipo: "passagens", url: noticias("promoção (Latam OR Gol OR Azul) passagens"), google: true },
  { id: "gn-intl", nome: "Google Notícias · internacionais", tipo: "passagens", url: noticias("passagens internacionais promoção"), google: true },
  { id: "gn-pacotes", nome: "Google Notícias · pacotes", tipo: "passagens", url: noticias("pacotes de viagem promoção aéreo hotel"), google: true },
  { id: "gn-bonus", nome: "Google Notícias · bônus de transferência", tipo: "milhas", url: noticias("bônus transferência pontos milhas"), google: true },
  { id: "gn-smiles", nome: "Google Notícias · Smiles", tipo: "milhas", url: noticias("Smiles promoção milhas"), google: true },
  { id: "gn-latampass", nome: "Google Notícias · LATAM Pass", tipo: "milhas", url: noticias('"Latam Pass" promoção'), google: true },
  { id: "gn-azul", nome: "Google Notícias · Azul Fidelidade", tipo: "milhas", url: noticias('"Azul Fidelidade" promoção'), google: true },
  { id: "gn-livelo", nome: "Google Notícias · Livelo", tipo: "milhas", url: noticias("Livelo (bônus OR promoção)"), google: true },
  { id: "gn-esfera", nome: "Google Notícias · Esfera", tipo: "milhas", url: noticias("Esfera pontos (bônus OR promoção)"), google: true },
  { id: "gn-compra", nome: "Google Notícias · compra de milhas", tipo: "milhas", url: noticias("compra de milhas desconto milheiro"), google: true },
  { id: "gn-resgate", nome: "Google Notícias · passagens com milhas", tipo: "milhas", url: noticias('passagens "mil milhas" trecho'), google: true },
];
