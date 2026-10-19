import React, { useEffect, useState } from 'react'
import {
  CreditCard,
  Plus,
  Trash2,
  TrendingDown,
  ShoppingBag,
  DollarSign,
  PieChart,
  AlertCircle,
  CheckCircle2,
  X,
  Wallet,
  RefreshCw,
  LogOut,
  Settings,
  Pencil,
} from 'lucide-react'
import { api } from './services/api'
import { useAuth } from './contexts/AuthContext'
import { AuthView } from './components/AuthView'
import { EditProfileModal } from './components/EditProfileModal'
import type { Cartao, Gasto, ResumoFinanceiro } from './types'

const CATEGORIAS = [
  { nome: 'Alimentação', cor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { nome: 'Transporte', cor: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { nome: 'Lazer', cor: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { nome: 'Saúde', cor: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  { nome: 'Assinaturas', cor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { nome: 'Educação', cor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { nome: 'Compras', cor: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  { nome: 'Outros', cor: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
]

const CORES_CARTAO = [
  { nome: 'Roxo Nubank', valor: '#820AD1' },
  { nome: 'Laranja Inter', valor: '#FF7A00' },
  { nome: 'Preto Black', valor: '#18181b' },
  { nome: 'Azul XP', valor: '#1e3a8a' },
  { nome: 'Verde Esmeralda', valor: '#059669' },
  { nome: 'Dourado Gold', valor: '#d97706' },
]

export default function App() {
  const { user, loading: authLoading, logout } = useAuth()
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null)
  const [loading, setLoading] = useState(true)
  const [cartaoSelecionado, setCartaoSelecionado] = useState<string>('TODOS')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('TODAS')

  // Modals
  const [modalGastoAberto, setModalGastoAberto] = useState(false)
  const [modalCartaoAberto, setModalCartaoAberto] = useState(false)
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false)

  // Form Gasto
  const [descricaoGasto, setDescricaoGasto] = useState('')
  const [valorGasto, setValorGasto] = useState('')
  const [categoriaGasto, setCategoriaGasto] = useState('Alimentação')
  const [cartaoGastoId, setCartaoGastoId] = useState('')
  const [dataGasto, setDataGasto] = useState(new Date().toISOString().split('T')[0])
  const [parcelasGasto, setParcelasGasto] = useState('1')
  const [parcelaAtualGasto, setParcelaAtualGasto] = useState('1')
  const [recorrenteGasto, setRecorrenteGasto] = useState(false)

  // Form Cartao
  const [cartaoEditando, setCartaoEditando] = useState<Cartao | null>(null)
  const [nomeCartao, setNomeCartao] = useState('')
  const [bandeiraCartao, setBandeiraCartao] = useState('Mastercard')
  const [corCartao, setCorCartao] = useState('#820AD1')
  const [limiteCartao, setLimiteCartao] = useState('')
  const [diaFechamento, setDiaFechamento] = useState('5')
  const [diaVencimento, setDiaVencimento] = useState('12')

  const [feedbackMsg, setFeedbackMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  const showFeedback = (tipo: 'sucesso' | 'erro', texto: string) => {
    setFeedbackMsg({ tipo, texto })
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  const abrirNovoCartao = () => {
    setCartaoEditando(null)
    setNomeCartao('')
    setBandeiraCartao('Mastercard')
    setCorCartao('#820AD1')
    setLimiteCartao('')
    setDiaFechamento('5')
    setDiaVencimento('12')
    setModalCartaoAberto(true)
  }

  const abrirEdicaoCartao = (cartao: Cartao) => {
    setCartaoEditando(cartao)
    setNomeCartao(cartao.nome)
    setBandeiraCartao(cartao.bandeira || 'Mastercard')
    setCorCartao(cartao.cor || '#820AD1')
    setLimiteCartao(String(cartao.limite))
    setDiaFechamento(String(cartao.diaFechamento))
    setDiaVencimento(String(cartao.diaVencimento))
    setModalCartaoAberto(true)
  }

  const carregarDados = async () => {
    try {
      setLoading(true)
      const [listaCartoes, listaGastos, resumoData] = await Promise.all([
        api.getCartoes(),
        api.getGastos({
          cartaoId: cartaoSelecionado !== 'TODOS' ? cartaoSelecionado : undefined,
          categoria: categoriaFiltro !== 'TODAS' ? categoriaFiltro : undefined,
        }),
        api.getResumo(cartaoSelecionado !== 'TODOS' ? cartaoSelecionado : undefined),
      ])

      setCartoes(listaCartoes)
      setGastos(listaGastos)
      setResumo(resumoData)

      if (listaCartoes.length > 0 && !cartaoGastoId) {
        setCartaoGastoId(listaCartoes[0].id)
      }
    } catch (err: any) {
      console.error(err)
      showFeedback('erro', err.message || 'Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      carregarDados()
    }
  }, [user, cartaoSelecionado, categoriaFiltro])

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor)
  }

  const handleCriarGasto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descricaoGasto || !valorGasto || !cartaoGastoId) {
      showFeedback('erro', 'Preencha todos os campos obrigatórios.')
      return
    }

    try {
      await api.createGasto({
        descricao: descricaoGasto,
        valor: parseFloat(valorGasto.replace(',', '.')),
        categoria: categoriaGasto,
        dataCompra: new Date(dataGasto).toISOString(),
        parcelas: parseInt(parcelasGasto, 10),
        parcelaAtual: parseInt(parcelasGasto, 10) > 1 ? parseInt(parcelaAtualGasto, 10) : 1,
        cartaoId: cartaoGastoId,
        recorrente: recorrenteGasto,
      })

      showFeedback('sucesso', 'Gasto registrado com sucesso no cartão!')
      setModalGastoAberto(false)
      setDescricaoGasto('')
      setValorGasto('')
      setParcelasGasto('1')
      setParcelaAtualGasto('1')
      setRecorrenteGasto(false)
      carregarDados()
    } catch (err: any) {
      showFeedback('erro', err.message || 'Erro ao registrar gasto.')
    }
  }

  const handleSalvarCartao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomeCartao || !limiteCartao) {
      showFeedback('erro', 'Informe o nome e o limite do cartão.')
      return
    }

    try {
      const dadosCartao = {
        nome: nomeCartao,
        bandeira: bandeiraCartao,
        cor: corCartao,
        limite: parseFloat(limiteCartao.replace(',', '.')),
        diaFechamento: parseInt(diaFechamento, 10),
        diaVencimento: parseInt(diaVencimento, 10),
      }
      const cartaoSalvo = cartaoEditando
        ? await api.updateCartao(cartaoEditando.id, dadosCartao)
        : await api.createCartao(dadosCartao)
      showFeedback('sucesso', cartaoEditando ? `Cartão "${cartaoSalvo.nome}" atualizado!` : `Cartão "${cartaoSalvo.nome}" adicionado!`)
      setModalCartaoAberto(false)
      setCartaoEditando(null)
      setNomeCartao('')
      setLimiteCartao('')
      if (!cartaoEditando) setCartaoGastoId(cartaoSalvo.id)
      carregarDados()
    } catch (err: any) {
      showFeedback('erro', err.message || 'Erro ao criar cartão.')
    }
  }

  const handleExcluirGasto = async (id: string) => {
    if (!confirm('Deseja realmente excluir este gasto?')) return
    try {
      await api.deleteGasto(id)
      showFeedback('sucesso', 'Gasto removido!')
      carregarDados()
    } catch (err: any) {
      showFeedback('erro', err.message || 'Erro ao excluir gasto.')
    }
  }

  const handleExcluirCartao = async (id: string, nome: string) => {
    if (!confirm(`Deseja excluir o cartão "${nome}" e todos os gastos vinculados a ele?`)) return
    try {
      await api.deleteCartao(id)
      showFeedback('sucesso', 'Cartão removido!')
      if (cartaoSelecionado === id) setCartaoSelecionado('TODOS')
      carregarDados()
    } catch (err: any) {
      showFeedback('erro', err.message || 'Erro ao remover cartão.')
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Carregando sessão segura...</span>
      </div>
    )
  }

  if (!user) {
    return <AuthView />
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-0 sm:h-16 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Controle de Cartões
              </h1>
              <p className="hidden sm:flex text-xs text-slate-400 items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Neon Lakebase Postgres conectado
                {loading && <RefreshCw className="w-3 h-3 text-slate-500 animate-spin ml-1" />}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={abrirNovoCartao}
              aria-label="Novo cartão"
              className="px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shadow-sm whitespace-nowrap [&>span]:hidden sm:[&>span]:inline"
            >
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span>Novo Cartão</span>
            </button>
            <button
              onClick={() => {
                if (cartoes.length === 0) {
                  showFeedback('erro', 'Cadastre ao menos um cartão antes de registrar gastos.')
                  abrirNovoCartao()
                  return
                }
                setModalGastoAberto(true)
              }}
              aria-label="Novo gasto"
              className="px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95 whitespace-nowrap [&>span]:hidden sm:[&>span]:inline"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Gasto</span>
            </button>

            {/* User Profile, Edit & Logout */}
            <div className="flex items-center gap-1 pl-2 sm:pl-3 border-l border-slate-800 ml-1 shrink-0">
              <button
                type="button"
                onClick={() => setModalPerfilAberto(true)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-800/80 transition-all cursor-pointer text-left group"
                title="Editar meu perfil"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 group-hover:border-indigo-400 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 transition-colors">
                  {user.nome.substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-semibold text-slate-200 leading-tight truncate max-w-[120px] group-hover:text-indigo-300 transition-colors">
                    {user.nome}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight truncate max-w-[120px]">
                    {user.email}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setModalPerfilAberto(true)}
                className="hidden sm:block p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Editar perfil"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => logout()}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                title="Sair da conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Feedback alert toast */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top duration-300 ${
              feedbackMsg.tipo === 'sucesso'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
            }`}
          >
            {feedbackMsg.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <p className="text-sm font-medium">{feedbackMsg.texto}</p>
          </div>
        )}

        {/* Financial KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700/60 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Fatura Atual (Gastos)</span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatarMoeda(resumo?.totalGasto || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <span>{resumo?.quantidadeGastos || 0} compras computadas</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700/60 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Limite Total</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatarMoeda(resumo?.limiteTotal || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-2">Soma dos limites cadastrados</div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700/60 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Limite Disponível</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {formatarMoeda(resumo?.limiteDisponivel || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-2">Livre para novas compras</div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700/60 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Uso do Limite</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <PieChart className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">
              {resumo?.percentualUtilizado || 0}%
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (resumo?.percentualUtilizado || 0) > 85
                    ? 'bg-rose-500'
                    : (resumo?.percentualUtilizado || 0) > 60
                    ? 'bg-amber-500'
                    : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, resumo?.percentualUtilizado || 0)}%` }}
              ></div>
            </div>
          </div>
        </section>

        {/* Cards Carousel / Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                Meus Cartões de Crédito
              </h2>
              <p className="text-xs text-slate-400">Acompanhamento dos limites e datas de fatura</p>
            </div>
            {cartoes.length > 0 && (
              <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
                {cartoes.length} {cartoes.length === 1 ? 'cartão' : 'cartões'}
              </span>
            )}
          </div>

          {cartoes.length === 0 ? (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-base font-medium text-slate-200">Nenhum cartão cadastrado ainda</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Adicione seu primeiro cartão (como Nubank, Inter, XP ou C6) para começar a controlar seus gastos.
              </p>
              <button
                onClick={abrirNovoCartao}
                className="mt-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Cartão
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {cartoes.map((cartao) => {
                const totalGasto = cartao.totalGasto || 0
                const limiteDisponivel = cartao.limiteDisponivel || 0
                const percentual = cartao.percentualUtilizado || 0
                const isSelected = cartaoSelecionado === cartao.id

                return (
                  <div
                    key={cartao.id}
                    onClick={() => setCartaoSelecionado(isSelected ? 'TODOS' : cartao.id)}
                    className={`relative rounded-2xl p-6 transition-all cursor-pointer border overflow-hidden group shadow-lg ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 border-indigo-500/50 scale-[1.01]'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/80'
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${cartao.cor || '#1e1b4b'} 0%, #090d16 90%)`,
                    }}
                  >
                    {/* Top Row: Brand & Delete */}
                    <div className="flex items-center justify-between relative z-10 mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-5 rounded bg-amber-400/80 flex items-center justify-center text-[10px] font-bold text-black tracking-wider">
                          CHIP
                        </div>
                        <span className="text-xs font-medium text-slate-300 uppercase tracking-widest">
                          {cartao.bandeira || 'Mastercard'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
                            Filtrado
                          </span>
                        )}
                        {cartao.usuarioId === user?.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              abrirEdicaoCartao(cartao)
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                            title="Editar cartão"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {cartao.usuarioId === user?.id && (
                          <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleExcluirCartao(cartao.id, cartao.nome)
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Excluir cartão"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        )}
                      </div>
                    </div>

                    {/* Card Name */}
                    <div className="relative z-10 mb-4">
                      <h3 className="text-lg font-bold text-white tracking-wide">{cartao.nome}</h3>
                      <p className="text-xs text-slate-300/80">
                        Fecha dia <strong className="text-white">{cartao.diaFechamento}</strong> • Vence dia <strong className="text-white">{cartao.diaVencimento}</strong>
                      </p>
                    </div>

                    {/* Spending & Limit Progress */}
                    <div className="relative z-10 space-y-2 bg-black/40 backdrop-blur-md p-3.5 rounded-xl border border-white/5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Gasto da fatura:</span>
                        <span className="font-bold text-white">{formatarMoeda(totalGasto)}</span>
                      </div>

                      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            percentual > 85 ? 'bg-rose-500' : percentual > 60 ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${percentual}%` }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                        <span>Disponível: <strong className="text-emerald-400">{formatarMoeda(limiteDisponivel)}</strong></span>
                        <span>Limite: {formatarMoeda(cartao.limite)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Expenses List & Category Breakdown Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Expenses List (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-400" />
                  Extrato de Gastos
                </h2>
                <p className="text-xs text-slate-400">
                  {cartaoSelecionado !== 'TODOS'
                    ? `Filtrado pelo cartão selecionado`
                    : 'Listando compras de todos os cartões'}
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="TODAS">Todas categorias</option>
                  {CATEGORIAS.map((c) => (
                    <option key={c.nome} value={c.nome}>
                      {c.nome}
                    </option>
                  ))}
                </select>

                {cartaoSelecionado !== 'TODOS' && (
                  <button
                    onClick={() => setCartaoSelecionado('TODOS')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1.5 rounded-lg border border-indigo-500/20"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
            </div>

            {gastos.length === 0 ? (
              <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-medium text-slate-300">Nenhum gasto encontrado</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Você ainda não registrou nenhuma compra ou o filtro selecionado não retornou resultados.
                </p>
                {cartoes.length > 0 && (
                  <button
                    onClick={() => setModalGastoAberto(true)}
                    className="mt-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Registrar Compra
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {gastos.map((gasto) => {
                  const catConfig = CATEGORIAS.find((c) => c.nome === gasto.categoria) || CATEGORIAS[7]
                  const dataFormatada = new Date(gasto.dataCompra).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                  })

                  return (
                    <div
                      key={gasto.id}
                      className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition-all hover:bg-slate-900"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                          style={{
                            backgroundColor: `${gasto.cartao?.cor || '#6366f1'}15`,
                            borderColor: `${gasto.cartao?.cor || '#6366f1'}30`,
                            color: gasto.cartao?.cor || '#818cf8',
                          }}
                        >
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-white truncate">{gasto.descricao}</h4>
                            {gasto.parcelas > 1 && (
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 shrink-0">
                                {String(gasto.parcelaAtual).padStart(2, '0')}/{String(gasto.parcelas).padStart(2, '0')}
                              </span>
                            )}
                            {gasto.recorrente && (
                              <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20 shrink-0">
                                Recorrente
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 mt-0.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] border font-medium ${catConfig.cor}`}>
                              {gasto.categoria}
                            </span>
                            <span>•</span>
                            <span>{gasto.cartao?.nome || 'Cartão'}</span>
                            <span>•</span>
                            <span>{dataFormatada}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 w-full sm:w-auto pl-[52px] sm:pl-0">
                        <div className="text-right">
                          <div className="text-base font-bold text-white">{formatarMoeda(gasto.valor)}</div>
                          {gasto.parcelas > 1 && (
                            <div className="text-[10px] text-slate-400">
                              {gasto.parcelas}x de {formatarMoeda(gasto.valor / gasto.parcelas)}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleExcluirGasto(gasto.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Remover transação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Category Breakdown (1 Col) */}
          <div className="space-y-4">
            <div className="pb-2 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-400" />
                Gastos por Categoria
              </h2>
              <p className="text-xs text-slate-400">Distribuição percentual da fatura</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              {!resumo?.porCategoria || resumo.porCategoria.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  Nenhuma despesa para exibir na análise.
                </div>
              ) : (
                resumo.porCategoria.map((item) => {
                  const catConfig = CATEGORIAS.find((c) => c.nome === item.categoria) || CATEGORIAS[7]
                  return (
                    <div key={item.categoria} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-200 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${catConfig.cor.split(' ')[0]}`}></span>
                          {item.categoria}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{item.percentual}%</span>
                          <span className="font-semibold text-white">{formatarMoeda(item.total)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${Math.min(100, item.percentual)}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Modal Novo Gasto */}
      {modalGastoAberto && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="my-0 sm:my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                Registrar Novo Gasto
              </h3>
              <button
                onClick={() => setModalGastoAberto(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCriarGasto} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Descrição da Compra *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Supermercado, Uber, Farmácia, Restaurante"
                  value={descricaoGasto}
                  onChange={(e) => setDescricaoGasto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Valor Total (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={valorGasto}
                    onChange={(e) => setValorGasto(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Cartão *</label>
                  <select
                    value={cartaoGastoId}
                    onChange={(e) => setCartaoGastoId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {cartoes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Categoria</label>
                  <select
                    value={categoriaGasto}
                    onChange={(e) => setCategoriaGasto(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c.nome} value={c.nome}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Data da Compra</label>
                  <input
                    type="date"
                    value={dataGasto}
                    onChange={(e) => setDataGasto(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Total de parcelas</label>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    required
                    value={parcelasGasto}
                    onChange={(e) => {
                      const total = Math.max(1, Number(e.target.value) || 1)
                      setParcelasGasto(String(total))
                      setParcelaAtualGasto((atual) => String(Math.min(Number(atual) || 1, total)))
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                {Number(parcelasGasto) > 1 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Parcela atual (ex.: 8 de 10)</label>
                    <input
                      type="number"
                      min="1"
                      max={parcelasGasto}
                      required
                      value={parcelaAtualGasto}
                      onChange={(e) => setParcelaAtualGasto(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="recorrente"
                    checked={recorrenteGasto}
                    onChange={(e) => setRecorrenteGasto(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="recorrente" className="text-xs text-slate-300 cursor-pointer">
                    Assinatura mensal
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalGastoAberto(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all"
                >
                  Salvar Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Cartão */}
      {modalCartaoAberto && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="my-0 sm:my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                {cartaoEditando ? 'Editar Cartão de Crédito' : 'Cadastrar Cartão de Crédito'}
              </h3>
              <button
                onClick={() => setModalCartaoAberto(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarCartao} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nome do Cartão *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Nubank Ultravioleta, Inter Black, XP"
                  value={nomeCartao}
                  onChange={(e) => setNomeCartao(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Limite Total (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 5000"
                    value={limiteCartao}
                    onChange={(e) => setLimiteCartao(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Bandeira</label>
                  <select
                    value={bandeiraCartao}
                    onChange={(e) => setBandeiraCartao(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Mastercard">Mastercard</option>
                    <option value="Visa">Visa</option>
                    <option value="Elo">Elo</option>
                    <option value="Amex">American Express</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Dia Fechamento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={diaFechamento}
                    onChange={(e) => setDiaFechamento(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Dia Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Cor do Cartão</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {CORES_CARTAO.map((c) => (
                    <button
                      key={c.valor}
                      type="button"
                      onClick={() => setCorCartao(c.valor)}
                      className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                        corCartao === c.valor ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.valor }}
                      title={c.nome}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalCartaoAberto(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all"
                >
                  {cartaoEditando ? 'Salvar Alterações' : 'Adicionar Cartão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Perfil */}
      <EditProfileModal
        isOpen={modalPerfilAberto}
        onClose={() => setModalPerfilAberto(false)}
        showFeedback={showFeedback}
      />
    </div>
  )
}
