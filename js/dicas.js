/**
 * Textos das dicas do simulador (faixa atual, quanto falta, projeção, mudança de faixa).
 *
 * Módulo puro: não usa DOM nem Firebase (testável com `node --test`). NÃO calcula nada:
 * só formata os números que já vieram de analisarFaixa() e projetarFimDoMes() (comissoes.js).
 *
 * Uma mensagem é uma lista de "partes": texto simples (string) ou { negrito: "..." }.
 * A interface monta cada parte com textContent (nada de innerHTML).
 */
import { formatarBRL } from "./comissoes.js";

const fmtNumero = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const valor = (v, moeda) => (moeda === false ? fmtNumero(v) : formatarBRL(v));
const fmtFator = (f) => Number(f).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Converte as partes em texto simples (para WhatsApp e testes). */
export function partesParaTexto(partes) {
  return partes.map((p) => (typeof p === "string" ? p : p.negrito)).join("");
}

function descricaoDaFaixa(faixa) {
  if (!faixa || !faixa.descricao) return null;
  return faixa.fator !== undefined ? `${faixa.descricao}, fator ${fmtFator(faixa.fator)}` : faixa.descricao;
}

/** "Você está na Faixa 2 (fator 0,40)." — null quando a categoria não tem faixas. */
export function mensagemFaixaAtual(analise) {
  if (!analise || !analise.ok || !analise.temFaixas) return null;
  const d = descricaoDaFaixa(analise.atual);
  if (!d) return null;
  return ["Você está na ", { negrito: d }, "."];
}

/**
 * Quanto falta para a próxima faixa e quanto passa a receber.
 * Retorna null quando não há próxima faixa (inclusive no topo da tabela).
 */
export function mensagemProximaFaixa(analise) {
  if (!analise || !analise.ok) return null;
  if (analise.maxima) return ["Você já está na faixa mais alta da tabela. Parabéns! 🎉"];
  const p = analise.proxima;
  if (!p) return null;
  const alvo = descricaoDaFaixa(p);
  return [
    "Faltam ",
    { negrito: valor(p.falta, p.moeda) },
    " para mudar de faixa (",
    alvo,
    ") e chegar a ",
    { negrito: formatarBRL(p.rvNaProxima) },
    ".",
  ];
}

/** Texto curto para o botão do WhatsApp (sem formatação). */
export function mensagemWhatsApp(analise) {
  const faixa = mensagemFaixaAtual(analise);
  const prox = analise && analise.proxima ? mensagemProximaFaixa(analise) : null;
  if (!prox) return null;
  const linhas = [];
  if (faixa) linhas.push(partesParaTexto(faixa));
  linhas.push(partesParaTexto(prox));
  linhas.push("Vamos pra cima! 🚀");
  return linhas.join(" ");
}

/**
 * Aviso de mudança de faixa entre dois cálculos da MESMA categoria.
 * anterior/atual: { descricao, rvTotal }. Devolve null se nada mudou.
 */
export function mensagemMudancaDeFaixa(anterior, atual) {
  if (!anterior || !atual || !anterior.descricao || !atual.descricao) return null;
  if (anterior.descricao === atual.descricao) return null;
  if (atual.rvTotal > anterior.rvTotal) {
    return ["Você subiu de faixa! Agora está na faixa ", { negrito: atual.descricao }, ". 🎉"];
  }
  if (atual.rvTotal < anterior.rvTotal) {
    return ["Atenção: com esses valores você voltou para a faixa ", { negrito: atual.descricao }, "."];
  }
  return ["A faixa mudou para ", { negrito: atual.descricao }, "."];
}

/** Resultado da projeção até o fim do mês (estimativa por média diária). */
export function mensagensProjecao(proj, moeda = true) {
  if (!proj || !proj.ok) return [];
  const msgs = [];
  msgs.push([
    "Média de ",
    { negrito: valor(proj.mediaDiaria, moeda) },
    ` por dia trabalhado (${proj.diasTrabalhados} dia(s)). Em mais ${proj.diasRestantes} dia(s) no mesmo ritmo, você chega a `,
    { negrito: valor(proj.projetado, moeda) },
    ".",
  ]);
  msgs.push(["Comissão estimada no fim do mês: ", { negrito: formatarBRL(proj.rvProjetada) }, "."]);
  if (proj.faixaProjetada) {
    if (proj.mudaDeFaixa) {
      msgs.push([
        proj.sobe ? "Mantendo o ritmo, você sobe da faixa " : "Mantendo o ritmo, você muda da faixa ",
        proj.faixaAtual || "inicial",
        " para a faixa ",
        { negrito: proj.faixaProjetada },
        ".",
      ]);
    } else {
      msgs.push(["Mantendo o ritmo, você continua na faixa ", { negrito: proj.faixaProjetada }, "."]);
    }
  }
  return msgs;
}

export const AVISO_PROJECAO =
  "Projeção por média diária: é uma estimativa e não garante o resultado. Não é uma regra do documento de RV.";
