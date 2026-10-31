# Sistemas THE TURISMO

Um site só, com login por **nome + PIN**, e cada sistema numa aba:

| Aba | O que é | Onde ficam os dados |
|---|---|---|
| **Oktoplus** | Quem está com cada conta Oktoplus (pegar, devolver, esgotou, histórico) e **Logins** (CPF, senha e e-mail das contas e dos outros sistemas da agência) | Firestore (contas copiadas do Neon uma vez; logins colados da planilha) |
| **Sala VIP** | O mesmo sistema de antes, com o painel "Emitir hoje" | Firestore, **os mesmos dados de hoje** (coleção `usos`) |
| **Valores a receber** | **A receber**: quem deve, CPF/CNPJ, prazo e parcelas · **Boletos a pagar**: os boletos da agência, como antes. Tema de céu e nuvens | Firestore (`receber` e `boletos`) |
| **Passagens** | Promoções de passagens num painel de embarque: destaques, radar saindo de Teresina, filtros, texto pronto para o WhatsApp | Firestore (`promocoes`), gravado pelo robô |
| **Milhas** | Bônus de transferência, passagens com milhas, compra de milhas e milheiro, por programa | Firestore (`promocoes`), gravado pelo robô |
| **Operação** | Atalho para o THE TURISMO Operação, que continua no Claude | Claude |
| **Equipe** | (só administrador) pessoas, PINs e o que cada uma vê | Firestore |

Tudo fica no projeto Firebase **project-sala-vip**, no plano gratuito (Spark):
Hosting (o site), Authentication (o login) e Firestore (os dados).

## Como o login funciona

- A tela de entrada mostra os nomes das pessoas ativas. A pessoa toca no nome e digita o PIN.
- Por trás, cada pessoa tem uma conta no Firebase Authentication com um e-mail interno
  (`…@pin.theturismo.example`, nenhum e-mail é enviado) e uma senha feita a partir do PIN.
- PIN de **4 números** para quem só usa a Oktoplus; **6 números** para quem vê dados de clientes
  (Sala VIP, Valores a receber, Operação) ou administra.
- O Firebase bloqueia por alguns minutos depois de muitas tentativas erradas.
- O administrador gera PIN novo para qualquer pessoa (o PIN antigo para de funcionar na hora)
  e desliga quem saiu da equipe. Cada um troca o próprio PIN em **Trocar meu PIN**.
- Todo PIN gerado vai para o quadro **PINs para entregar**, no canto da tela. Ele continua lá ao trocar
  de aba ou recarregar a página e só some quando você clica em **Anotei** (ou **Anotei todos**).
  Fechar a aba do navegador ou clicar em **Sair** também limpa o quadro (o sistema pergunta antes).
- Ao sair, o site apaga a cópia local dos dados (bom para computador compartilhado).
- O fundo animado (aviões) é desenhado num canvas leve. Os aviões passam com frequência só no primeiro
  minuto de cada aba; depois, um de vez em quando, e param se ninguém mexer no computador por 90 s.
  Em computador fraco ele se alivia sozinho (1 avião, sem etiqueta) e, se ainda pesar, para. Cada pessoa também pode desligar em
  **menu do nome → Aviões no fundo** (vale para aquele navegador).
- As permissões valem no banco (`firestore.rules`), não só na tela.

## Arquivos

| Pasta / arquivo | O que é |
|---|---|
| `src/` | O código (React + TypeScript, Vite) |
| `src/modulos/salavip/salavip.js` | A Sala VIP: o mesmo código do sistema antigo, agora dentro da aba |
| `src/modulos/boletos/linha.ts` | Leitura da linha digitável (FEBRABAN): banco, valor, vencimento e dígitos |
| `src/modulos/boletos/Receber.tsx` e `recebiveis.ts` | Valores a receber: tela, parcelas e gravação |
| `src/lib/documento.ts` | CPF, CNPJ e telefone: conferir os dígitos e formatar |
| `robo/` | O robô de promoções: fontes, leitor de feeds, extrator de preço/milhas/bônus, gravação e radar |
| `src/modulos/promocoes/` | As abas Passagens e Milhas |
| `.github/workflows/promocoes.yml` | Agenda do robô no GitHub (a cada 2 horas) |
| `src/shell/FundoViagem.tsx` | O fundo animado: aviões cruzando a tela com o rastro e a etiqueta do voo |
| `src/equipe/QuadroPins.tsx` | O quadro "PINs para entregar" |
| `dist/` | O site pronto para publicar (gerado por `npm run build`) |
| `firestore.rules` | Quem pode ler e gravar o quê |
| `firebase.json` / `.firebaserc` | Publicação: o portal (`theturismo-sistemas`) e o endereço antigo da Sala VIP (redireciona) |
| `redirecionar/` | Página do endereço antigo da Sala VIP, que leva para o novo |
| `scripts/exportar-oktoplus.mjs` | Exporta os dados do site antigo da Oktoplus |
| `para-o-site-antigo-da-oktoplus/` | Os dois arquivos para levar para a pasta `controle-oktoplus` |
| `tests/` | Testes com os emuladores do Firebase |

## Publicar pela primeira vez (troca de sistema)

Leva uns 15 minutos. Faça num horário tranquilo: a Sala VIP antiga para de funcionar no passo 2
e volta no passo 5, já no endereço novo.

1. **Criar o endereço do portal** (uma vez só), no Terminal, dentro desta pasta:
   ```bash
   cd ~/Downloads/portal-the-turismo
   firebase login
   firebase hosting:sites:create theturismo-sistemas
   ```
   Se disser que o nome já existe, escolha outro (ex.: `theturismo-portal`) e troque
   `theturismo-sistemas` por ele no `.firebaserc`, no `firebase.json`, em `redirecionar/index.html`
   e em `para-o-site-antigo-da-oktoplus/next.config.mjs`.

2. **Publicar** (regras + portal + redirecionamento do endereço antigo da Sala VIP):
   ```bash
   firebase deploy --only firestore:rules,hosting
   ```

3. **Primeiro acesso**: abra `https://theturismo-sistemas.web.app`, digite seu nome e um PIN de
   6 números. Você vira o administrador.

4. **Trazer a Oktoplus**. Avise a equipe para não usar o site antigo da Oktoplus a partir de agora. No Terminal:
   ```bash
   cp ~/Downloads/portal-the-turismo/para-o-site-antigo-da-oktoplus/exportar-oktoplus.mjs ~/Downloads/controle-oktoplus/scripts/
   cd ~/Downloads/controle-oktoplus
   node scripts/exportar-oktoplus.mjs
   ```
   No site novo: **Equipe → Trazer dados do site antigo da Oktoplus** → escolha o arquivo
   `oktoplus-exportacao.json` que apareceu na pasta `controle-oktoplus`. Confira a prévia e clique
   em **Trazer os dados**. A tela confere as contagens e mostra os PINs novos de cada pessoa
   (dá para baixar a lista ou imprimir).

5. **Acessos**: em **Equipe**, abra cada pessoa e escolha o que ela vê. Para o colega da Sala VIP:
   *Sala VIP → Operador*, **Salvar** e **Gerar PIN novo** (6 números). O endereço antigo da Sala VIP
   já leva para o novo.

6. **Desligar o site antigo da Oktoplus** (ele passa a abrir o site novo):
   ```bash
   cp ~/Downloads/portal-the-turismo/para-o-site-antigo-da-oktoplus/next.config.mjs ~/Downloads/controle-oktoplus/next.config.mjs
   cd ~/Downloads/controle-oktoplus
   git add next.config.mjs && git commit -m "Oktoplus mudou para os Sistemas THE TURISMO" && git push
   ```
   A Netlify publica sozinha em 1 ou 2 minutos. O banco do Neon continua lá, intacto, como cópia.

## Logins da Oktoplus

- Ficam em **Oktoplus → Logins**, na coleção `okto_acessos` do Firestore (nunca no código do site).
- Toda a equipe da Oktoplus vê; só quem administra a Oktoplus cadastra, edita, apaga ou cola da planilha
  (garantido nas regras do banco).
- A conta que a pessoa pega já mostra o login dela em **Com você**. A ligação é pelo final do CPF + primeiro nome.
- Para trazer a planilha: **Logins → Colar da planilha**, copie as linhas (colunas ACESSO, CPF, SENHA, EMAIL) e cole.
  A prévia mostra para qual conta vai cada linha; colar de novo só atualiza, não duplica.
- Quem cola, edita ou apaga fica no Histórico, sem a senha.

## Valores a receber

- A aba se chama **Valores a receber** e tem duas partes: **A receber** (abre primeiro) e **Boletos a pagar**
  (os boletos de sempre, sem mudança). Endereços: `#/boletos` e `#/boletos/pagar`. Por dentro a aba continua
  com o nome `boletos`, então os acessos de cada pessoa não mudaram.
- **A receber** (coleção `receber`): nome do devedor, CPF ou CNPJ (confere os dígitos; se não conferir, pede
  para clicar de novo), data de nascimento (só para CPF), telefone/WhatsApp, referência da venda, observações
  e o valor, que pode ser dividido em até 60 parcelas mensais (os centavos que sobram vão nas primeiras).
- Cada cartão mostra o "tempo" da próxima parcela (tempestade = atrasada, chuva = hoje, nublado = 7 dias),
  o progresso das parcelas e um botão do WhatsApp com a mensagem de cobrança pronta.
- **Marcar como recebido**: escolhe uma ou várias parcelas. Se recebeu menos que a parcela, a diferença pode
  ficar em aberto com o mesmo vencimento. **Recebidos** mostra o que entrou em cada mês; dá para desfazer.
- O botão de baixar gera uma planilha (CSV) das parcelas em aberto.
- O selo da aba soma o que vence hoje ou atrasou nas duas partes.
- Quem vê e quem edita é o mesmo nível de antes (**Só ver** / **Cadastrar e editar**), garantido nas regras do banco.

## Robô de promoções (abas Passagens e Milhas)

O robô fica na pasta `robo/`. Ele lê cerca de 30 fontes (blogs de promoção, blogs de milhas, notícias do setor e
buscas do Google Notícias), tira de cada título o preço, as milhas, o bônus, o milheiro, a companhia, o programa,
os destinos, se fala de Teresina e o prazo ("só hoje", "até 05/11"), junta a mesma promoção vinda de vários sites
e grava no banco. Ninguém da equipe precisa fazer nada: as abas só mostram o que ele gravou.
Toda a equipe ativa vê as duas abas (são promoções públicas). Só o robô grava.

**1. Testar no seu Mac** (não grava nada, só mostra o que achou em cada fonte):
```bash
cd ~/Downloads/portal-the-turismo
node robo/promocoes.mjs --testar
```

**2. Criar a chave do robô** (uma vez só):
1. Abra https://console.cloud.google.com/iam-admin/serviceaccounts?project=project-sala-vip
2. **Criar conta de serviço** → nome `robo-promocoes` → **Criar e continuar**.
3. Em **Papel**, escolha **Usuário do Cloud Datastore** → **Continuar** → **Concluir**.
4. Clique na conta criada → aba **Chaves** → **Adicionar chave** → **Criar nova chave** → **JSON**. Baixa um arquivo `.json`.
   Guarde fora da pasta do portal (ele é a senha do robô; nunca mande para ninguém).

**3. Rodar uma vez gravando de verdade** (as abas já se enchem):
```bash
cd ~/Downloads/portal-the-turismo
FIREBASE_SERVICE_ACCOUNT="$HOME/Downloads/NOME-DO-ARQUIVO.json" node robo/promocoes.mjs
```

**4. Deixar rodando sozinho a cada 2 horas, de graça, no GitHub:**
1. Crie um repositório **privado** em https://github.com/new (ex.: `portal-the-turismo`).
2. No Terminal:
   ```bash
   cd ~/Downloads/portal-the-turismo
   git init && git add . && git commit -m "Portal THE TURISMO"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/portal-the-turismo.git
   git push -u origin main
   ```
3. Copie o conteúdo da chave: `pbcopy < "$HOME/Downloads/NOME-DO-ARQUIVO.json"`
4. No repositório: **Settings → Secrets and variables → Actions → New repository secret**.
   Nome `FIREBASE_SERVICE_ACCOUNT`, valor: cole (Cmd+V) → **Add secret**.
5. Aba **Actions** → **Promoções de passagens e milhas** → **Run workflow**. Ficou verde: pronto, daí em diante roda sozinho.
6. Pode apagar o arquivo `.json` do Mac (a chave fica guardada no GitHub).

Repositório privado tem 2.000 minutos grátis por mês no GitHub; o robô usa uns 360.

**Radar de preços saindo de Teresina (opcional, grátis):** crie os segredos abaixo do mesmo jeito do passo 4.
- `SERPAPI_KEY`: conta grátis em https://serpapi.com (250 buscas por mês). O robô consulta o Google Voos uma vez por dia
  para 7 rotas (`robo/radar.mjs`: São Paulo, Rio, Brasília, Salvador, Lisboa, Orlando e Buenos Aires; dá para trocar).
- `TRAVELPAYOUTS_TOKEN`: cadastro grátis em https://www.travelpayouts.com → Perfil → Token da API.

**Fontes:** ficam em `robo/fontes.mjs`. Para tirar uma, apague a linha; para pôr outra, copie uma linha parecida.
O quadro **Fontes**, no fim de cada aba, mostra quais responderam na última leitura. Se o endereço do feed de um site
mudar, o robô procura o feed novo na página inicial sozinho. Algum site pode bloquear o robô (aparece "HTTP 403");
as outras fontes continuam funcionando.

## Atualizar depois

Se a pasta `dist/` já veio pronta (como nas atualizações feitas pelo Claude), é só publicar:
```bash
cd ~/Downloads/portal-the-turismo
firebase deploy --only hosting:portal
```
Se você mudou o código em `src/`, gere o `dist/` antes:
```bash
npm install        # só da primeira vez
npm run build
firebase deploy --only hosting:portal
```
Se mudar as regras: `firebase deploy --only firestore:rules` (ou tudo junto: `firebase deploy --only firestore:rules,hosting:portal`).

## Testar localmente (opcional)

```bash
npm run build && npx vite preview --port 4173 &
firebase emulators:start --only auth,firestore --project demo-portal
# abra http://127.0.0.1:4173/?emulador
node tests/e2e-1-equipe.mjs && node tests/e2e-2-oktoplus.mjs && node tests/e2e-5-logins.mjs && node tests/e2e-3-salavip.mjs && node tests/gerar-fixtures.mjs && node tests/e2e-4-boletos.mjs && node tests/e2e-6-receber.mjs && node tests/e2e-7-promocoes.mjs && node tests/regras.mjs
```

## Limites do plano gratuito

- Firestore: 1 GB guardado, 50 mil leituras e 20 mil gravações por dia. Para a agência, sobra.
- Anexos dos boletos (PDF e comprovante) ficam dentro do Firestore, porque desde fevereiro de 2026 o
  Firebase só guarda arquivos (Storage) no plano pago. Cada anexo pode ter até 8 MB; fotos grandes são
  reduzidas antes de salvar. Mil boletos com PDF e comprovante ocupam algo como 400 MB.
