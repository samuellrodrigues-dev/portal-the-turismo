import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { hojeIso } from "../../lib/tempo";

/** Quantas salas VIP precisam ser emitidas hoje (ou já atrasaram), para o selo da aba. */
export function useAlertasVip(ligado: boolean) {
  const [r, setR] = useState({ n: 0, titulo: "" });
  useEffect(() => {
    if (!ligado) { setR({ n: 0, titulo: "" }); return; }
    return onSnapshot(query(collection(db, "usos"), where("status", "==", "Pendente")), (s) => {
      const hoje = hojeIso();
      const n = s.docs.filter((d) => { const e = d.data().emitirEm; return typeof e === "string" && e <= hoje; }).length;
      setR({ n, titulo: n === 1 ? "1 sala VIP para emitir hoje" : `${n} salas VIP para emitir hoje` });
    }, () => setR({ n: 0, titulo: "" }));
  }, [ligado]);
  return r;
}
