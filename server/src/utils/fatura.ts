export function parcelaNaFatura(
  gasto: {
    dataCompra: Date
    parcelas: number
    parcelaAtual: number
    cartao: { diaFechamento: number; diaVencimento: number }
  },
  mesFatura: number,
  anoFatura: number
) {
  const dataCompra = new Date(gasto.dataCompra)
  const anoCompra = dataCompra.getUTCFullYear()
  const mesCompra = dataCompra.getUTCMonth()
  const ultimoDiaDoMes = new Date(Date.UTC(anoCompra, mesCompra + 1, 0)).getUTCDate()
  const diaFechamento = Math.min(gasto.cartao.diaFechamento, ultimoDiaDoMes)
  const fechamentoPosteriorAoVencimento = gasto.cartao.diaFechamento > gasto.cartao.diaVencimento
  const primeiraFaturaOffset =
    (dataCompra.getUTCDate() > diaFechamento ? 1 : 0) +
    (fechamentoPosteriorAoVencimento ? 1 : 0)
  const primeiraFatura = anoCompra * 12 + mesCompra + primeiraFaturaOffset
  const faturaSelecionada = anoFatura * 12 + mesFatura - 1
  const parcela = gasto.parcelaAtual + faturaSelecionada - primeiraFatura

  return parcela >= gasto.parcelaAtual && parcela <= gasto.parcelas ? parcela : null
}
