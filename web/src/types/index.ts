export interface Usuario {
  id: string
  nome: string
  email: string
  criadoEm?: string
}

export interface AuthResponse {
  user: Usuario
  accessToken: string
  refreshToken: string
}

export interface Cartao {
  id: string
  nome: string
  bandeira?: string
  cor?: string
  limite: number
  diaFechamento: number
  diaVencimento: number
  totalGasto?: number
  limiteDisponivel?: number
  percentualUtilizado?: number
  quantidadeGastos?: number
  usuarioId?: string
  criadoEm?: string
}

export interface Gasto {
  id: string
  descricao: string
  valor: number
  categoria: string
  dataCompra: string
  parcelas: number
  parcelaAtual: number
  recorrente: boolean
  status: string
  cartaoId: string
  cartao?: {
    id: string
    nome: string
    bandeira?: string
    cor?: string
  }
  criadoEm?: string
}

export interface BoletoRecorrente {
  id: string
  descricao: string
  valorPadrao: number
  valor: number
  valorAjustado: boolean
  categoria: string
  diaVencimento: number
  inicioEm: string
  mes: number
  ano: number
}

export interface AnaliseMensal {
  mes: number
  ano: number
  total: number
  totalCartoes: number
  totalBoletos: number
  totalVencimentoAteDia15: number
  totalVencimentoDia16EmDiante: number
  porCategoria: Array<{ nome: string; total: number }>
  porCartao: Array<{ id: string; nome: string; cor: string | null; total: number }>
}

export interface AnaliseFinanceira {
  meses: AnaliseMensal[]
}

export interface CategoriaGasto {
  categoria: string
  total: number
  percentual: number
}

export interface ResumoFinanceiro {
  totalGasto: number
  limiteTotal: number
  limiteDisponivel: number
  percentualUtilizado: number
  quantidadeGastos: number
  porCategoria: CategoriaGasto[]
}
