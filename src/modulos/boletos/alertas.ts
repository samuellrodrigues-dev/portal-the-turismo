import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { hojeIso } from "../../lib/tempo";

type Conta = { atr: number; hj: number };
const zero: Conta = { atr: 0, hj: 0 };

/**
 * Selo da aba "Valores a receber": o que vence hoje ou já atrasou,
 * somando os valores a receber e os boletos a pagar.
 */
export function useAlertasBoletos(ligado: boolean) {
  const [bol, setBol] = useState<Conta>(zero);
  const [rec, setRec] = useState<Conta>(zero);
  useEffect(() => {
    if (!ligado) { setBol(zero); setRec(zero); return; }
    const a = onSnapshot(query(collection(db, "boletos"), where("status", "==", "aberto")), (s) => {
      const hoje = hojeIso();
      let atr = 0, hj = 0;
      s.docs.forEach((d) => { const v = d.data().vencimento; if (typeof v !== "string") return; if (v < hoje) atr++; else if (v === hoje) hj++; });
      setBol({ atr, hj });
    }, () => setBol(zero));
    const b = onSnapshot(query(collection(db, "receber"), where("situacao", "==", "aberto")), (s) => {
      const hoje = hojeIso();
      let atr = 0, hj = 0;
      s.docs.forEach((d) => { const v = d.data().proxVenc; if (typeof v !== "string") return; if (v < hoje) atr++; else if (v === hoje) hj++; });
      setRec({ atr, hj });
    }, () => setRec(zero));
    return () => { a(); b(); };
  }, [ligado]);
  const parte = (c: Conta, quem: string) => {
    const p = [c.hj ? `${c.hj} ${c.hj === 1 ? "vence" : "vencem"} hoje` : "", c.atr ? `${c.atr} ${c.atr === 1 ? "atrasado" : "atrasados"}` : ""].filter(Boolean).join(" e ");
    return p ? `${quem}: ${p}` : "";
  };
  return {
    n: bol.atr + bol.hj + rec.atr + rec.hj,
    titulo: [parte(rec, "A receber"), parte(bol, "Boletos a pagar")].filter(Boolean).join(" · "),
  };
}
