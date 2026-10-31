// Nomes que o robô reconhece nos títulos: cidades, companhias, programas de pontos e bancos.
// [nome mostrado, código IATA (ou ""), "br" | "int", nordeste?, ...outros jeitos de escrever]

export const CIDADES = [
  // Nordeste
  ["Teresina", "THE", "br", true], ["Parnaíba", "PHB", "br", true], ["Fortaleza", "FOR", "br", true], ["São Luís", "SLZ", "br", true, "sao luis"],
  ["Recife", "REC", "br", true], ["Natal", "NAT", "br", true], ["João Pessoa", "JPA", "br", true], ["Maceió", "MCZ", "br", true],
  ["Aracaju", "AJU", "br", true], ["Salvador", "SSA", "br", true], ["Porto Seguro", "BPS", "br", true], ["Ilhéus", "IOS", "br", true],
  ["Jericoacoara", "JJD", "br", true, "jeri"], ["Juazeiro do Norte", "JDO", "br", true], ["Petrolina", "PNZ", "br", true],
  ["Imperatriz", "IMP", "br", true], ["Fernando de Noronha", "FEN", "br", true, "noronha"], ["Campina Grande", "CPV", "br", true],
  ["Lençóis Maranhenses", "BRB", "br", true, "lencois maranhenses", "barreirinhas"], ["Porto de Galinhas", "REC", "br", true],
  ["Maragogi", "MCZ", "br", true], ["Morro de São Paulo", "SSA", "br", true], ["Trancoso", "BPS", "br", true], ["Pipa", "NAT", "br", true],
  // demais do Brasil
  ["São Paulo", "SAO", "br", false, "sao paulo", "guarulhos", "congonhas", "viracopos", "campinas"], ["Rio de Janeiro", "RIO", "br", false, "rio"],
  ["Brasília", "BSB", "br", false, "brasilia"], ["Belo Horizonte", "BHZ", "br", false, "bh", "confins"], ["Curitiba", "CWB", "br", false],
  ["Porto Alegre", "POA", "br", false], ["Florianópolis", "FLN", "br", false, "floripa"], ["Goiânia", "GYN", "br", false],
  ["Belém", "BEL", "br", false], ["Manaus", "MAO", "br", false], ["Cuiabá", "CGB", "br", false], ["Campo Grande", "CGR", "br", false],
  ["Vitória", "VIX", "br", false], ["Palmas", "PMW", "br", false], ["Porto Velho", "PVH", "br", false], ["Rio Branco", "RBR", "br", false],
  ["Macapá", "MCP", "br", false], ["Boa Vista", "BVB", "br", false], ["Foz do Iguaçu", "IGU", "br", false, "foz"],
  ["Navegantes", "NVT", "br", false], ["Uberlândia", "UDI", "br", false], ["Ribeirão Preto", "RAO", "br", false], ["Londrina", "LDB", "br", false],
  ["Maringá", "MGF", "br", false], ["Joinville", "JOI", "br", false], ["Chapecó", "XAP", "br", false], ["Caxias do Sul", "CXJ", "br", false],
  ["Gramado", "POA", "br", false], ["Bonito", "BYO", "br", false], ["Santarém", "STM", "br", false], ["Marabá", "MAB", "br", false],
  ["Montes Claros", "MOC", "br", false], ["São José dos Campos", "SJK", "br", false], ["Alta Floresta", "AFL", "br", false],
  // internacional: cidades
  ["Lisboa", "LIS", "int", false, "lisbon"], ["Porto", "OPO", "int", false], ["Madri", "MAD", "int", false, "madrid"], ["Barcelona", "BCN", "int", false],
  ["Paris", "PAR", "int", false], ["Roma", "ROM", "int", false], ["Milão", "MIL", "int", false, "milao"], ["Veneza", "VCE", "int", false],
  ["Florença", "FLR", "int", false], ["Londres", "LON", "int", false], ["Amsterdã", "AMS", "int", false, "amsterda", "amsterdam"],
  ["Frankfurt", "FRA", "int", false], ["Munique", "MUC", "int", false], ["Zurique", "ZRH", "int", false], ["Bruxelas", "BRU", "int", false],
  ["Dublin", "DUB", "int", false], ["Atenas", "ATH", "int", false], ["Praga", "PRG", "int", false], ["Viena", "VIE", "int", false],
  ["Istambul", "IST", "int", false], ["Dubai", "DXB", "int", false], ["Doha", "DOH", "int", false], ["Cairo", "CAI", "int", false],
  ["Tel Aviv", "TLV", "int", false], ["Joanesburgo", "JNB", "int", false], ["Cidade do Cabo", "CPT", "int", false],
  ["Tóquio", "TYO", "int", false, "toquio"], ["Pequim", "BJS", "int", false], ["Xangai", "SHA", "int", false], ["Bangkok", "BKK", "int", false],
  ["Singapura", "SIN", "int", false], ["Sydney", "SYD", "int", false], ["Nova Délhi", "DEL", "int", false, "nova delhi"],
  ["Orlando", "ORL", "int", false], ["Miami", "MIA", "int", false], ["Nova York", "NYC", "int", false, "nova iorque", "new york"],
  ["Fort Lauderdale", "FLL", "int", false], ["Los Angeles", "LAX", "int", false], ["Las Vegas", "LAS", "int", false], ["Chicago", "CHI", "int", false],
  ["Boston", "BOS", "int", false], ["Washington", "WAS", "int", false], ["Atlanta", "ATL", "int", false], ["Dallas", "DFW", "int", false],
  ["Houston", "HOU", "int", false], ["São Francisco", "SFO", "int", false, "sao francisco"], ["Toronto", "YTO", "int", false],
  ["Montreal", "YMQ", "int", false], ["Cidade do México", "MEX", "int", false, "cidade do mexico"], ["Cancún", "CUN", "int", false, "cancun"],
  ["Punta Cana", "PUJ", "int", false], ["Havana", "HAV", "int", false], ["Aruba", "AUA", "int", false], ["Curaçao", "CUR", "int", false, "curacao"],
  ["San Andrés", "ADZ", "int", false, "san andres"], ["Cartagena", "CTG", "int", false], ["Bogotá", "BOG", "int", false, "bogota"],
  ["Medellín", "MDE", "int", false, "medellin"], ["Cidade do Panamá", "PTY", "int", false, "panama"], ["Lima", "LIM", "int", false],
  ["Cusco", "CUZ", "int", false, "cuzco"], ["Santiago", "SCL", "int", false], ["Buenos Aires", "BUE", "int", false], ["Bariloche", "BRC", "int", false],
  ["Mendoza", "MDZ", "int", false], ["Ushuaia", "USH", "int", false], ["El Calafate", "FTE", "int", false], ["Córdoba", "COR", "int", false, "cordoba"],
  ["Montevidéu", "MVD", "int", false, "montevideu", "montevideo"], ["Punta del Este", "PDP", "int", false], ["Assunção", "ASU", "int", false, "assuncao"],
  ["Santa Cruz de la Sierra", "VVI", "int", false], ["Quito", "UIO", "int", false], ["Caracas", "CCS", "int", false],
  ["Atacama", "CJC", "int", false, "san pedro de atacama"], ["Caribe", "", "int", false],
  // internacional: países e regiões
  ["Portugal", "", "int", false], ["Espanha", "", "int", false], ["França", "", "int", false, "franca"], ["Itália", "", "int", false, "italia"],
  ["Alemanha", "", "int", false], ["Inglaterra", "", "int", false, "reino unido"], ["Holanda", "", "int", false], ["Suíça", "", "int", false, "suica"],
  ["Grécia", "", "int", false, "grecia"], ["Turquia", "", "int", false], ["Egito", "", "int", false], ["Marrocos", "", "int", false],
  ["Japão", "", "int", false, "japao"], ["China", "", "int", false], ["Tailândia", "", "int", false, "tailandia"], ["Austrália", "", "int", false, "australia"],
  ["Estados Unidos", "", "int", false, "eua"], ["Canadá", "", "int", false, "canada"], ["México", "", "int", false, "mexico"],
  ["Argentina", "", "int", false], ["Chile", "", "int", false], ["Uruguai", "", "int", false], ["Paraguai", "", "int", false], ["Peru", "", "int", false],
  ["Colômbia", "", "int", false, "colombia"], ["Bolívia", "", "int", false, "bolivia"], ["Equador", "", "int", false], ["Cuba", "", "int", false],
  ["República Dominicana", "", "int", false, "republica dominicana"], ["Europa", "", "int", false], ["Ásia", "", "int", false, "asia"],
  ["África do Sul", "", "int", false, "africa do sul"], ["Oriente Médio", "", "int", false, "oriente medio"], ["Maldivas", "", "int", false],
];

// [nome, código IATA da companhia, ...jeitos de escrever (regex sem acento, minúsculas)]
export const CIAS = [
  ["LATAM", "LA", "latam(?! pass)", "latam airlines"], ["GOL", "G3", "\\bgol\\b"], ["Azul", "AD", "\\bazul\\b(?! fidelidade)(?!\\s*viagens)"],
  ["TAP", "TP", "\\btap\\b(?! miles)"], ["Copa Airlines", "CM", "copa airlines"], ["American Airlines", "AA", "american airlines", "\\bamerican\\b(?! express)"],
  ["United", "UA", "united airlines", "\\bunited\\b"], ["Delta", "DL", "delta air ?lines", "\\bdelta\\b(?! do\\b)"], ["Air France", "AF", "air france"],
  ["KLM", "KL", "\\bklm\\b"], ["Iberia", "IB", "\\biberia\\b(?! plus)"], ["Air Europa", "UX", "air europa"], ["Emirates", "EK", "\\bemirates\\b(?! skywards)"],
  ["Qatar Airways", "QR", "qatar airways", "\\bqatar\\b(?! privilege)"], ["Turkish Airlines", "TK", "turkish airlines", "\\bturkish\\b(?! miles)"],
  ["Aerolíneas Argentinas", "AR", "aerolineas argentinas"], ["Avianca", "AV", "\\bavianca\\b(?! lifemiles)"], ["JetSMART", "JA", "jetsmart"],
  ["Flybondi", "FO", "flybondi"], ["Sky Airline", "H2", "sky airline"], ["Arajet", "DM", "arajet"], ["Lufthansa", "LH", "lufthansa"],
  ["Swiss", "LX", "\\bswiss\\b"], ["ITA Airways", "AZ", "ita airways"], ["British Airways", "BA", "british airways"], ["Ethiopian", "ET", "ethiopian"],
  ["Royal Air Maroc", "AT", "royal air maroc"], ["Aeroméxico", "AM", "aeromexico"], ["Paranair", "ZP", "paranair"], ["Air Canada", "AC", "air canada"],
  ["Edelweiss", "WK", "edelweiss"], ["Condor", "DE", "\\bcondor\\b"], ["Azores Airlines", "S4", "azores airlines"], ["Boliviana", "OB", "boliviana de aviacao", "\\bboa\\b"],
  ["Voepass", "2Z", "voepass"], ["Air China", "CA", "air china"],
];

// [nome, ...regex]
export const PROGRAMAS = [
  ["Miles&Smiles", "miles ?& ?smiles"], // da Turkish: testado antes da Smiles
  ["Smiles", "\\bsmiles\\b"], ["LATAM Pass", "latam ?pass"], ["Azul Fidelidade", "azul fidelidade", "tudo ?azul", "clube azul"],
  ["Livelo", "\\blivelo\\b"], ["Esfera", "\\besfera\\b"], ["Átomos", "\\batomos\\b"], ["Inter Loop", "inter loop", "\\bloop\\b"],
  ["Dotz", "\\bdotz\\b"], ["Km de Vantagens", "km de vantagens"], ["AAdvantage", "aadvantage"], ["TAP Miles&Go", "miles ?& ?go"],
  ["Flying Blue", "flying blue"], ["Avios", "\\bavios\\b", "iberia plus", "iberia club", "privilege club"], ["Aeroplan", "aeroplan"],
  ["LifeMiles", "lifemiles"], ["ConnectMiles", "connectmiles"], ["MileagePlus", "mileageplus"], ["SkyMiles", "skymiles"],
  ["Emirates Skywards", "skywards"], ["ALL Accor", "\\ball accor\\b", "accor all"], ["Coopera", "\\bcoopera\\b"], ["Curtaí", "\\bcurtai\\b"],
];

export const BANCOS = [
  ["Itaú", "\\bitau\\b", "\\biupp\\b"], ["Bradesco", "bradesco"], ["Santander", "santander"], ["Nubank", "nubank"], ["Banco do Brasil", "banco do brasil", "\\bbb\\b"],
  ["Caixa", "\\bcaixa\\b"], ["C6", "\\bc6\\b"], ["Inter", "banco inter", "\\binter\\b(?! loop)(?!nac)"], ["XP", "\\bxp\\b"], ["BTG", "\\bbtg\\b"],
  ["Sicredi", "sicredi"], ["Sicoob", "sicoob"], ["Porto Bank", "porto bank", "cartao porto"], ["Mercado Pago", "mercado pago"], ["PicPay", "picpay"],
];

/** Nome de 2 letras da companhia (ex.: "G3") → nome. */
export const NOME_CIA = Object.fromEntries(CIAS.map(([n, c]) => [c, n]));
/** Código IATA → cidade. */
export const CIDADE_IATA = {};
for (const c of CIDADES) if (c[1] && !CIDADE_IATA[c[1]]) CIDADE_IATA[c[1]] = c[0];
Object.assign(CIDADE_IATA, { GRU: "São Paulo", CGH: "São Paulo", VCP: "Campinas", GIG: "Rio de Janeiro", SDU: "Rio de Janeiro", CNF: "Belo Horizonte", MCO: "Orlando", JFK: "Nova York", EWR: "Nova York", EZE: "Buenos Aires", AEP: "Buenos Aires", CDG: "Paris", ORY: "Paris", FCO: "Roma", MXP: "Milão", LHR: "Londres", LGW: "Londres", NRT: "Tóquio", HND: "Tóquio" });
