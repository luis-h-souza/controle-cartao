import React, { useState, useEffect } from 'react'
import { User, Mail, Lock, X, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
  showFeedback: (tipo: 'sucesso' | 'erro', texto: string) => void
}

export function EditProfileModal({ isOpen, onClose, showFeedback }: EditProfileModalProps) {
  const { user, updateProfile } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setNome(user.nome)
      setEmail(user.email)
    }
    setSenhaAtual('')
    setNovaSenha('')
    setErro(null)
  }, [user, isOpen])

  if (!isOpen || !user) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    if (!nome.trim() || !email.trim()) {
      setErro('Nome e e-mail são obrigatórios.')
      return
    }

    if (novaSenha && novaSenha.length < 6) {
      setErro('A nova senha deve ter no mínimo 6 caracteres.')
      return
    }

    if (novaSenha && !senhaAtual) {
      setErro('Informe sua senha atual para alterar a senha.')
      return
    }

    try {
      setLoading(true)
      await updateProfile({
        nome: nome.trim(),
        email: email.trim(),
        senhaAtual: senhaAtual || undefined,
        novaSenha: novaSenha || undefined,
      })

      showFeedback('sucesso', 'Perfil atualizado com sucesso!')
      onClose()
    } catch (err: any) {
      setErro(err.message || 'Erro ao atualizar perfil.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="my-0 sm:my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Editar Perfil</h3>
              <p className="text-xs text-slate-400">Atualize seus dados cadastrais</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {erro && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-200 text-xs">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Nome Completo *</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">E-mail *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Alterar Senha (opcional)</span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">Senha Atual</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Necessária apenas se for trocar"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-9 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">Nova Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
