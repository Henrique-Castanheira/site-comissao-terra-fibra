/**
 * Último cálculo de RV por usuário — montagem e leitura do objeto `lastCalculation`.
 *
 * Este módulo NÃO acessa Firebase nem o DOM (para ser testado com `node --test`).
 * A gravação/leitura no Firestore fica em ultimo-calculo-db.js.
 *
 * Estrutura gravada em users/{uid}.lastCalculation (campos realmente existentes em comissoes.js):
 *   category            id da categoria (ex.: "consultor_pap")
 *   categoryLabel       nome exibido da categoria
 *   inputs              dados digitados na simulação (número | texto | booleano | null)
 *   baseCommission      comissão-base (RV "Vendeu & Ganhou", valor da faixa ou percentual sobre a receita)
 *   qualityAccelerator  acelerador de qualidade (só existe quando foi aplicado)
 *   components          todos os componentes do resultado: [{ id, label, amount }]
 *                       (base, acelerador, adicional "a cada 5%", complemento da garantia de R$ 300...)
 *   finalAmount         valor final estimado
 *   pctAttainment       % de atingimento (só categorias com meta)
 *   partial             true quando a regra do PDF não foi implementada por completo (Vendedor Loja)
 *   memory              memória de cálculo (linhas de texto)
 *   warnings            avisos exibidos na simulação
 *   rulesVersion        versão das regras usada ("Outubro/2026")
 *   calculatedAt        Timestamp do servidor (adicionado na gravação, não aqui)
 *
 * Valores monetários: número em reais com 2 casas (ex.: 684.8), o mesmo formato de comissoes.js.
 * Não existem campos de "bônus" ou "descontos" separados: o PDF só prevê o adicional dos líderes e o
 * complemento da garantia, ambos dentro de `components`.
 */
import { CATEGORIAS, VERSAO_REGRAS, lerNumero } from "./comissoes.js";

export const CAMPO_ULTIMO_CALCULO = "lastCalculation";

const dinheiro = (valor) => Math.round(valor * 100) / 100;

/** Converte as entradas digitadas em valores tipados (vazio vira null; nunca vira 0). */
export function normalizarEntradas(cat, entradasBrutas) {
  const saida = {};
  for (const campo of cat.campos) {
    const bruto = entradasBrutas ? entradasBrutas[campo.id] : undefined;
    if (campo.tipo === "checkbox") {
      saida[campo.id] = bruto === true;
    } else if (campo.tipo === "selecao") {
      saida[campo.id] = typeof bruto === "string" && bruto !== "" ? bruto : campo.padrao || null;
    } else {
      const n = bruto === undefined || bruto === null || String(bruto).trim() === "" ? null : lerNumero(bruto);
      saida[campo.id] = n && !n.erro ? n.valor : null;
    }
  }
  return saida;
}

/**
 * Monta o objeto a salvar. Devolve null se o cálculo não for válido
 * (resultados inválidos ou com campos obrigatórios ausentes nunca são salvos).
 */
export function montarUltimoCalculo(cat, entradasBrutas, resultado) {
  if (!cat || !resultado || resultado.ok !== true) return null;

  const calculo = {
    category: cat.id,
    categoryLabel: cat.rotulo,
    inputs: normalizarEntradas(cat, entradasBrutas),
    baseCommission: dinheiro(resultado.rvBase),
    components: resultado.componentes.map((c) => ({ id: c.id, label: c.rotulo, amount: dinheiro(c.valor) })),
    finalAmount: dinheiro(resultado.rvTotal),
    partial: resultado.parcial === true,
    memory: resultado.memoria.slice(0, 20),
    warnings: resultado.avisos.slice(0, 10),
    rulesVersion: VERSAO_REGRAS,
  };
  if (resultado.rvAcelerador > 0) calculo.qualityAccelerator = dinheiro(resultado.rvAcelerador);
  if (typeof resultado.pctAtingimento === "number" && Number.isFinite(resultado.pctAtingimento)) {
    calculo.pctAttainment = dinheiro(resultado.pctAtingimento);
  }
  return calculo;
}

/** Identifica "o mesmo cálculo" (categoria + dados + versão das regras) para evitar gravações repetidas. */
export function chaveDoCalculo(calculo) {
  return JSON.stringify([calculo.category, calculo.inputs, calculo.rulesVersion]);
}

/** O que veio do Firestore tem o formato esperado? (proteção contra dados antigos/corrompidos) */
export function calculoSalvoValido(salvo) {
  return Boolean(
    salvo &&
      typeof salvo === "object" &&
      typeof salvo.category === "string" &&
      CATEGORIAS.some((c) => c.id === salvo.category) &&
      typeof salvo.finalAmount === "number" &&
      Number.isFinite(salvo.finalAmount) &&
      Array.isArray(salvo.components) &&
      salvo.inputs &&
      typeof salvo.inputs === "object"
  );
}

/**
 * Converte o cálculo salvo no mesmo formato do resultado de `calcular()`, para exibição.
 * NÃO recalcula nada: mostra exatamente o que foi salvo.
 */
export function resultadoDoCalculoSalvo(salvo) {
  const cat = CATEGORIAS.find((c) => c.id === salvo.category);
  return {
    ok: true,
    categoria: salvo.category,
    rotulo: salvo.categoryLabel || (cat ? cat.rotulo : salvo.category),
    paginaPdf: cat ? cat.paginaPdf : null,
    parcial: salvo.partial === true,
    erros: [],
    avisos: Array.isArray(salvo.warnings) ? salvo.warnings : [],
    memoria: Array.isArray(salvo.memory) ? salvo.memory : [],
    rvBase: salvo.baseCommission,
    rvAcelerador: salvo.qualityAccelerator || 0,
    rvTotal: salvo.finalAmount,
    componentes: salvo.components.map((c) => ({ id: c.id, rotulo: c.label, valor: c.amount })),
  };
}

/** Valores para preencher o formulário: { campoId: string | boolean } (somente campos da categoria). */
export function entradasParaFormulario(cat, salvo) {
  const valores = {};
  for (const campo of cat.campos) {
    const v = salvo.inputs ? salvo.inputs[campo.id] : undefined;
    if (campo.tipo === "checkbox") valores[campo.id] = v === true;
    else if (campo.tipo === "selecao") {
      const validos = (campo.opcoes || []).map((o) => o.valor);
      valores[campo.id] = validos.includes(v) ? v : campo.padrao || "";
    } else valores[campo.id] = v === null || v === undefined ? "" : String(v);
  }
  return valores;
}

/** "21/10/2026 às 14:05". Aceita Date ou Timestamp do Firestore (com toDate()). */
export function formatarDataHora(valor, timeZone) {
  const data = valor && typeof valor.toDate === "function" ? valor.toDate() : valor;
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return "";
  const opcoes = timeZone ? { timeZone } : {};
  const dia = data.toLocaleDateString("pt-BR", opcoes);
  const hora = data.toLocaleTimeString("pt-BR", { ...opcoes, hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}
