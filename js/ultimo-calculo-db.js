/**
 * Gravação do último cálculo no Firestore (users/{uid}.lastCalculation).
 *
 * - Usa updateDoc com SOMENTE o campo `lastCalculation`: o campo inteiro é substituído (um único
 *   cálculo por usuário, sem histórico) e nome, telefone e demais campos do perfil não são tocados.
 *   (setDoc com merge faria uma mescla campo a campo dentro do mapa e deixaria dados antigos misturados.)
 * - O Firestore Web não rejeita escritas feitas sem conexão: a promessa fica pendente. Por isso há um
 *   tempo limite; passado o limite, o salvamento é tratado como FALHA e a interface não mostra sucesso.
 */
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { CAMPO_ULTIMO_CALCULO } from "./ultimo-calculo.js";

export const TEMPO_LIMITE_MS = 15000;

function erroApp(codigo, mensagem) {
  const e = new Error(mensagem);
  e.code = codigo;
  return e;
}

function comLimite(promessa, ms) {
  let timer;
  const limite = new Promise((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(erroApp("app/timeout", "Sem confirmação do servidor")), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

/**
 * Salva o cálculo do usuário `uid`. Resolve com a data/hora gravada pelo servidor;
 * rejeita (com `code`) se não foi possível confirmar o salvamento.
 */
export async function salvarUltimoCalculo(uid, calculo) {
  if (!uid) throw erroApp("app/sem-usuario", "Usuário não autenticado");
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw erroApp("app/offline", "Sem conexão");
  }

  const ref = doc(db, "users", uid);
  const escrita = updateDoc(ref, { [CAMPO_ULTIMO_CALCULO]: { ...calculo, calculatedAt: serverTimestamp() } });
  escrita.catch(() => {}); // evita erro não tratado se a escrita falhar depois do limite
  await comLimite(escrita, TEMPO_LIMITE_MS);

  // Lê de volta para exibir a hora gravada pelo servidor. Se a leitura falhar, a escrita já foi confirmada.
  try {
    const snap = await getDoc(ref);
    const salvo = snap.exists() ? snap.data()[CAMPO_ULTIMO_CALCULO] : null;
    if (salvo && salvo.calculatedAt && typeof salvo.calculatedAt.toDate === "function") {
      return salvo.calculatedAt.toDate();
    }
  } catch (_) {
    /* ignora: usa a hora local apenas para exibição */
  }
  return new Date();
}
