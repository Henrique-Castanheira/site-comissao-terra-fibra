/**
 * Módulo de cálculo da Remuneração Variável (RV) — Terra Fibra
 * Vigência: Outubro/2026
 *
 * FONTE ÚNICA DAS REGRAS: documento "RV Geral Terra Oficial (Outubro26) –
 * Comercial" (PDF de 23 páginas). Cada regra abaixo cita a página (p.) de origem.
 *
 * Este módulo não depende do navegador nem do Firebase: pode ser testado com
 * `node --test`. As regras são CONSTANTES NO CÓDIGO: para atualizar
 * qualquer valor é preciso editar este arquivo e publicar uma nova versão do site.
 *
 * Convenções de precisão (para não errar limites como 79,99% / 80% / 80,01%):
 *  - Valores em reais viram CENTAVOS INTEIROS na entrada; nada de ponto flutuante
 *    nas comparações de faixa nem na multiplicação por fatores.
 *  - Fatores e percentuais são guardados em CENTÉSIMOS (0,40 → 40; 7% → 7).
 *  - Faixas são escolhidas pelo LIMITE INFERIOR ("DE"). Onde o PDF deixa
 *    intervalos sem cobertura ou faixas sobrepostas, o resultado traz um AVISO.
 *  - Arredondamento: o documento não define. Cada componente monetário é
 *    arredondado ao centavo (meio para cima) SOMENTE ao final do seu cálculo,
 *    e o total é a soma dos componentes arredondados (o que a tela exibe soma
 *    exatamente). Nenhum valor intermediário é arredondado antes disso.
 */

export const VERSAO_REGRAS = "Outubro/2026";
export const ARQUIVO_FONTE = "RV Geral Terra Oficial (Outubro26) – Comercial.pdf";

// ============================================================================
// 1. CONSTANTES DAS REGRAS (únicos lugares onde existem números de regra)
// ============================================================================

/** Acelerador de Qualidade (p.5, 7, 10, 12, 14). Fator × RV "Vendeu & Ganhou".
 *  Elegibilidade: índice > 80%. Cortes EXCLUSIVOS: >80 → 5%, >85 → 7%, >90 → 10%. */
const ACELERADOR_QUALIDADE = [
  { indiceMaiorQue: 90, percentual: 10 },
  { indiceMaiorQue: 85, percentual: 7 },
  { indiceMaiorQue: 80, percentual: 5 },
];

/** Consultor PAP (p.7). Faixa por valor de venda instalada; fator × venda total. */
const FAIXAS_PAP = [
  { rotulo: "Faixa 1", de: 0, ate: 99_900, fator: 0 }, // até R$ 999,00
  { rotulo: "Faixa 2", de: 100_000, ate: 200_000, fator: 40 }, // R$ 1.000,00 a 2.000,00
  { rotulo: "Faixa 3", de: 200_100, ate: 300_000, fator: 75 }, // R$ 2.001,00 a 3.000,00
  { rotulo: "Faixa 4", de: 300_100, ate: 400_000, fator: 90 }, // R$ 3.001,00 a 4.000,00
  { rotulo: "Faixa 5", de: 400_100, ate: null, fator: 110 }, // a partir de R$ 4.001,00
];

/** Consultor Call Center (p.10). Mesmos valores do PAP no documento, mas mantidos
 *  como tabela PRÓPRIA: se uma das áreas mudar, a outra não é afetada. */
const FAIXAS_CALLCENTER = [
  { rotulo: "Faixa 1", de: 0, ate: 99_900, fator: 0 },
  { rotulo: "Faixa 2", de: 100_000, ate: 200_000, fator: 40 },
  { rotulo: "Faixa 3", de: 200_100, ate: 300_000, fator: 75 },
  { rotulo: "Faixa 4", de: 300_100, ate: 400_000, fator: 90 },
  { rotulo: "Faixa 5", de: 400_100, ate: null, fator: 110 },
];

/** Consultor Digital / Célula online (p.14). A faixa 6 é "ACIMA de R$ 12.000,00".
 *  O PDF não lista nada entre R$ 8.000,00 e R$ 8.501,00 (lacuna). */
const FAIXAS_DIGITAL = [
  { rotulo: "Faixa 1", de: 1, ate: 600_000, fator: 10 }, // R$ 0,01 a 6.000,00
  { rotulo: "Faixa 2", de: 600_100, ate: 700_000, fator: 10 }, // R$ 6.001,00 a 7.000,00
  { rotulo: "Faixa 3", de: 700_100, ate: 800_000, fator: 11 }, // R$ 7.001,00 a 8.000,00
  { rotulo: "Faixa 4", de: 850_100, ate: 950_000, fator: 12 }, // R$ 8.501,00 a 9.500,00
  { rotulo: "Faixa 5", de: 950_100, ate: 1_200_000, fator: 13 }, // R$ 9.501,00 a 12.000,00
  { rotulo: "Faixa 6", de: 1_200_001, ate: null, fator: 15 }, // acima de R$ 12.000,00
];

/** Vendedor Loja (p.5). Faixa pelo % de atingimento; fator × venda instalada.
 *  Atenção: a faixa 1 (0% a 79,99%) PAGA 0,10 segundo o PDF. */
const FAIXAS_LOJA = [
  { rotulo: "Faixa 6 (≥ 115%)", dePct: 115, fator: 45 },
  { rotulo: "Faixa 5 (110% a 114,99%)", dePct: 110, fator: 40 },
  { rotulo: "Faixa 4 (105% a 109,99%)", dePct: 105, fator: 35 },
  { rotulo: "Faixa 3 (100% a 104,99%)", dePct: 100, fator: 30 },
  { rotulo: "Faixa 2 (80% a 99,99%)", dePct: 80, fator: 20 },
  { rotulo: "Faixa 1 (0% a 79,99%)", dePct: 0, fator: 10 },
];
/** Nota de rodapé da p.5: meta da premiação = meta bruta × 0,85% ("taxa normal de instalação"). */
const NOTA_META_LOJA = "meta bruta × 0,85 (taxa normal de instalação)";

/** Líder PAP (p.8), Líder Call Center (p.11) e Líder Digital – time (p.16).
 *  Valores em centavos. `tetoPct: null` = sem teto. */
const REGRAS_LIDER_ESCALONADO = {
  lider_pap: {
    paginaPdf: 8,
    minimoPct: 80, // < 80% → R$ 0
    valorMinimo: 60_000, // 80% a 99,99% → R$ 600,00
    valorMeta: 100_000, // ≥ 100% → R$ 1.000,00
    adicionalPorPasso: 20_000, // a cada 5% acima de 100% → + R$ 200,00
    passoPct: 5,
    tetoPct: null, // "Sem teto"
  },
  lider_callcenter: {
    paginaPdf: 11,
    minimoPct: 85,
    valorMinimo: 60_000,
    valorMeta: 100_000,
    adicionalPorPasso: 20_000,
    passoPct: 5,
    tetoPct: 140, // "até o limite máximo de 140% de atingimento"
  },
  lider_digital_time: {
    paginaPdf: 16,
    minimoPct: 80,
    valorMinimo: 60_000,
    valorMeta: 100_000,
    adicionalPorPasso: 20_000,
    passoPct: 5,
    tetoPct: 140,
  },
};

/** Líder Digital – vendas próprias (p.15). Meta do vendedor fixa em R$ 2.100,00. */
const META_VENDEDOR_LIDER_DIGITAL = 210_000;
const FAIXAS_LIDER_DIGITAL_PROPRIAS = [
  { dePct: 120, valor: 170_000 },
  { dePct: 100, valor: 120_000 },
  { dePct: 80, valor: 80_000 },
]; // < 80% → R$ 0

/** Coordenador Call Center (p.12). Faixa pelo % de atingimento; fator × venda instalada. */
const FAIXAS_COORDENADOR_CALLCENTER = [
  { dePct: 150, fator: 11 },
  { dePct: 140, fator: 10 },
  { dePct: 130, fator: 9 },
  { dePct: 120, fator: 8 },
  { dePct: 110, fator: 7 },
  { dePct: 100, fator: 6 },
  { dePct: 85, fator: 4 },
]; // 0% a 84% → fator 0

/** Executivo de Vendas (p.18). Percentual SOBRE A RECEITA gerada (Loja + PAP + Parceiros). */
const FAIXAS_EXECUTIVO = [
  { dePct: 100, percentual: 7 },
  { dePct: 90, percentual: 6 },
  { dePct: 80, percentual: 5 },
]; // < 80% → 0%

/** Gerente Regional (p.20). Valores fixos por faixa de atingimento. */
const FAIXAS_GERENTE_REGIONAL = [
  { dePct: 100, valor: 300_000, rotulo: "≥ 100%" },
  { dePct: 91, valor: 200_000, rotulo: "91% a 100%" },
  { dePct: 80, valor: 100_000, rotulo: "80% a 90%" },
];

/** Casa Conectada (p.22). Fator aplicado sobre CADA venda realizada. */
const CASA_CONECTADA = {
  loja_consultor_negocio: { rotulo: "Loja – Consultor de negócio", fator: 16 },
  loja_sub_gerente: { rotulo: "Loja – Sub gerente", fator: 6 },
  loja_gerente_loja: { rotulo: "Loja – Gerente de loja", fator: 8 },
  loja_executivo_venda: { rotulo: "Loja – Executivos de Venda", fator: 3 },
  loja_gerente_comercial: { rotulo: "Loja – Gerente Comercial", fator: 2 },
  cc_digital_consultor: {
    rotulo: "Call Center/Digital – Consultor Interno Vendas Jr / Consultor Digital",
    fator: 20,
  },
  cc_digital_lider: { rotulo: "Call Center/Digital – Líder", fator: 10 },
  cc_digital_coordenador: { rotulo: "Call Center/Digital – Coordenador", fator: 5 },
  pap_consultor_i_ii: { rotulo: "PAP – Consultor I e II (vendas do próprio consultor)", fator: 16 },
  pap_consultor_ii_time: { rotulo: "PAP – Consultor II (vendas do time)", fator: 9 },
  pap_lider: { rotulo: "PAP – Líder", fator: 5 },
  pap_executivo_venda: { rotulo: "PAP – Executivos de Venda", fator: 3 },
  pap_gerente_comercial: { rotulo: "PAP – Gerente Comercial", fator: 2 },
};

/** Garantia de RV do Consultor I PAP (p.7): admitidos a partir de 16/03/26, RV < R$ 300,
 *  recebem R$ 300 (válido por 3 meses). */
const GARANTIA_PAP = { valor: 30_000, admitidosAPartirDe: "16/03/2026", meses: 3 };

/** Limite de segurança para entradas (evita estouro numérico e digitação errada). */
const LIMITE_MAXIMO_REAIS = 1_000_000_000;

// ============================================================================
// 2. FUNÇÕES AUXILIARES (validação, dinheiro, formatação)
// ============================================================================

/** "Vazio" = ausente (diferente de zero). */
function estaVazio(v) {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

/**
 * Converte a entrada em número, ou devolve { erro }.
 * Aceita número, "2500", "2500.50" e "2.500,50".
 */
export function lerNumero(bruto) {
  if (typeof bruto === "number") {
    return Number.isFinite(bruto) ? { valor: bruto } : { erro: "valor inválido" };
  }
  if (typeof bruto !== "string") return { erro: "valor inválido" };
  let t = bruto.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { erro: "valor inválido" };
  return { valor: Number(t) };
}

/**
 * Lê um campo numérico das entradas.
 * opcoes: { rotulo, obrigatorio, maiorQueZero, max }
 * Retorna { ausente: true } | { valor } | { erro }.
 */
function lerCampo(entradas, id, { rotulo, obrigatorio = true, maiorQueZero = false, max = LIMITE_MAXIMO_REAIS }) {
  const bruto = entradas ? entradas[id] : undefined;
  if (estaVazio(bruto)) {
    return obrigatorio ? { erro: `Informe: ${rotulo}.` } : { ausente: true };
  }
  const n = lerNumero(bruto);
  if (n.erro) return { erro: `${rotulo}: informe um número válido.` };
  if (n.valor < 0) return { erro: `${rotulo}: não pode ser negativo.` };
  if (maiorQueZero && n.valor === 0) return { erro: `${rotulo}: deve ser maior que zero.` };
  if (n.valor > max) return { erro: `${rotulo}: valor acima do limite aceito.` };
  return { valor: n.valor };
}

/** Reais → centavos inteiros. */
export function paraCentavos(reais) {
  return Math.round(reais * 100);
}

/** Divisão inteira arredondando meio para cima (a ≥ 0, b > 0). */
function divArredondada(a, b) {
  return Math.floor((2 * a + b) / (2 * b));
}

/** Centavos → reais (número com 2 casas). */
function reais(centavos) {
  return centavos / 100;
}

/** Formata em R$ 1.234,56 (padrão brasileiro). */
export function formatarBRL(valor) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Formata percentual com até 2 casas, no padrão brasileiro: 105,26%. */
export function formatarPct(valor) {
  return (
    Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + "%"
  );
}

/** Fator em centésimos → "0,40". */
function fmtFator(centesimos) {
  return (centesimos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Atingimento em % apenas para EXIBIÇÃO (as decisões usam inteiros, nunca este valor). */
function pctExibicao(realizadoC, metaC) {
  return (realizadoC * 100) / metaC;
}

/**
 * ¿realizado/meta ≥ limitePct%? Comparação exata com inteiros:
 * realizado×100 ≥ meta×limite. Evita erros como 0,29×100 = 28,999…
 */
function atingiu(realizadoC, metaC, limitePct) {
  return realizadoC * 100 >= metaC * limitePct;
}

// ============================================================================
// 3. SELEÇÃO DE FAIXAS E ACELERADOR
// ============================================================================

/** Percentual do acelerador de qualidade para um índice (em %), 0 se inelegível. */
export function percentualAceleradorQualidade(indice) {
  for (const regra of ACELERADOR_QUALIDADE) {
    if (indice > regra.indiceMaiorQue) return regra.percentual;
  }
  return 0;
}

/**
 * Faixa por VALOR (centavos), usando o limite inferior. `escala` = { num, den }
 * reduz proporcionalmente os gatilhos (férias): valor ≥ de × num/den.
 * Retorna { faixa, lacuna } — `lacuna` = valor entre o "ATÉ" desta faixa e o
 * "DE" da próxima (intervalo que o PDF não cobre).
 */
export function selecionarFaixaPorValor(valorC, faixas, escala = { num: 1, den: 1 }) {
  let escolhida = null;
  let indice = -1;
  faixas.forEach((f, i) => {
    if (valorC * escala.den >= f.de * escala.num) {
      escolhida = f;
      indice = i;
    }
  });
  let lacuna = false;
  if (escolhida && escolhida.ate !== null) {
    const proxima = faixas[indice + 1];
    if (proxima && valorC * escala.den > escolhida.ate * escala.num && valorC * escala.den < proxima.de * escala.num) {
      lacuna = true;
    }
  }
  return { faixa: escolhida, lacuna };
}

/** Faixa por ATINGIMENTO (lista em ordem decrescente de dePct). null se abaixo de todas. */
function selecionarFaixaPorAtingimento(realizadoC, metaC, faixas) {
  return faixas.find((f) => atingiu(realizadoC, metaC, f.dePct)) || null;
}

/** Proporção para férias (p.7 e p.10): gatilhos × dias trabalhados / dias do período. */
function lerProporcaoFerias(entradas, erros) {
  const a = entradas ? entradas.diasTrabalhados : undefined;
  const b = entradas ? entradas.diasPeriodo : undefined;
  if (estaVazio(a) && estaVazio(b)) return { num: 1, den: 1, aplicada: false };
  if (estaVazio(a) || estaVazio(b)) {
    erros.push("Férias: informe os dois campos (dias trabalhados e dias do período) ou deixe ambos em branco.");
    return null;
  }
  const na = lerNumero(a);
  const nb = lerNumero(b);
  const inteiro = (n) => !n.erro && Number.isInteger(n.valor);
  if (!inteiro(na) || !inteiro(nb) || na.valor < 1 || nb.valor < 1 || nb.valor > 31) {
    erros.push("Férias: use números inteiros (dias do período entre 1 e 31; dias trabalhados a partir de 1).");
    return null;
  }
  if (na.valor > nb.valor) {
    erros.push("Férias: os dias trabalhados não podem ser maiores que os dias do período.");
    return null;
  }
  return { num: na.valor, den: nb.valor, aplicada: na.valor !== nb.valor, dias: na.valor, periodo: nb.valor };
}

/** Lê o índice de qualidade (opcional: vazio = não informado; 0 é válido). */
function lerIndiceQualidade(entradas, erros) {
  const r = lerCampo(entradas, "indiceQualidade", { rotulo: "Índice de Qualidade (%)", obrigatorio: false });
  if (r.erro) {
    erros.push(r.erro);
    return null;
  }
  if (r.ausente) return { ausente: true };
  if (r.valor > 100) {
    erros.push("Índice de Qualidade (%): deve estar entre 0 e 100.");
    return null;
  }
  return { valor: r.valor };
}

/** Sim/Não e checkbox: true, "true", "on", "1" ou "sim". */
function marcado(v) {
  return v === true || v === "true" || v === "on" || v === "1" || v === 1 || (typeof v === "string" && v.trim().toLowerCase() === "sim");
}

// ============================================================================
// 4. MONTAGEM DO RESULTADO
// ============================================================================

function novoResultado(id, rotulo, paginaPdf) {
  return {
    ok: false,
    categoria: id,
    rotulo,
    paginaPdf,
    parcial: false, // true = regra do PDF NÃO implementada por completo
    erros: [],
    avisos: [],
    meta: null,
    realizado: null,
    pctAtingimento: null,
    faixa: null,
    componentes: [], // [{ id, rotulo, valor }] — soma = rvTotal
    rvBase: 0,
    rvAcelerador: 0,
    rvTotal: 0,
    memoria: [],
  };
}

function falha(res, erros) {
  res.ok = false;
  res.erros = erros;
  return res;
}

function finalizar(res) {
  res.ok = true;
  res.rvTotal = reais(res.componentes.reduce((s, c) => s + Math.round(c.valor * 100), 0));
  res.memoria.push(`Total estimado: ${formatarBRL(res.rvTotal)}.`);
  return res;
}

/** Adiciona o acelerador de qualidade (se aplicável) e devolve o valor em centavos. */
function aplicarAcelerador(res, rvBaseNumeradorCentavos, denominador, indice) {
  // rvBase exata = numerador/denominador (centavos). O acelerador usa a base NÃO arredondada.
  if (!indice || indice.ausente) {
    // A interface não pede mais o índice de qualidade (decisão do negócio): a simulação NÃO inclui
    // o acelerador. O motor continua aceitando `indiceQualidade` como entrada opcional (testes/uso futuro).
    res.memoria.push("Acelerador de qualidade: não incluído nesta simulação.");
    return 0;
  }
  const pct = percentualAceleradorQualidade(indice.valor);
  if (pct === 0) {
    res.memoria.push(
      `Acelerador de qualidade: índice ${formatarPct(indice.valor)} (precisa ser > 80%) → sem acelerador.`
    );
    return 0;
  }
  const valorC = divArredondada(rvBaseNumeradorCentavos * pct, denominador * 100);
  res.rvAcelerador = reais(valorC);
  res.componentes.push({ id: "acelerador", rotulo: `Acelerador de qualidade (${pct}%)`, valor: reais(valorC) });
  res.memoria.push(
    `Acelerador de qualidade: índice ${formatarPct(indice.valor)} → ${pct}% × ${formatarBRL(res.rvBase)} = ${formatarBRL(reais(valorC))}.`
  );
  return valorC;
}

function adicionarBase(res, rotulo, centavos) {
  res.rvBase = reais(centavos);
  res.componentes.push({ id: "base", rotulo, valor: reais(centavos) });
}

// ============================================================================
// 5. CÁLCULO POR CATEGORIA
// ============================================================================

/** Consultor por valor de venda (PAP, Call Center, Digital): fator × venda + acelerador. */
function calcularConsultorPorValor({ id, rotulo, paginaPdf, faixas, aceitaFerias, aceitaGarantia }, entradas) {
  const res = novoResultado(id, rotulo, paginaPdf);
  const erros = [];
  const venda = lerCampo(entradas, "vendaInstalada", { rotulo: "Venda instalada no mês (R$)" });
  if (venda.erro) erros.push(venda.erro);
  const indice = lerIndiceQualidade(entradas, erros);
  const ferias = aceitaFerias ? lerProporcaoFerias(entradas, erros) : { num: 1, den: 1, aplicada: false };
  if (erros.length) return falha(res, erros);

  const vendaC = paraCentavos(venda.valor);
  res.realizado = venda.valor;

  const { faixa, lacuna } = selecionarFaixaPorValor(vendaC, faixas, ferias);
  const fator = faixa ? faixa.fator : 0;
  res.faixa = {
    descricao: faixa ? faixa.rotulo : "Abaixo da primeira faixa",
    fator: fator / 100,
  };
  if (ferias.aplicada) {
    res.memoria.push(
      `Férias: gatilhos das faixas proporcionais a ${ferias.dias}/${ferias.periodo} dias trabalhados (p.${paginaPdf}).`
    );
  }
  if (lacuna) {
    res.avisos.push(
      `O valor informado cai num intervalo que a tabela do PDF (p.${paginaPdf}) não cobre. Foi aplicada a faixa anterior (${faixa.rotulo}); confirme com a área responsável.`
    );
  }
  res.memoria.push(`Venda instalada: ${formatarBRL(venda.valor)} → ${res.faixa.descricao}, fator ${fmtFator(fator)}.`);

  // RV Vendeu & Ganhou = venda × fator (centavos × centésimos / 100)
  const numeradorBase = vendaC * fator; // centavos × centésimos
  const baseC = divArredondada(numeradorBase, 100);
  adicionarBase(res, "RV Vendeu & Ganhou", baseC);
  res.memoria.push(`RV Vendeu & Ganhou: ${formatarBRL(venda.valor)} × ${fmtFator(fator)} = ${formatarBRL(res.rvBase)}.`);

  const aceleradorC = aplicarAcelerador(res, numeradorBase, 100, indice);

  if (aceitaGarantia && marcado(entradas.novoColaborador) && baseC < GARANTIA_PAP.valor) {
    const totalAntes = baseC + aceleradorC;
    const complementoC = Math.max(0, GARANTIA_PAP.valor - totalAntes);
    res.componentes.push({
      id: "garantia",
      rotulo: `Complemento da garantia de ${formatarBRL(reais(GARANTIA_PAP.valor))}`,
      valor: reais(complementoC),
    });
    res.memoria.push(
      `Garantia (p.7): RV (${formatarBRL(res.rvBase)}) < ${formatarBRL(reais(GARANTIA_PAP.valor))} e colaborador admitido a partir de ${GARANTIA_PAP.admitidosAPartirDe} (válido por ${GARANTIA_PAP.meses} meses) → total garantido de ${formatarBRL(reais(GARANTIA_PAP.valor))}.`
    );
    res.avisos.push(
      "Garantia de R$ 300,00: o PDF não diz se o acelerador de qualidade soma ao valor garantido. Aqui o total fica em no mínimo R$ 300,00 (nunca abaixo), sem somar o acelerador por cima; confirme com a área responsável."
    );
  }
  return finalizar(res);
}

/** Aplica a garantia do PAP a valores já calculados (exposta para reproduzir o exemplo do PDF). */
export function aplicarGarantiaNovoColaborador(rvBase, rvTotal) {
  if (rvBase < reais(GARANTIA_PAP.valor)) return Math.max(rvTotal, reais(GARANTIA_PAP.valor));
  return rvTotal;
}

function calcularConsultorPAP(entradas) {
  return calcularConsultorPorValor(
    { id: "consultor_pap", rotulo: "Consultor PAP", paginaPdf: 7, faixas: FAIXAS_PAP, aceitaFerias: true, aceitaGarantia: true },
    entradas
  );
}

function calcularConsultorCallCenter(entradas) {
  return calcularConsultorPorValor(
    { id: "consultor_callcenter", rotulo: "Consultor Call Center", paginaPdf: 10, faixas: FAIXAS_CALLCENTER, aceitaFerias: true, aceitaGarantia: false },
    entradas
  );
}

function calcularConsultorDigital(entradas) {
  return calcularConsultorPorValor(
    { id: "consultor_digital", rotulo: "Consultor Digital", paginaPdf: 14, faixas: FAIXAS_DIGITAL, aceitaFerias: false, aceitaGarantia: false },
    entradas
  );
}

/** Lê meta e realizado (ambos > 0 / ≥ 0) e devolve centavos. */
function lerMetaERealizado(entradas, erros, rotuloMeta, rotuloRealizado) {
  const meta = lerCampo(entradas, "meta", { rotulo: rotuloMeta, maiorQueZero: true });
  const real = lerCampo(entradas, "realizado", { rotulo: rotuloRealizado });
  if (meta.erro) erros.push(meta.erro);
  if (real.erro) erros.push(real.erro);
  if (meta.erro || real.erro) return null;
  return { metaC: paraCentavos(meta.valor), realC: paraCentavos(real.valor), meta: meta.valor, real: real.valor };
}

function descreverAtingimento(res, moeda) {
  const f = (v) => (moeda ? formatarBRL(v) : v.toLocaleString("pt-BR"));
  res.memoria.push(
    `Meta: ${f(res.meta)} | Realizado: ${f(res.realizado)} | Atingimento: ${formatarPct(res.pctAtingimento)}.`
  );
}

/** Líder PAP / Call Center / Digital (time): valor fixo + R$ 200 a cada 5% acima de 100%. */
function calcularLiderEscalonado(id, rotulo, entradas, moeda = true) {
  const regra = REGRAS_LIDER_ESCALONADO[id];
  const res = novoResultado(id, rotulo, regra.paginaPdf);
  const erros = [];
  const d = lerMetaERealizado(
    entradas,
    erros,
    moeda ? "Meta (R$)" : "Meta do time",
    moeda ? "Receita/venda instalada no mês (R$)" : "Resultado realizado do time (mesma unidade da meta)"
  );
  if (erros.length) return falha(res, erros);

  const { metaC, realC } = d;
  res.meta = d.meta;
  res.realizado = d.real;
  res.pctAtingimento = pctExibicao(realC, metaC);
  descreverAtingimento(res, moeda);

  let valorC = 0;
  if (!atingiu(realC, metaC, regra.minimoPct)) {
    res.faixa = { descricao: `Abaixo de ${regra.minimoPct}%` };
    res.memoria.push(`Atingimento abaixo de ${regra.minimoPct}% → sem RV.`);
    res.rvBase = 0;
    return finalizar(res);
  }

  if (!atingiu(realC, metaC, 100)) {
    valorC = regra.valorMinimo;
    res.faixa = { descricao: `${regra.minimoPct}% a 99,99%` };
    res.memoria.push(`Faixa ${regra.minimoPct}% a 99,99% → ${formatarBRL(reais(valorC))}.`);
    adicionarBase(res, "RV da faixa", valorC);
    return finalizar(res);
  }

  // ≥ 100%: valor da meta + adicional a cada passo de 5% (limitado ao teto, se houver)
  const valorRealizadoPonderado = regra.tetoPct === null ? realC * 100 : Math.min(realC * 100, metaC * regra.tetoPct);
  const excedente = valorRealizadoPonderado - metaC * 100; // inteiro, em "centavos × %"
  const tamanhoPasso = metaC * regra.passoPct;
  const passos = (excedente - (excedente % tamanhoPasso)) / tamanhoPasso; // divisão inteira exata
  const adicionalC = passos * regra.adicionalPorPasso;
  valorC = regra.valorMeta + adicionalC;
  res.faixa = { descricao: "≥ 100%", passosDe5: passos };
  adicionarBase(res, "RV da meta (≥ 100%)", regra.valorMeta);
  res.memoria.push(`Atingiu a meta (≥ 100%) → ${formatarBRL(reais(regra.valorMeta))}.`);
  if (regra.tetoPct !== null && realC * 100 > metaC * regra.tetoPct) {
    res.memoria.push(`Teto de ${regra.tetoPct}% de atingimento aplicado ao adicional (p.${regra.paginaPdf}).`);
  }
  if (passos > 0) {
    res.componentes.push({
      id: "adicional",
      rotulo: `Adicional: ${passos} × a cada 5% acima de 100%`,
      valor: reais(adicionalC),
    });
    res.memoria.push(
      `Adicional: ${passos} bloco(s) de 5% acima de 100% × ${formatarBRL(reais(regra.adicionalPorPasso))} = ${formatarBRL(reais(adicionalC))}.`
    );
  } else {
    res.memoria.push("Adicional: nenhum (ainda não completou 5% acima de 100%).");
  }
  return finalizar(res);
}

/** Líder Digital — vendas próprias (p.15): valor por degrau de atingimento. */
function calcularLiderDigitalProprias(entradas) {
  const res = novoResultado("lider_digital_proprias", "Líder Digital – vendas próprias", 15);
  const erros = [];
  const venda = lerCampo(entradas, "realizado", { rotulo: "Venda instalada própria no mês (R$)" });
  const metaCampo = lerCampo(entradas, "meta", { rotulo: "Meta do vendedor (R$)", obrigatorio: false, maiorQueZero: true });
  if (venda.erro) erros.push(venda.erro);
  if (metaCampo.erro) erros.push(metaCampo.erro);
  if (erros.length) return falha(res, erros);

  const metaC = metaCampo.ausente ? META_VENDEDOR_LIDER_DIGITAL : paraCentavos(metaCampo.valor);
  const realC = paraCentavos(venda.valor);
  res.meta = reais(metaC);
  res.realizado = venda.valor;
  res.pctAtingimento = pctExibicao(realC, metaC);
  if (metaCampo.ausente) res.memoria.push(`Meta do vendedor do documento: ${formatarBRL(res.meta)} (p.15).`);
  descreverAtingimento(res, true);

  const faixa = selecionarFaixaPorAtingimento(realC, metaC, FAIXAS_LIDER_DIGITAL_PROPRIAS);
  if (!faixa) {
    res.faixa = { descricao: "< 80%" };
    res.memoria.push("Atingimento abaixo de 80% → sem RV.");
    return finalizar(res);
  }
  res.faixa = { descricao: `≥ ${faixa.dePct}%` };
  adicionarBase(res, `RV da faixa ≥ ${faixa.dePct}%`, faixa.valor);
  res.memoria.push(`Faixa ≥ ${faixa.dePct}% → ${formatarBRL(reais(faixa.valor))}.`);
  res.avisos.push(
    "O PDF (p.15) traz esta tabela separada da de vendas do time (p.16) e não diz se os dois valores se somam. Cada simulação mostra apenas uma delas."
  );
  return finalizar(res);
}

/** Coordenador Call Center (p.12): fator pelo atingimento × venda + acelerador. */
function calcularCoordenadorCallCenter(entradas) {
  const res = novoResultado("coordenador_callcenter", "Coordenador Call Center", 12);
  const erros = [];
  const d = lerMetaERealizado(entradas, erros, "Meta (R$)", "Venda instalada no mês (R$)");
  const indice = lerIndiceQualidade(entradas, erros);
  if (erros.length) return falha(res, erros);

  const { metaC, realC } = d;
  res.meta = d.meta;
  res.realizado = d.real;
  res.pctAtingimento = pctExibicao(realC, metaC);
  descreverAtingimento(res, true);

  const faixa = selecionarFaixaPorAtingimento(realC, metaC, FAIXAS_COORDENADOR_CALLCENTER);
  const fator = faixa ? faixa.fator : 0;
  res.faixa = { descricao: faixa ? `≥ ${faixa.dePct}%` : "Abaixo de 85%", fator: fator / 100 };
  res.memoria.push(
    faixa
      ? `Faixa ≥ ${faixa.dePct}% → fator ${fmtFator(fator)}.`
      : "Atingimento abaixo de 85% → fator 0 (sem comissão)."
  );
  if (!faixa && res.pctAtingimento >= 84 && res.pctAtingimento < 85) {
    res.avisos.push("Entre 84% e 85% o PDF não define faixa; foi considerado fator 0 (faixa 1: 0% a 84%).");
  }

  const numeradorBase = realC * fator;
  adicionarBase(res, "RV Vendeu & Ganhou", divArredondada(numeradorBase, 100));
  res.memoria.push(`RV: ${formatarBRL(d.real)} × ${fmtFator(fator)} = ${formatarBRL(res.rvBase)}.`);
  aplicarAcelerador(res, numeradorBase, 100, indice);
  return finalizar(res);
}

/** Vendedor Loja (p.5): fator pelo atingimento × venda + acelerador. PARCIAL. */
function calcularVendedorLoja(entradas) {
  const res = novoResultado("vendedor_loja", "Vendedor Loja", 5);
  const erros = [];
  const d = lerMetaERealizado(entradas, erros, "Meta da premiação (R$)", "Venda instalada no mês (R$)");
  const indice = lerIndiceQualidade(entradas, erros);
  if (erros.length) return falha(res, erros);

  const { metaC, realC } = d;
  res.parcial = true;
  res.meta = d.meta;
  res.realizado = d.real;
  res.pctAtingimento = pctExibicao(realC, metaC);
  descreverAtingimento(res, true);

  const faixa = selecionarFaixaPorAtingimento(realC, metaC, FAIXAS_LOJA);
  const fator = faixa.fator; // a faixa 1 começa em 0%, sempre há faixa
  res.faixa = { descricao: faixa.rotulo, fator: fator / 100 };
  res.memoria.push(`${faixa.rotulo} → fator ${fmtFator(fator)}.`);

  const numeradorBase = realC * fator;
  adicionarBase(res, "RV Vendeu & Ganhou", divArredondada(numeradorBase, 100));
  res.memoria.push(`RV Vendeu & Ganhou: ${formatarBRL(d.real)} × ${fmtFator(fator)} = ${formatarBRL(res.rvBase)}.`);
  aplicarAcelerador(res, numeradorBase, 100, indice);

  res.avisos.push(
    "Resultado PARCIAL: a p.5 também prevê a tabela de pilares/itens (móvel, fixa, seguros, mercantil etc.) com percentuais e \"Super Faixa Bônus\". Essa parte NÃO foi implementada (a página não deixa claro o valor-base de cada item); some-a à parte."
  );
  res.avisos.push(`Meta da premiação (p.5): ${NOTA_META_LOJA}. Informe aqui a meta já ajustada.`);
  return finalizar(res);
}

/** Executivo de Vendas (p.18): percentual pelo atingimento SOBRE A RECEITA. */
function calcularExecutivoVendas(entradas) {
  const res = novoResultado("executivo_vendas", "Executivo de Vendas", 18);
  const erros = [];
  const d = lerMetaERealizado(
    entradas,
    erros,
    "Meta total Loja + PAP + Parceiros (R$)",
    "Receita instalada total (Loja, PAP, Parceiros e Indicações de Parceiros) (R$)"
  );
  if (erros.length) return falha(res, erros);

  const { metaC, realC } = d;
  res.meta = d.meta;
  res.realizado = d.real;
  res.pctAtingimento = pctExibicao(realC, metaC);
  descreverAtingimento(res, true);

  const faixa = selecionarFaixaPorAtingimento(realC, metaC, FAIXAS_EXECUTIVO);
  const pct = faixa ? faixa.percentual : 0;
  res.faixa = { descricao: faixa ? `≥ ${faixa.dePct}%` : "Abaixo de 80%", percentual: pct };
  res.memoria.push(faixa ? `Faixa ≥ ${faixa.dePct}% → ${pct}% sobre a receita.` : "Atingimento abaixo de 80% → 0%.");
  adicionarBase(res, "RV (percentual sobre a receita)", divArredondada(realC * pct, 100));
  res.memoria.push(`RV: ${pct}% × ${formatarBRL(d.real)} = ${formatarBRL(res.rvBase)}.`);
  return finalizar(res);
}

/** Gerente Regional (p.20): valor fixo por faixa de atingimento. */
function calcularGerenteRegional(entradas) {
  const res = novoResultado("gerente_regional", "Gerente Regional", 20);
  const erros = [];
  const d = lerMetaERealizado(
    entradas,
    erros,
    "Meta (R$)",
    "Receita instalada no mês (Loja, PAP, Parceiros e Indicações de Parceiros) (R$)"
  );
  if (erros.length) return falha(res, erros);

  const { metaC, realC } = d;
  res.meta = d.meta;
  res.realizado = d.real;
  res.pctAtingimento = pctExibicao(realC, metaC);
  descreverAtingimento(res, true);

  const faixa = selecionarFaixaPorAtingimento(realC, metaC, FAIXAS_GERENTE_REGIONAL);
  if (!faixa) {
    res.faixa = { descricao: "Abaixo de 80%" };
    res.memoria.push("Atingimento abaixo de 80% → sem RV.");
    res.avisos.push("O PDF (p.20) não informa o valor abaixo de 80%; foi considerado R$ 0,00 (a primeira faixa listada começa em 80%).");
    return finalizar(res);
  }
  res.faixa = { descricao: faixa.rotulo };
  adicionarBase(res, `RV da faixa ${faixa.rotulo}`, faixa.valor);
  res.memoria.push(`Faixa ${faixa.rotulo} → ${formatarBRL(reais(faixa.valor))}.`);
  if (realC === metaC) {
    res.avisos.push(
      "Exatamente 100%: o PDF (p.20) lista 100% em duas faixas (\"91% a 100%\" e \">= 100%\"). Foi aplicada a faixa \">= 100%\"; confirme com a área responsável."
    );
  }
  if (atingiu(realC, metaC, 90) && !atingiu(realC, metaC, 91)) {
    res.avisos.push(
      "Entre 90% e 91% o PDF (p.20) não define faixa (as faixas são \"80% a 90%\" e \"91% a 100%\"). Foi aplicada a faixa de 80% a 90%."
    );
  }
  return finalizar(res);
}

/** Casa Conectada (p.22): fator × valor das vendas do produto Casa Conectada. */
function calcularCasaConectada(entradas) {
  const res = novoResultado("casa_conectada", "Casa Conectada", 22);
  const erros = [];
  const chave = entradas ? entradas.cargo : undefined;
  if (estaVazio(chave)) erros.push("Informe: Cargo / canal.");
  else if (!Object.prototype.hasOwnProperty.call(CASA_CONECTADA, chave)) erros.push("Cargo / canal inválido.");
  const valor = lerCampo(entradas, "vendaInstalada", { rotulo: "Valor das vendas Casa Conectada (R$)" });
  if (valor.erro) erros.push(valor.erro);
  if (erros.length) return falha(res, erros);

  const cfg = CASA_CONECTADA[chave];
  res.realizado = valor.valor;
  res.faixa = { descricao: cfg.rotulo, fator: cfg.fator / 100 };
  res.memoria.push(`${cfg.rotulo}: fator ${fmtFator(cfg.fator)}.`);
  adicionarBase(res, "RV Casa Conectada", divArredondada(paraCentavos(valor.valor) * cfg.fator, 100));
  res.memoria.push(`RV: ${formatarBRL(valor.valor)} × ${fmtFator(cfg.fator)} = ${formatarBRL(res.rvBase)}.`);
  res.avisos.push(
    "O fator é aplicado sobre cada venda de Casa Conectada, sem somar com as demais vendas de produtos (p.22). O PDF só informa os fatores; o valor-base de cada venda é o valor da venda."
  );
  return finalizar(res);
}

// ============================================================================
// 6. CATÁLOGO DE CATEGORIAS (usado pela interface para montar os campos)
// ============================================================================

const CAMPO_VENDA = { id: "vendaInstalada", rotulo: "Venda instalada no mês (R$)", tipo: "moeda", obrigatorio: true };
// Índice de Qualidade e férias NÃO aparecem mais na interface (decisão do negócio). O motor ainda
// aceita `indiceQualidade`, `diasTrabalhados` e `diasPeriodo` como entradas opcionais.

export const CATEGORIAS = [
  {
    id: "consultor_pap",
    rotulo: "Consultor PAP",
    paginaPdf: 7,
    campos: [
      CAMPO_VENDA,
      {
        id: "novoColaborador",
        rotulo: "Dentro dos três primeiros meses?",
        tipo: "selecao",
        obrigatorio: false,
        padrao: "nao",
        opcoes: [
          { valor: "nao", rotulo: "Não" },
          { valor: "sim", rotulo: "Sim" },
        ],
        ajuda: `Garantia de R$ 300,00 (p.7): colaborador admitido a partir de ${GARANTIA_PAP.admitidosAPartirDe}, nos primeiros ${GARANTIA_PAP.meses} meses.`,
      },
    ],
    calcular: calcularConsultorPAP,
  },
  {
    id: "consultor_callcenter",
    rotulo: "Consultor Call Center",
    paginaPdf: 10,
    campos: [CAMPO_VENDA],
    calcular: calcularConsultorCallCenter,
  },
  {
    id: "consultor_digital",
    rotulo: "Consultor Digital",
    paginaPdf: 14,
    campos: [CAMPO_VENDA],
    calcular: calcularConsultorDigital,
  },
  {
    id: "vendedor_loja",
    rotulo: "Vendedor Loja (parcial)",
    paginaPdf: 5,
    campos: [
      { id: "meta", rotulo: "Meta da premiação (R$)", tipo: "moeda", obrigatorio: true, ajuda: `Meta da premiação = ${NOTA_META_LOJA}.` },
      { ...CAMPO_VENDA, id: "realizado" },
    ],
    calcular: (e) => calcularVendedorLoja(e),
  },
  {
    id: "lider_pap",
    rotulo: "Líder PAP",
    paginaPdf: 8,
    campos: [
      { id: "meta", rotulo: "Meta PAP (R$)", tipo: "moeda", obrigatorio: true },
      { id: "realizado", rotulo: "Receita instalada no mês – soma das vendas PAP (R$)", tipo: "moeda", obrigatorio: true },
    ],
    calcular: (e) => calcularLiderEscalonado("lider_pap", "Líder PAP", e),
  },
  {
    id: "lider_callcenter",
    rotulo: "Líder Call Center",
    paginaPdf: 11,
    campos: [
      { id: "meta", rotulo: "Meta (R$)", tipo: "moeda", obrigatorio: true },
      { id: "realizado", rotulo: "Venda instalada no mês (R$)", tipo: "moeda", obrigatorio: true, ajuda: "Inclua o serviço fixo dos parceiros afiliados/terceiros do callcenter (p.11)." },
    ],
    calcular: (e) => calcularLiderEscalonado("lider_callcenter", "Líder Call Center", e),
  },
  {
    id: "lider_digital_time",
    rotulo: "Líder Digital – vendas do time",
    paginaPdf: 16,
    campos: [
      { id: "meta", rotulo: "Meta do time", tipo: "numero", obrigatorio: true, ajuda: "Mesma unidade do resultado (o exemplo do PDF usa números sem R$)." },
      { id: "realizado", rotulo: "Venda instalada no mês – time", tipo: "numero", obrigatorio: true },
    ],
    calcular: (e) => calcularLiderEscalonado("lider_digital_time", "Líder Digital – vendas do time", e, false),
  },
  {
    id: "lider_digital_proprias",
    rotulo: "Líder Digital – vendas próprias",
    paginaPdf: 15,
    campos: [
      { id: "meta", rotulo: "Meta do vendedor (R$)", tipo: "moeda", obrigatorio: false, ajuda: `Em branco = R$ ${(META_VENDEDOR_LIDER_DIGITAL / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (valor do documento).` },
      { id: "realizado", rotulo: "Venda instalada própria no mês (R$)", tipo: "moeda", obrigatorio: true },
    ],
    calcular: calcularLiderDigitalProprias,
  },
  {
    id: "coordenador_callcenter",
    rotulo: "Coordenador Call Center",
    paginaPdf: 12,
    campos: [
      { id: "meta", rotulo: "Meta (R$)", tipo: "moeda", obrigatorio: true },
      { id: "realizado", rotulo: "Venda instalada no mês (R$)", tipo: "moeda", obrigatorio: true, ajuda: "Inclua o serviço fixo dos parceiros afiliados/terceiros do callcenter (p.12)." },
    ],
    calcular: calcularCoordenadorCallCenter,
  },
  {
    id: "executivo_vendas",
    rotulo: "Executivo de Vendas",
    paginaPdf: 18,
    campos: [
      { id: "meta", rotulo: "Meta total Loja + PAP + Parceiros (R$)", tipo: "moeda", obrigatorio: true },
      { id: "realizado", rotulo: "Receita instalada total (R$)", tipo: "moeda", obrigatorio: true, ajuda: "Soma das vendas de Loja, PAP, Parceiros e Indicações de Parceiros." },
    ],
    calcular: calcularExecutivoVendas,
  },
  {
    id: "gerente_regional",
    rotulo: "Gerente Regional",
    paginaPdf: 20,
    campos: [
      { id: "meta", rotulo: "Meta (R$)", tipo: "moeda", obrigatorio: true },
      { id: "realizado", rotulo: "Receita instalada no mês (R$)", tipo: "moeda", obrigatorio: true, ajuda: "Soma das vendas de Loja, PAP, Parceiros e Indicações de Parceiros." },
    ],
    calcular: calcularGerenteRegional,
  },
  {
    id: "casa_conectada",
    rotulo: "Casa Conectada",
    paginaPdf: 22,
    campos: [
      {
        id: "cargo",
        rotulo: "Cargo / canal",
        tipo: "selecao",
        obrigatorio: true,
        opcoes: Object.entries(CASA_CONECTADA).map(([valor, c]) => ({ valor, rotulo: c.rotulo })),
      },
      { id: "vendaInstalada", rotulo: "Valor das vendas Casa Conectada (R$)", tipo: "moeda", obrigatorio: true },
    ],
    calcular: calcularCasaConectada,
  },
];

// ============================================================================
// 7. FUNÇÃO PRINCIPAL
// ============================================================================

/**
 * Calcula a simulação de uma categoria.
 * @param {string} categoriaId  um dos ids de CATEGORIAS
 * @param {object} entradas     { campoId: valor } — strings, números ou vazio
 * @returns resultado detalhado: { ok, erros[], avisos[], parcial, componentes[], rvBase,
 *          rvAcelerador, rvTotal, pctAtingimento, faixa, memoria[] }
 */
export function calcular(categoriaId, entradas = {}) {
  const cat = CATEGORIAS.find((c) => c.id === categoriaId);
  if (!cat) {
    const r = novoResultado(String(categoriaId), "Categoria desconhecida", null);
    r.erros = ["Categoria inválida."];
    return r;
  }
  return cat.calcular(entradas || {});
}

// ============================================================================
// 7B. FAIXA ATUAL, PRÓXIMA FAIXA E PROJEÇÃO ATÉ O FIM DO MÊS
//     Nenhum número de regra novo: os gatilhos vêm das MESMAS tabelas usadas no cálculo.
//     A projeção NÃO é regra do PDF: é uma estimativa por média diária (ver projetarFimDoMes).
// ============================================================================

/** Campo que representa o "realizado" em cada categoria (null = sem faixas por valor/atingimento). */
function campoRealizadoDa(categoriaId) {
  if (categoriaId === "casa_conectada") return "vendaInstalada";
  if (["consultor_pap", "consultor_callcenter", "consultor_digital"].includes(categoriaId)) return "vendaInstalada";
  return "realizado";
}

const teto = (a, b) => Math.floor((a + b - 1) / b); // ceil de inteiros positivos

/**
 * Gatilhos (em centavos do realizado) em ordem crescente, cada um com o "nível" de ganho
 * (fator, valor ou percentual) e o texto da faixa. Devolve null quando a categoria não tem faixas.
 */
function gatilhosDaCategoria(id, entradas) {
  const porValor = (faixas) =>
    faixas.map((f) => ({ c: f.de, nivel: f.fator, rotulo: f.rotulo, fator: f.fator / 100 }));
  if (id === "consultor_pap") return { moeda: true, itens: porValor(FAIXAS_PAP) };
  if (id === "consultor_callcenter") return { moeda: true, itens: porValor(FAIXAS_CALLCENTER) };
  if (id === "consultor_digital") return { moeda: true, itens: porValor(FAIXAS_DIGITAL) };

  const metaBruta = entradas ? lerNumero(entradas.meta) : { erro: true };
  let metaC = null;
  if (id === "lider_digital_proprias" && estaVazio(entradas && entradas.meta)) metaC = META_VENDEDOR_LIDER_DIGITAL;
  else if (!metaBruta.erro && metaBruta.valor > 0) metaC = paraCentavos(metaBruta.valor);
  if (metaC === null) return null;
  const emPct = (pct) => teto(metaC * pct, 100);

  if (id === "vendedor_loja")
    return { moeda: true, itens: FAIXAS_LOJA.slice().reverse().filter((f) => f.dePct > 0).map((f) => ({ c: emPct(f.dePct), nivel: f.fator, rotulo: f.rotulo, fator: f.fator / 100 })) };
  if (id === "coordenador_callcenter")
    return { moeda: true, itens: FAIXAS_COORDENADOR_CALLCENTER.slice().reverse().map((f) => ({ c: emPct(f.dePct), nivel: f.fator, rotulo: `≥ ${f.dePct}%`, fator: f.fator / 100 })) };
  if (id === "executivo_vendas")
    return { moeda: true, itens: FAIXAS_EXECUTIVO.slice().reverse().map((f) => ({ c: emPct(f.dePct), nivel: f.percentual, rotulo: `≥ ${f.dePct}%`, percentual: f.percentual })) };
  if (id === "gerente_regional")
    return { moeda: true, itens: FAIXAS_GERENTE_REGIONAL.slice().reverse().map((f) => ({ c: emPct(f.dePct), nivel: f.valor, rotulo: f.rotulo })) };
  if (id === "lider_digital_proprias")
    return { moeda: true, itens: FAIXAS_LIDER_DIGITAL_PROPRIAS.slice().reverse().map((f) => ({ c: emPct(f.dePct), nivel: f.valor, rotulo: `≥ ${f.dePct}%` })) };
  if (REGRAS_LIDER_ESCALONADO[id]) {
    const r = REGRAS_LIDER_ESCALONADO[id];
    const itens = [
      { c: emPct(r.minimoPct), nivel: r.valorMinimo, rotulo: `${r.minimoPct}% a 99,99%` },
      { c: emPct(100), nivel: r.valorMeta, rotulo: "≥ 100%" },
    ];
    const limite = r.tetoPct === null ? 1000 : r.tetoPct;
    for (let pct = 100 + r.passoPct, k = 1; pct <= limite; pct += r.passoPct, k++) {
      itens.push({ c: emPct(pct), nivel: r.valorMeta + k * r.adicionalPorPasso, rotulo: `≥ ${pct}% (+${k} × R$ 200,00)` });
    }
    return { moeda: id !== "lider_digital_time", itens };
  }
  return null;
}

/**
 * Faixa atual e próxima faixa (com ganho) para o valor informado.
 * "Próxima faixa" = o próximo gatilho em que o ganho (fator, valor ou percentual) AUMENTA.
 * O valor na próxima faixa é calculado pelo próprio `calcular()` com o realizado igual ao gatilho,
 * portanto segue exatamente as mesmas regras (garantia, arredondamento, avisos).
 * Retorna { ok, categoria, atual: {descricao}, proxima: null | {...}, maxima: boolean } ou { ok:false, erros }.
 */
export function analisarFaixa(categoriaId, entradas = {}) {
  const atual = calcular(categoriaId, entradas);
  if (!atual.ok) return { ok: false, erros: atual.erros };
  const campo = campoRealizadoDa(categoriaId);
  const g = gatilhosDaCategoria(categoriaId, entradas);
  const base = { ok: true, categoria: categoriaId, resultado: atual, atual: { descricao: atual.faixa ? atual.faixa.descricao : null, fator: atual.faixa ? atual.faixa.fator : undefined }, proxima: null, maxima: false, temFaixas: Boolean(g) };
  if (!g || !campo) return base;

  const realC = paraCentavos(lerNumero(entradas[campo]).valor);
  let nivelAtual = 0;
  for (const it of g.itens) if (it.c <= realC) nivelAtual = it.nivel;
  const prox = g.itens.find((it) => it.c > realC && it.nivel > nivelAtual);
  if (!prox) {
    base.maxima = true;
    return base;
  }
  const alvo = calcular(categoriaId, { ...entradas, [campo]: reais(prox.c) });
  if (!alvo.ok) return base;
  base.proxima = {
    descricao: alvo.faixa ? alvo.faixa.descricao : prox.rotulo,
    fator: alvo.faixa ? alvo.faixa.fator : undefined,
    gatilho: reais(prox.c),
    falta: reais(prox.c - realC),
    rvNaProxima: alvo.rvTotal,
    ganho: reais(Math.round(alvo.rvTotal * 100) - Math.round(atual.rvTotal * 100)),
    moeda: g.moeda,
  };
  return base;
}

/**
 * Projeção até o fim do mês pela MÉDIA DIÁRIA já realizada (estimativa, não é regra do PDF):
 *   média = realizado ÷ dias trabalhados;  projetado = realizado + média × dias restantes.
 * Os dias são informados pelo usuário (nada de calendário assumido). Arredonda o projetado ao centavo
 * e calcula a RV com o mesmo motor oficial. Em categorias com meta, a meta informada não é alterada.
 */
export function projetarFimDoMes(categoriaId, entradas = {}, { diasTrabalhados, diasRestantes } = {}) {
  const campo = campoRealizadoDa(categoriaId);
  if (!campo) return { ok: false, erros: ["Projeção indisponível para esta categoria."] };
  const erros = [];
  const inteiro = (v, rotulo, min) => {
    const n = estaVazio(v) ? { erro: true } : lerNumero(v);
    if (n.erro || !Number.isInteger(n.valor) || n.valor < min || n.valor > 31) {
      erros.push(`${rotulo}: use um número inteiro entre ${min} e 31.`);
      return null;
    }
    return n.valor;
  };
  const dt = inteiro(diasTrabalhados, "Dias trabalhados", 1);
  const dr = inteiro(diasRestantes, "Dias restantes", 0);
  const atual = calcular(categoriaId, entradas);
  if (!atual.ok) erros.push(...atual.erros);
  if (erros.length) return { ok: false, erros };

  const realC = paraCentavos(lerNumero(entradas[campo]).valor);
  // projetado = realC × (dt + dr) / dt, em centavos inteiros, meio para cima
  const projC = divArredondada(realC * (dt + dr), dt);
  const mediaC = divArredondada(realC, dt);
  const resultado = calcular(categoriaId, { ...entradas, [campo]: reais(projC) });
  if (!resultado.ok) return { ok: false, erros: resultado.erros };
  const descAtual = atual.faixa ? atual.faixa.descricao : null;
  const descProj = resultado.faixa ? resultado.faixa.descricao : null;
  return {
    ok: true,
    categoria: categoriaId,
    diasTrabalhados: dt,
    diasRestantes: dr,
    mediaDiaria: reais(mediaC),
    realizado: reais(realC),
    projetado: reais(projC),
    resultado,
    rvProjetada: resultado.rvTotal,
    faixaAtual: descAtual,
    faixaProjetada: descProj,
    mudaDeFaixa: descAtual !== descProj,
    sobe: resultado.rvTotal > atual.rvTotal,
    desce: resultado.rvTotal < atual.rvTotal,
  };
}

// ============================================================================
// 8. COMPATIBILIDADE com os imports antigos de home.js
//    (assinaturas anteriores mantidas; internamente usam as regras oficiais)
// ============================================================================

function legado(r) {
  return {
    rvBase: r.rvBase,
    valorAcelerador: r.rvAcelerador,
    rvTotal: r.rvTotal,
    fator: r.faixa && r.faixa.fator !== undefined ? r.faixa.fator : 0,
    pctAcelerador: r.rvBase > 0 ? Math.round((r.rvAcelerador / r.rvBase) * 100) / 100 : 0,
    pctAtingimento: r.pctAtingimento === null ? 0 : r.pctAtingimento,
    resultado: r,
  };
}

/** @deprecated use calcular("consultor_pap", {...}). O 2º parâmetro não tem efeito (a venda
 *  móvel já entra na receita; p.7). Índice vazio/null = não informado (não vira 100). */
export function calcularComissaoPAP(vendaTotal, possuiVendaMovel = false, indiceQualidade = null) {
  return legado(calcular("consultor_pap", { vendaInstalada: vendaTotal, indiceQualidade }));
}
/** @deprecated use calcular("consultor_callcenter", {...}). */
export function calcularComissaoCallCenter(vendaTotal, possuiVendaMovel = false, indiceQualidade = null) {
  return legado(calcular("consultor_callcenter", { vendaInstalada: vendaTotal, indiceQualidade }));
}
/** @deprecated use calcular("consultor_digital", {...}). */
export function calcularComissaoDigital(vendaTotal, indiceQualidade = null) {
  return legado(calcular("consultor_digital", { vendaInstalada: vendaTotal, indiceQualidade }));
}
/** @deprecated use calcular("lider_pap" | "lider_callcenter" | "lider_digital_time", {...}).
 *  `tipo` escolhe a regra: "pap" (padrão), "callcenter" ou "digital". */
export function calcularComissaoLider(meta, receitaInstalada, tipo = "pap") {
  const id = { pap: "lider_pap", callcenter: "lider_callcenter", digital: "lider_digital_time" }[tipo] || "lider_pap";
  return legado(calcular(id, { meta, realizado: receitaInstalada }));
}
/** @deprecated use calcular("executivo_vendas", {...}). */
export function calcularComissaoExecutivo(meta, receitaInstalada) {
  return legado(calcular("executivo_vendas", { meta, realizado: receitaInstalada }));
}
