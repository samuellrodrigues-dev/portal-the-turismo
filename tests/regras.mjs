// Testa as regras do Firestore direto pelo SDK: o que cada pessoa NÃO pode fazer.
// Roda depois dos testes e2e (usa a equipe e os dados criados lá).
import fs from "node:fs";
import path from "node:path";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, serverTimestamp,
} from "firebase/firestore";
import { OUT, checar, totalFalhas, gravarAdmin, lerAdmin } from "./util.mjs";

const pins = { ...JSON.parse(fs.readFileSync(path.join(OUT, "pins.json"), "utf8")), ...JSON.parse(fs.readFileSync(path.join(OUT, "pins2.json"), "utf8")) };
const cfg = { apiKey: "demo", authDomain: "localhost", projectId: "demo-portal" };
let n = 0;
async function cliente(nome, pin) {
  const app = initializeApp(cfg, "t" + ++n);
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  if (nome) {
    const pub = (await getDoc(doc(db, "publico", "equipe"))).data().pessoas;
    const p = pub.find((x) => x.nome === nome);
    await signInWithEmailAndPassword(auth, `${p.login}@pin.theturismo.example`, `tt-${pin}-pin`);
  }
  return { app, auth, db };
}
const pode = async (f) => { try { await f(); return true; } catch (e) { if (e.code !== "permission-denied") console.log("    (erro:", e.code || e.message, ")"); return false; } };

console.log("sem login");
let c = await cliente(null);
checar(await pode(() => getDoc(doc(c.db, "publico", "equipe"))), "lê a lista de nomes da entrada");
checar(!(await pode(() => getDocs(collection(c.db, "pessoas")))), "não lê pessoas");
checar(!(await pode(() => getDocs(collection(c.db, "boletos")))), "não lê boletos");
checar(!(await pode(() => getDocs(collection(c.db, "receber")))), "não lê valores a receber");
checar(!(await pode(() => getDoc(doc(c.db, "promocoes", "passagens")))), "não lê promoções");
checar(!(await pode(() => getDocs(query(collection(c.db, "usos"), where("status", "==", "Pendente"))))), "não lê Sala VIP");
checar(!(await pode(() => updateDoc(doc(c.db, "publico", "equipe"), { pessoas: [] }))), "não mexe na lista de nomes");
checar(!(await pode(() => getDocs(collection(c.db, "okto_acessos")))), "não lê os logins da Oktoplus");
await deleteApp(c.app);

console.log("alguém que criou conta por fora (sem cadastro)");
c = await cliente(null);
await createUserWithEmailAndPassword(c.auth, `intruso${Date.now()}@exemplo.com`, "senha-qualquer-123");
checar(!(await pode(() => getDocs(collection(c.db, "okto_contas")))), "não lê Oktoplus");
checar(!(await pode(() => setDoc(doc(c.db, "uids", c.auth.currentUser.uid), { pid: "x", nome: "Intruso", admin: true, ativo: true, abas: {} }))), "não se cadastra como administrador");
checar(!(await pode(() => setDoc(doc(c.db, "publico", "equipe"), { pessoas: [{ id: "x" }] }))), "não recria a equipe");
await deleteApp(c.app);

console.log("Lívia (Oktoplus: usar)");
c = await cliente("Lívia Pia", pins.livia);
const uidL = c.auth.currentUser.uid;
const euL = (await getDoc(doc(c.db, "uids", uidL))).data();
checar(await pode(() => getDocs(collection(c.db, "okto_contas"))), "lê as contas do Oktoplus");
checar(await pode(() => getDoc(doc(c.db, "promocoes", "passagens"))), "lê as promoções");
checar(!(await pode(() => setDoc(doc(c.db, "promocoes", "passagens"), { itens: [] }))), "não grava nas promoções (só o robô)");
checar(!(await pode(() => getDocs(collection(c.db, "boletos")))), "não lê boletos");
checar(!(await pode(() => getDocs(collection(c.db, "receber")))), "não lê valores a receber");
checar(!(await pode(() => getDocs(query(collection(c.db, "usos"), where("status", "==", "Pendente"))))), "não lê Sala VIP");
checar(!(await pode(() => getDocs(collection(c.db, "okto_eventos")))), "não lê o registro (só administrador)");
checar(!(await pode(() => updateDoc(doc(c.db, "uids", uidL), { admin: true }))), "não vira administradora");
checar(!(await pode(() => updateDoc(doc(c.db, "pessoas", euL.pid), { abas: { boletos: "editar" } }))), "não muda os próprios acessos");
checar(await pode(() => updateDoc(doc(c.db, "pessoas", euL.pid), { aparelho: "Cell Lívia 2", atualizadoEm: serverTimestamp() })), "muda o próprio aparelho de costume");
checar(!(await pode(() => getDoc(doc(c.db, "pessoas", "okto-7")))), "não lê a ficha de outra pessoa");
const contas = (await getDocs(collection(c.db, "okto_contas"))).docs.map((d) => ({ id: d.id, ...d.data() }));
const comOutro = contas.find((x) => x.uso && x.uso.pid !== euL.pid);
const livre = contas.find((x) => !x.uso && x.ativa);
if (comOutro) checar(!(await pode(() => updateDoc(doc(c.db, "okto_contas", comOutro.id), { uso: null }))), "não devolve conta que está com outra pessoa");
checar(!(await pode(() => updateDoc(doc(c.db, "okto_contas", livre.id), { uso: { id: "x", pid: "outra", nome: "Outra", aparelho: "", inicio: serverTimestamp() } }))), "não pega conta em nome de outra pessoa");
// Gerenciar contas: toda a equipe da Oktoplus cadastra e corrige contas
const contaLivre = { titular: livre.titular, final: String(livre.final ?? ""), obs: livre.obs || "", ativa: true };
checar(await pode(() => updateDoc(doc(c.db, "okto_contas", livre.id), { ...contaLivre, obs: "corrigida pela Lívia" })), "corrige a observação de uma conta");
checar(await pode(() => updateDoc(doc(c.db, "okto_contas", livre.id), contaLivre)), "volta a observação");
checar(!(await pode(() => updateDoc(doc(c.db, "okto_contas", livre.id), { ...contaLivre, titular: "" }))), "não deixa conta sem nome");
checar(!(await pode(() => updateDoc(doc(c.db, "okto_contas", livre.id), { ...contaLivre, extra: 1 }))), "não grava campo fora do combinado na conta");
if (comOutro) checar(!(await pode(() => updateDoc(doc(c.db, "okto_contas", comOutro.id), { titular: comOutro.titular, final: String(comOutro.final ?? ""), obs: comOutro.obs || "", ativa: false }))), "não desativa conta que está com outra pessoa");
if (comOutro) checar(!(await pode(() => updateDoc(doc(c.db, "okto_contas", comOutro.id), { esgotadaMes: "2026-11", esgotadaPor: { pid: euL.pid, nome: euL.nome }, esgotadaEm: serverTimestamp() }))), "não marca esgotada a conta que está com outra pessoa");
const contaNova = (x = {}) => ({ titular: "Conta teste regras", final: "12", obs: "", ativa: true, uso: null, esgotadaMes: null, esgotadaPor: null, esgotadaEm: null, criadoEm: serverTimestamp(), ...x });
const nova = await addDoc(collection(c.db, "okto_contas"), contaNova()).catch((e) => { console.log("    (erro:", e.code, ")"); return null; });
checar(!!nova, "cadastra conta nova");
checar(!(await pode(() => addDoc(collection(c.db, "okto_contas"), contaNova({ uso: { id: "x", pid: "outra", nome: "Outra", aparelho: "", inicio: serverTimestamp() } })))), "não cadastra conta já em uso por outra pessoa");
checar(!(await pode(() => addDoc(collection(c.db, "okto_contas"), contaNova({ final: "12345" })))), "não cadastra final de CPF com mais de 4 números");
checar(!(await pode(() => addDoc(collection(c.db, "okto_contas"), contaNova({ ativa: false })))), "não cadastra conta já desativada");
checar(!(await pode(() => addDoc(collection(c.db, "okto_contas"), contaNova({ extra: 1 })))), "não cadastra conta com campo fora do combinado");
if (nova) {
  checar(await pode(() => updateDoc(nova, { esgotadaMes: "2026-11", esgotadaPor: { pid: euL.pid, nome: euL.nome }, esgotadaEm: serverTimestamp() })), "marca conta livre como esgotada");
  checar(!(await pode(() => updateDoc(nova, { esgotadaMes: "2026-12", esgotadaPor: { pid: "outra", nome: "Outra" }, esgotadaEm: serverTimestamp() }))), "não marca esgotada em nome de outra pessoa");
  checar(await pode(() => updateDoc(nova, { esgotadaMes: null, esgotadaPor: null, esgotadaEm: null })), "desmarca esgotada");
  checar(await pode(() => updateDoc(nova, { titular: "Conta teste regras", final: "12", obs: "", ativa: false })), "desativa conta livre");
  checar(!(await pode(() => deleteDoc(nova))), "não apaga a conta que cadastrou");
}
checar(!(await pode(() => addDoc(collection(c.db, "okto_eventos"), { em: serverTimestamp(), mes: "2026-10", tipo: "pegou", quem: { pid: "outra", nome: "Outra" } }))), "não registra evento em nome de outra pessoa");
checar(!(await pode(() => deleteDoc(doc(c.db, "okto_contas", livre.id)))), "não apaga conta");
const logins = await getDocs(collection(c.db, "okto_acessos"));
checar(logins.size > 0, "lê os logins da Oktoplus (" + logins.size + ")");
const umLogin = logins.docs[0];
// logins: toda a equipe da Oktoplus cadastra e corrige, sempre assinando com o próprio nome; apagar é só com o administrador
const loginAntes = umLogin.data();
checar(await pode(() => updateDoc(doc(c.db, "okto_acessos", umLogin.id), { senha: "trocada", atualizadoEm: serverTimestamp(), atualizadoPor: euL.nome })), "corrige a senha de um login");
checar(await pode(() => updateDoc(doc(c.db, "okto_acessos", umLogin.id), { senha: loginAntes.senha, atualizadoEm: serverTimestamp(), atualizadoPor: euL.nome })), "volta a senha");
checar(!(await pode(() => updateDoc(doc(c.db, "okto_acessos", umLogin.id), { senha: "x", atualizadoEm: serverTimestamp(), atualizadoPor: "Outra pessoa" }))), "não corrige login assinando como outra pessoa");
const loginNovo = await addDoc(collection(c.db, "okto_acessos"), { nome: "Login teste regras", cpf: "36060710433", senha: "s", email: "", obs: "", ordem: 1, atualizadoEm: serverTimestamp(), atualizadoPor: euL.nome }).catch((e) => { console.log("    (erro:", e.code, ")"); return null; });
checar(!!loginNovo, "cadastra login");
checar(!(await pode(() => addDoc(collection(c.db, "okto_acessos"), { nome: "X", cpf: "", senha: "", email: "", obs: "", ordem: 1, extra: 1, atualizadoEm: serverTimestamp(), atualizadoPor: euL.nome }))), "não cadastra login com campo fora do combinado");
if (loginNovo) checar(!(await pode(() => deleteDoc(loginNovo))), "não apaga o login que cadastrou");
checar(!(await pode(() => deleteDoc(doc(c.db, "okto_acessos", umLogin.id)))), "não apaga login");
await deleteApp(c.app);

console.log("Alan (Sala VIP: operador)");
c = await cliente("Alan Ferreira", pins.alan);
const euA = (await getDoc(doc(c.db, "uids", c.auth.currentUser.uid))).data();
checar(await pode(() => updateDoc(doc(c.db, "usos", "u2"), { status: "Emitido", atualizadoEm: serverTimestamp(), atualizadoPor: euA.nome })), "muda o status");
checar(!(await pode(() => updateDoc(doc(c.db, "usos", "u2"), { status: "Enviado", atualizadoEm: serverTimestamp(), atualizadoPor: "Samuel Rodrigues" }))), "não assina mudança como outra pessoa");
checar(!(await pode(() => updateDoc(doc(c.db, "usos", "u2"), { cliente: "Outro nome", atualizadoEm: serverTimestamp(), atualizadoPor: euA.nome }))), "não edita o cliente");
checar(!(await pode(() => deleteDoc(doc(c.db, "usos", "u2")))), "não exclui");
checar(!(await pode(() => getDocs(collection(c.db, "boletos")))), "não lê boletos");
checar(!(await pode(() => getDocs(collection(c.db, "receber")))), "não lê valores a receber");
await deleteApp(c.app);

console.log("Denise com Boletos: só ver");
const denise = (await lerAdmin("publico/equipe")).fields.pessoas.arrayValue.values.map((v) => v.mapValue.fields).find((f) => f.nome.stringValue === "Denise");
const pessoaD = await lerAdmin("pessoas/" + denise.id.stringValue);
const uidD = pessoaD.fields.uid.stringValue;
await gravarAdmin("uids/" + uidD, { pid: denise.id.stringValue, nome: "Denise", admin: false, ativo: true, abas: { oktoplus: "usar", salavip: "", boletos: "ver", operacao: "" } });
c = await cliente("Denise", pins.Denise);
const bols = await getDocs(collection(c.db, "boletos"));
checar(bols.size > 0, "lê os boletos (" + bols.size + ")");
checar(!(await pode(() => updateDoc(doc(c.db, "boletos", bols.docs[0].id), { valor: 1 }))), "não edita boleto");
checar(!(await pode(() => addDoc(collection(c.db, "boletos"), { descricao: "x", beneficiario: "", valor: 1, vencimento: "2026-11-01", status: "aberto", linha: "", obs: "", anexos: [] }))), "não cadastra boleto");
const recs = await getDocs(collection(c.db, "receber"));
checar(recs.size > 0, "lê os valores a receber (" + recs.size + ")");
checar(!(await pode(() => updateDoc(doc(c.db, "receber", recs.docs[0].id), { obs: "mexi" }))), "não edita valor a receber");
checar(!(await pode(() => deleteDoc(doc(c.db, "receber", recs.docs[0].id)))), "não apaga valor a receber");
const arq = (await getDocs(collection(c.db, "arquivos"))).docs[0];
checar(!!arq && (await pode(() => getDocs(collection(c.db, "arquivos", arq.id, "partes")))), "abre os anexos");
checar(!(await pode(() => deleteDoc(doc(c.db, "arquivos", arq.id)))), "não apaga anexo");
await deleteApp(c.app);

console.log("Denise sem a aba Oktoplus");
await gravarAdmin("uids/" + uidD, { pid: denise.id.stringValue, nome: "Denise", admin: false, ativo: true, abas: { oktoplus: "", salavip: "", boletos: "ver", operacao: "" } });
c = await cliente("Denise", pins.Denise);
checar(!(await pode(() => getDocs(collection(c.db, "okto_acessos")))), "sem a aba Oktoplus não lê os logins");
await deleteApp(c.app);

console.log("acesso desligado");
await gravarAdmin("uids/" + uidD, { pid: denise.id.stringValue, nome: "Denise", admin: false, ativo: false, abas: { oktoplus: "usar", salavip: "", boletos: "ver", operacao: "" } });
c = await cliente("Denise", pins.Denise);
checar(!(await pode(() => getDocs(collection(c.db, "okto_contas")))), "desativada não lê nada");
await deleteApp(c.app);
await gravarAdmin("uids/" + uidD, { pid: denise.id.stringValue, nome: "Denise", admin: false, ativo: true, abas: { oktoplus: "usar", salavip: "", boletos: "", operacao: "" } });
c = await cliente("Denise", pins.Denise);
checar(!(await pode(() => getDocs(collection(c.db, "receber")))), "sem a aba Valores a receber não lê CPF nem valores");
await deleteApp(c.app);

console.log("João Pedro (Oktoplus admin, sem ser administrador do sistema)");
c = await cliente("João Pedro", pins.joao);
checar(await pode(() => getDocs(collection(c.db, "okto_eventos"))), "lê o registro do Oktoplus");
const euJ = (await getDoc(doc(c.db, "uids", c.auth.currentUser.uid))).data();
const novoLogin = await addDoc(collection(c.db, "okto_acessos"), { nome: "Teste regras", cpf: "", senha: "x", email: "", obs: "", ordem: 99, atualizadoEm: serverTimestamp(), atualizadoPor: euJ.nome }).catch(() => null);
checar(!!novoLogin, "administrador da Oktoplus cadastra login");
checar(!(await pode(() => addDoc(collection(c.db, "okto_acessos"), { nome: "Assinado errado", cpf: "", senha: "x", email: "", obs: "", ordem: 1, atualizadoEm: serverTimestamp(), atualizadoPor: "Outra pessoa" }))), "não assina login como outra pessoa");
checar(!(await pode(() => addDoc(collection(c.db, "okto_acessos"), { nome: "Campo a mais", cpf: "", senha: "x", email: "", obs: "", ordem: 1, extra: true, atualizadoEm: serverTimestamp(), atualizadoPor: euJ.nome }))), "não grava campo fora do combinado");
if (novoLogin) checar(await pode(() => deleteDoc(novoLogin)), "administrador da Oktoplus apaga login");
const souJ = { pid: euJ.pid, nome: euJ.nome };
const rec = (x = {}) => ({ devedor: "Teste regras", documento: "", nascimento: "", telefone: "", referencia: "", obs: "", parcelas: [{ venc: "2026-12-01", valor: 10, recebidoEm: null, valorRecebido: null }], situacao: "aberto", proxVenc: "2026-12-01", mesesRecebidos: [], criadoPor: souJ, criadoEm: serverTimestamp(), atualizadoPor: souJ, atualizadoEm: serverTimestamp(), ...x });
const novoRec = await addDoc(collection(c.db, "receber"), rec()).catch((e) => { console.log("    (erro:", e.code, ")"); return null; });
checar(!!novoRec, "quem edita a aba cadastra valor a receber");
checar(!(await pode(() => addDoc(collection(c.db, "receber"), rec({ documento: "1234567890" })))), "CPF com 10 números é recusado");
checar(!(await pode(() => addDoc(collection(c.db, "receber"), rec({ parcelas: [] })))), "sem parcela é recusado");
checar(!(await pode(() => addDoc(collection(c.db, "receber"), rec({ extra: 1 })))), "campo fora do combinado é recusado");
checar(!(await pode(() => addDoc(collection(c.db, "receber"), rec({ atualizadoPor: { pid: "outro", nome: "Outra pessoa" } })))), "não assina como outra pessoa");
if (novoRec) {
  checar(!(await pode(() => updateDoc(novoRec, { criadoPor: { pid: "outro", nome: "Outra pessoa" }, atualizadoPor: souJ, atualizadoEm: serverTimestamp() }))), "não troca quem cadastrou");
  checar(await pode(() => updateDoc(novoRec, { obs: "ok", atualizadoPor: souJ, atualizadoEm: serverTimestamp() })), "edita valor a receber");
  checar(await pode(() => deleteDoc(novoRec)), "apaga valor a receber");
}
checar(!(await pode(() => getDocs(collection(c.db, "pessoas")))), "não lê a equipe");
checar(!(await pode(() => updateDoc(doc(c.db, "publico", "equipe"), { pessoas: [] }))), "não mexe na lista de nomes");
await deleteApp(c.app);

console.log(totalFalhas() ? `${totalFalhas()} FALHA(S)` : "TUDO CERTO");
process.exit(totalFalhas() ? 1 : 0);
