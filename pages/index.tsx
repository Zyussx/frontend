'use client'

import { useEffect, useState } from 'react'

const API_URL = 'https://backend3-m916.onrender.com'

export default function Home() {
  const [view, setView] = useState('dashboard')
  const [empresas, setEmpresas] = useState([])
  const [empresaAtual, setEmpresaAtual] = useState(null)
  const [empresaNome, setEmpresaNome] = useState('')
  const [empresaCnpj, setEmpresaCnpj] = useState('')
  const [buscaEmpresa, setBuscaEmpresa] = useState('')
  const [plano, setPlano] = useState([])
  const [balancete, setBalancete] = useState([])
  const [extrato, setExtrato] = useState([])
  const [conciliacao, setConciliacao] = useState([])
  const [memoria, setMemoria] = useState([])
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    carregarEmpresas()
  }, [])

  function avisar(texto) {
    setMensagem(texto)
    setTimeout(() => setMensagem(''), 3500)
  }

  async function carregarEmpresas() {
    try {
      const res = await fetch(`${API_URL}/empresas`)
      const data = await res.json()
      setEmpresas(Array.isArray(data) ? data : [])
    } catch {
      avisar('Erro ao conectar com o backend.')
    }
  }

  async function carregarMemoria() {
    try {
      const res = await fetch(`${API_URL}/memoria`)
      const data = await res.json()
      setMemoria(Array.isArray(data) ? data : [])
    } catch {
      setMemoria([])
    }
  }

  async function cadastrarEmpresa() {
    if (!empresaNome.trim()) {
      avisar('Informe o nome da empresa.')
      return
    }

    try {
      const res = await fetch(`${API_URL}/empresa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: empresaNome, cnpj: empresaCnpj })
      })

      const data = await res.json()

      if (data.erro) {
        avisar(data.erro)
        return
      }

      setEmpresaAtual(data.empresa)
      setEmpresas((old) => [...old, data.empresa])
      setEmpresaNome('')
      setEmpresaCnpj('')
      avisar('Empresa cadastrada e selecionada.')
    } catch {
      avisar('Erro ao cadastrar empresa.')
    }
  }

  async function selecionarEmpresa(id) {
    try {
      const res = await fetch(`${API_URL}/empresa/selecionar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      const data = await res.json()

      if (data.erro) {
        avisar(data.erro)
        return
      }

      const emp = data.empresa
      setEmpresaAtual(emp)
      setPlano(emp.plano_contas || [])
      setBalancete(emp.balancetes || [])
      setExtrato(emp.extratos || [])
      setConciliacao([])
      carregarMemoria()
      avisar('Empresa selecionada.')
    } catch {
      avisar('Erro ao selecionar empresa.')
    }
  }


  async function apagarEmpresa(id: number) {
    const confirmar = window.confirm(
      'Tem certeza que deseja apagar esta empresa? Essa ação não poderá ser desfeita.'
    )

    if (!confirmar) return

    try {
      const res = await fetch(`${API_URL}/empresa/${id}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (data.sucesso) {
        setEmpresas((old) => old.filter((emp) => emp.id !== id))

        if (empresaAtual?.id === id) {
          setEmpresaAtual(null)
          setPlano([])
          setBalancete([])
          setExtrato([])
          setConciliacao([])
          setMemoria([])
        }

        avisar('Empresa apagada.')
      } else {
        avisar(data.erro || 'Erro ao apagar empresa.')
      }
    } catch {
      avisar('Erro ao apagar empresa.')
    }
  }

  async function enviarArquivo(endpoint, file) {
    if (!empresaAtual && endpoint !== 'upload-balancete') {
      avisar('Selecione ou cadastre uma empresa primeiro.')
      setView('empresas')
      return
    }

    const formData = new FormData()
    formData.append('arquivo', file)

    try {
      const res = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (data.erro) {
        avisar(data.erro)
        return
      }

      if (data.empresa_atual) {
        setEmpresaAtual(data.empresa_atual)

        setEmpresas((old) => {
          const existe = old.some((e) => e.id === data.empresa_atual.id)
          if (existe) {
            return old.map((e) => e.id === data.empresa_atual.id ? data.empresa_atual : e)
          }
          return [...old, data.empresa_atual]
        })

        setPlano(data.empresa_atual.plano_contas || [])
        setBalancete(data.empresa_atual.balancetes || [])
        setExtrato(data.empresa_atual.extratos || [])
      }

      if (endpoint === 'upload-plano') {
        setPlano(data.contas || [])
        avisar('Plano de contas importado.')
      }

      if (endpoint === 'upload-balancete') {
        setBalancete(data.balancete || [])
        avisar('Balancete importado e empresa identificada.')
      }

      if (endpoint === 'upload-extrato') {
        setExtrato(data.extrato || [])
        avisar('Extrato importado.')
      }

      carregarEmpresas()
    } catch {
      avisar('Erro ao enviar arquivo.')
    }
  }

  async function executarConciliacao() {
    if (!empresaAtual) {
      avisar('Selecione uma empresa primeiro.')
      setView('empresas')
      return
    }

    if (!plano.length) {
      avisar('Importe o plano de contas primeiro.')
      setView('plano')
      return
    }

    if (!extrato.length) {
      avisar('Importe o extrato primeiro.')
      setView('extrato')
      return
    }

    try {
      const res = await fetch(`${API_URL}/conciliar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contas: plano, movimentos: extrato, regras: [] })
      })

      const data = await res.json()
      setConciliacao(data.lancamentos || [])
      setView('conciliacao')
      carregarMemoria()
      avisar('Conciliação executada.')
    } catch {
      avisar('Erro ao executar conciliação.')
    }
  }

  function gerarCSV() {
    const cabecalho = ['empresa', 'data', 'historico', 'debito', 'credito', 'valor', 'documento', 'status', 'confianca', 'observacao']

    const linhas = conciliacao.map((item) => [
      empresaAtual?.nome || '',
      item.data || '',
      item.historico || '',
      item.debito || '',
      item.credito || '',
      item.valor || '',
      item.documento || '',
      item.status || '',
      item.confianca || '',
      item.observacao || ''
    ])

    return [cabecalho, ...linhas]
      .map((linha) => linha.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
  }

  function baixarCSV() {
    if (!conciliacao.length) {
      avisar('Não há conciliação para exportar.')
      return
    }

    const blob = new Blob([gerarCSV()], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `andr_${empresaAtual?.nome || 'empresa'}_conciliacao.csv`
    link.click()
  }

  const empresasFiltradas = empresas.filter((emp) =>
    `${emp.nome || ''} ${emp.cnpj || ''}`.toLowerCase().includes(buscaEmpresa.toLowerCase())
  )

  const conciliados = conciliacao.filter((x) => x.status === 'Conciliado').length
  const revisao = conciliacao.filter((x) => x.status !== 'Conciliado').length
  const taxa = conciliacao.length ? Math.round((conciliados / conciliacao.length) * 100) : 0

  const menus = [
    ['dashboard', 'Dashboard'],
    ['empresas', 'Empresas'],
    ['plano', 'Plano/Balancete'],
    ['extrato', 'Extrato'],
    ['conciliacao', 'Conciliação'],
    ['memoria', 'Memória IA'],
    ['exportar', 'Exportar'],
    ['config', 'Configurações']
  ]

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="flex">
        <aside className="fixed left-0 top-0 flex h-screen w-[294px] flex-col border-r border-cyan-400/10 bg-[#030817] px-6 py-7">
          <div className="text-[30px] font-black tracking-tight">
            Orquestra<span className="text-cyan-400">Contábil</span>
          </div>

          <p className="mt-5 text-sm leading-7 text-slate-400">
            Empresa → plano de contas → extrato → conciliação automática.
          </p>

          <div className="mt-8 rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-5">
            <div className="text-xs font-black uppercase tracking-wider text-cyan-300">Empresa atual</div>
            <div className="mt-3 text-sm font-black">{empresaAtual?.nome || 'Nenhuma selecionada'}</div>
            <div className="mt-2 text-xs text-slate-400">{empresaAtual?.cnpj || ''}</div>
          </div>

          <div className="mt-8 space-y-3">
            {menus.map(([id, nome]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`w-full rounded-[18px] border px-5 py-4 text-left font-black transition ${
                  view === id
                    ? 'border-cyan-400/40 bg-gradient-to-r from-cyan-400/20 to-cyan-400/5 text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,.12)]'
                    : 'border-white/10 bg-[#07101f] text-slate-200 hover:border-cyan-400/30 hover:bg-[#0a1728]'
                }`}
              >
                {nome}
              </button>
            ))}
          </div>

          <div className="mt-auto rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-5">
            <div className="text-xs font-black uppercase tracking-wider text-cyan-300">Fluxo operacional</div>
            <div className="mt-5 space-y-4 text-sm">
              <FlowItem label="Empresa" active={!!empresaAtual} />
              <FlowItem label="Plano de Contas" active={plano.length > 0} />
              <FlowItem label="Extrato" active={extrato.length > 0} />
              <FlowItem label="IA Inteligente" active={conciliacao.length > 0} />
              <FlowItem label="Revisão" active={revisao > 0} />
              <FlowItem label="Exportação" active={false} />
            </div>
          </div>
        </aside>

        <section className="ml-[294px] flex-1 p-8">
          <Hero executar={executarConciliacao} />

          <div className="mt-8 grid gap-5 xl:grid-cols-5">
            <Metric title="Empresas" value={empresas.length} subtitle="cadastradas" />
            <Metric title="Planos de Contas" value={plano.length} subtitle="contas importadas" />
            <Metric title="Extratos" value={extrato.length} subtitle="movimentos" />
            <Metric title="Conciliações" value={conciliacao.length} subtitle="lançamentos" />
            <Metric title="Taxa de Acerto" value={`${taxa}%`} subtitle="IA por empresa" />
          </div>

          {view === 'dashboard' && (
            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              <EmpresasPanel
                empresasFiltradas={empresasFiltradas}
                empresas={empresas}
                empresaAtual={empresaAtual}
                empresaNome={empresaNome}
                empresaCnpj={empresaCnpj}
                buscaEmpresa={buscaEmpresa}
                setEmpresaNome={setEmpresaNome}
                setEmpresaCnpj={setEmpresaCnpj}
                setBuscaEmpresa={setBuscaEmpresa}
                cadastrarEmpresa={cadastrarEmpresa}
                selecionarEmpresa={selecionarEmpresa}
                apagarEmpresa={apagarEmpresa}
              />

              <ResumoEmpresa
                empresaAtual={empresaAtual}
                plano={plano}
                balancete={balancete}
                extrato={extrato}
                conciliacao={conciliacao}
              />

              <FluxoOperacional
                empresaAtual={empresaAtual}
                plano={plano}
                extrato={extrato}
                conciliacao={conciliacao}
              />
            </div>
          )}

          {view === 'empresas' && (
            <div className="mt-8">
              <EmpresasPanel
                empresasFiltradas={empresasFiltradas}
                empresas={empresas}
                empresaAtual={empresaAtual}
                empresaNome={empresaNome}
                empresaCnpj={empresaCnpj}
                buscaEmpresa={buscaEmpresa}
                setEmpresaNome={setEmpresaNome}
                setEmpresaCnpj={setEmpresaCnpj}
                setBuscaEmpresa={setBuscaEmpresa}
                cadastrarEmpresa={cadastrarEmpresa}
                selecionarEmpresa={selecionarEmpresa}
                apagarEmpresa={apagarEmpresa}
              />
            </div>
          )}

          {view === 'plano' && (
            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              <UploadCard
                title="Plano de Contas"
                subtitle="Estrutura fixa individual da empresa."
                count={plano.length}
                countLabel="contas carregadas"
                onFile={(file) => enviarArquivo('upload-plano', file)}
              />
              <UploadCard
                title="Balancete"
                subtitle="Saldos e movimentações do período."
                count={balancete.length}
                countLabel="linhas carregadas"
                onFile={(file) => enviarArquivo('upload-balancete', file)}
              />
              <DataPreview title="Prévia do Plano de Contas" data={plano} />
              <DataPreview title="Prévia do Balancete" data={balancete} />
            </div>
          )}

          {view === 'extrato' && (
            <div className="mt-8">
              <UploadCard
                title="Extrato Bancário"
                subtitle="Importe OFX, PDF ou CSV bancário."
                count={extrato.length}
                countLabel="movimentos carregados"
                onFile={(file) => enviarArquivo('upload-extrato', file)}
              />
              <DataPreview title="Movimentos Importados" data={extrato} />
            </div>
          )}

          {view === 'conciliacao' && (
            <ConciliacaoPanel conciliacao={conciliacao} executar={executarConciliacao} />
          )}

          {view === 'memoria' && (
            <MemoriaPanel memoria={memoria} />
          )}

          {view === 'exportar' && (
            <div className="mt-8 rounded-[28px] border border-cyan-400/10 bg-[#061127] p-7">
              <div className="text-2xl font-black">Exportação</div>
              <p className="mt-2 text-slate-400">Baixe os lançamentos conciliados em CSV.</p>
              <button onClick={baixarCSV} className="mt-7 rounded-2xl bg-cyan-400 px-8 py-4 font-black text-slate-950">
                Baixar CSV
              </button>
              <pre className="mt-7 max-h-[420px] overflow-auto rounded-2xl border border-white/10 bg-[#020b1b] p-5 text-xs text-slate-300">
                {conciliacao.length ? gerarCSV() : 'Nenhum lançamento conciliado ainda.'}
              </pre>
            </div>
          )}

          {view === 'config' && (
            <div className="mt-8 rounded-[28px] border border-cyan-400/10 bg-[#061127] p-7">
              <div className="text-2xl font-black">Configurações</div>
              <p className="mt-2 text-slate-400">API atual: {API_URL}</p>
            </div>
          )}
        </section>
      </div>

      {mensagem && (
        <div className="fixed bottom-6 right-6 rounded-2xl border border-cyan-400/20 bg-[#020b1b] px-6 py-4 text-sm font-black text-cyan-200 shadow-[0_0_35px_rgba(34,211,238,.16)]">
          {mensagem}
        </div>
      )}
    </main>
  )
}

function Hero({ executar }) {
  return (
    <div className="overflow-hidden rounded-[38px] border border-cyan-400/10 bg-gradient-to-br from-[#07142b] via-[#06152b] to-[#092f3e] p-10 shadow-[0_0_80px_rgba(34,211,238,.08)]">
      <div className="grid gap-10 xl:grid-cols-[1.15fr_.85fr]">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-5 py-2 text-xs font-black uppercase tracking-widest text-cyan-300">
            ANDR / IA Contábil por Empresa
          </div>
          <h1 className="mt-8 max-w-4xl text-[52px] font-black leading-tight tracking-tight">
            Conciliação <span className="text-cyan-400">inteligente</span> com plano de contas individual
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Cadastre a empresa, importe o plano de contas dela, envie o extrato e concilie usando somente a estrutura contábil daquela empresa.
          </p>
          <button onClick={executar} className="mt-8 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-8 py-4 font-black text-slate-950 shadow-[0_0_40px_rgba(34,211,238,.28)]">
            Executar Conciliação
          </button>
        </div>

        <div className="relative hidden items-center justify-center xl:flex">
          <div className="absolute h-[360px] w-[360px] rounded-full border border-cyan-400/10" />
          <div className="absolute h-[260px] w-[260px] rounded-full border border-cyan-400/20" />
          <div className="rounded-[42px] border border-cyan-400/20 bg-[#07142b] p-12 shadow-[0_0_80px_rgba(34,211,238,.18)]">
            <div className="h-24 w-24 rounded-[28px] border border-cyan-300/30 bg-cyan-400/10" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ title, value, subtitle }) {
  return (
    <div className="rounded-[28px] border border-cyan-400/10 bg-[#071120] p-6 shadow-[0_0_40px_rgba(34,211,238,.04)]">
      <div className="text-sm font-black text-cyan-300">{title}</div>
      <div className="mt-4 text-4xl font-black">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{subtitle}</div>
    </div>
  )
}

function EmpresasPanel(props) {
  return (
    <div className="rounded-[30px] border border-cyan-400/10 bg-[#061127] p-7 shadow-[0_0_50px_rgba(34,211,238,.04)]">
      <div className="text-2xl font-black">Cadastro e Seleção de Empresas</div>
      <p className="mt-2 text-slate-400">Gerencie empresas e acesse rapidamente seus dados.</p>

      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        <div className="rounded-[26px] border border-white/10 bg-[#020b1b] p-6">
          <div className="text-xl font-black">Nova Empresa</div>
          <input className="mt-5 w-full rounded-2xl border border-white/10 bg-[#091528] p-4 outline-none" placeholder="Nome da empresa" value={props.empresaNome} onChange={(e) => props.setEmpresaNome(e.target.value)} />
          <input className="mt-4 w-full rounded-2xl border border-white/10 bg-[#091528] p-4 outline-none" placeholder="CNPJ" value={props.empresaCnpj} onChange={(e) => props.setEmpresaCnpj(e.target.value)} />
          <button onClick={props.cadastrarEmpresa} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-4 font-black text-slate-950">
            Cadastrar Empresa
          </button>
        </div>

        <div className="rounded-[26px] border border-white/10 bg-[#020b1b] p-6">
          <div className="flex items-center justify-between">
            <div className="text-xl font-black">Empresas Cadastradas</div>
            <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">{props.empresas.length}</span>
          </div>
          <input className="mt-5 w-full rounded-2xl border border-white/10 bg-[#091528] p-4 outline-none" placeholder="Pesquisar empresa..." value={props.buscaEmpresa} onChange={(e) => props.setBuscaEmpresa(e.target.value)} />
          <div className="mt-5 max-h-[330px] space-y-3 overflow-auto pr-2">
            {!props.empresas.length && <div className="text-slate-500">Nenhuma empresa cadastrada.</div>}
            {props.empresasFiltradas.map((emp) => (
              <button key={emp.id} onClick={() => props.selecionarEmpresa(emp.id)} className={`w-full rounded-2xl border p-4 text-left transition ${props.empresaAtual?.id === emp.id ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-white/10 bg-[#091528]'}`}>
                <div className="font-black text-cyan-100">{emp.nome}</div>
                <div className="mt-1 text-sm text-slate-400">{emp.cnpj || 'Sem CNPJ'}</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    props.apagarEmpresa(emp.id)
                  }}
                  className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-xs font-black text-red-300 hover:bg-red-400/20"
                >
                  Apagar empresa
                </button>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ResumoEmpresa({ empresaAtual, plano, balancete, extrato, conciliacao }) {
  const itens = [
    ['Plano de Contas', plano.length > 0],
    ['Balancete', balancete.length > 0],
    ['Extrato', extrato.length > 0],
    ['IA Inteligente', conciliacao.length > 0],
    ['Revisão', conciliacao.some((x) => x.status !== 'Conciliado')],
    ['Exportação', false]
  ]

  const progresso = Math.round((itens.filter((x) => x[1]).length / itens.length) * 100)

  return (
    <div className="rounded-[30px] border border-cyan-400/10 bg-[#061127] p-7">
      <div className="text-2xl font-black">Resumo da Empresa Atual</div>
      <div className="mt-2 text-slate-400">{empresaAtual?.nome || 'Nenhuma empresa selecionada'}</div>

      <div className="mt-8 grid gap-7 xl:grid-cols-[220px_1fr]">
        <div className="flex h-[190px] w-[190px] items-center justify-center rounded-full border-[18px] border-cyan-400/80 bg-cyan-400/5">
          <div className="text-center">
            <div className="text-4xl font-black">{progresso}%</div>
            <div className="text-sm text-slate-400">concluído</div>
          </div>
        </div>

        <div className="space-y-3">
          {itens.map(([label, ok]) => (
            <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#020b1b] px-4 py-3">
              <span>{label}</span>
              <span className={ok ? 'text-emerald-300' : 'text-yellow-300'}>{ok ? 'Importado' : 'Pendente'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FlowItem({ label, active }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-3 w-3 rounded-full ${active ? 'bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,.8)]' : 'bg-slate-600'}`} />
      <span className={active ? 'text-cyan-200' : 'text-slate-400'}>{label}</span>
    </div>
  )
}

function FluxoOperacional({ empresaAtual, plano, extrato, conciliacao }) {
  const steps = [
    ['Empresa', !!empresaAtual],
    ['Plano de Contas', plano.length > 0],
    ['Extrato', extrato.length > 0],
    ['IA Inteligente', conciliacao.length > 0],
    ['Revisão', conciliacao.some((x) => x.status !== 'Conciliado')],
    ['Exportação', false]
  ]

  return (
    <div className="xl:col-span-2 rounded-[30px] border border-cyan-400/10 bg-[#061127] p-7">
      <div className="text-2xl font-black">Fluxo Operacional</div>
      <p className="mt-2 text-slate-400">Acompanhe o processo contábil com IA.</p>

      <div className="mt-7 grid gap-4 xl:grid-cols-6">
        {steps.map(([label, ok]) => (
          <div key={label} className={`rounded-[24px] border p-5 text-center ${ok ? 'border-cyan-400/30 bg-cyan-400/10' : 'border-white/10 bg-[#020b1b]'}`}>
            <div className="font-black">{label}</div>
            <div className={`mt-3 text-sm ${ok ? 'text-cyan-300' : 'text-slate-500'}`}>{ok ? 'Concluído' : 'Pendente'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function UploadCard({ title, subtitle, count, countLabel, onFile }) {
  return (
    <div className="rounded-[30px] border border-cyan-400/10 bg-[#061127] p-7">
      <div className="text-2xl font-black">{title}</div>
      <p className="mt-2 text-slate-400">{subtitle}</p>
      <label className="mt-7 block cursor-pointer rounded-[24px] border border-dashed border-cyan-400/30 bg-[#020b1b] p-8 text-center hover:bg-cyan-400/5">
        <div className="font-black text-cyan-300">Selecionar arquivo</div>
        <div className="mt-2 text-sm text-slate-500">CSV, PDF, OFX ou TXT</div>
        <input type="file" accept=".csv,.xlsx,.xls,.pdf,.ofx,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      <div className="mt-7 rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-5">
        <div className="text-sm text-slate-400">{countLabel}</div>
        <div className="mt-2 text-5xl font-black text-cyan-300">{count}</div>
      </div>
    </div>
  )
}

function DataPreview({ title, data }) {
  return (
    <div className="rounded-[30px] border border-cyan-400/10 bg-[#061127] p-7">
      <div className="text-2xl font-black">{title}</div>
      <div className="mt-5 max-h-[360px] overflow-auto rounded-2xl border border-white/10 bg-[#020b1b]">
        <table className="w-full min-w-[800px] text-left text-sm">
          <tbody>
            {!data.length && <tr><td className="p-6 text-center text-slate-500">Nenhum dado carregado.</td></tr>}
            {data.slice(0, 20).map((row, i) => (
              <tr key={i} className="border-b border-white/5">
                {Object.values(row).slice(0, 6).map((v, j) => (
                  <td key={j} className="p-3 text-slate-300">{String(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ConciliacaoPanel({ conciliacao, executar }) {
  return (
    <div className="mt-8 rounded-[30px] border border-cyan-400/10 bg-[#061127] p-7">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-3xl font-black">Conciliação Inteligente</div>
          <p className="mt-2 text-slate-400">IA utilizando o plano da empresa atual.</p>
        </div>
        <button onClick={executar} className="rounded-2xl bg-cyan-400 px-7 py-4 font-black text-slate-950">Executar IA</button>
      </div>

      <div className="mt-7 space-y-4">
        {!conciliacao.length && <div className="rounded-2xl border border-white/10 bg-[#020b1b] p-6 text-slate-500">Nenhuma conciliação executada.</div>}
        {conciliacao.map((item, i) => (
          <div key={i} className="rounded-[24px] border border-white/10 bg-[#020b1b] p-5">
            <div className="flex items-start justify-between gap-5">
              <div>
                <div className="text-xl font-black">{item.historico}</div>
                <div className="mt-3 grid gap-2 text-sm text-slate-400">
                  <div>Débito: {item.debito}</div>
                  <div>Crédito: {item.credito}</div>
                  <div>Observação: {item.observacao}</div>
                </div>
              </div>
              <div className="rounded-2xl bg-cyan-400/10 px-5 py-3 text-center">
                <div className="text-sm text-slate-400">Confiança</div>
                <div className="text-2xl font-black text-cyan-300">{item.confianca}%</div>
                <div className="mt-1 text-xs text-slate-400">{item.status}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MemoriaPanel({ memoria }) {
  return (
    <div className="mt-8 rounded-[30px] border border-cyan-400/10 bg-[#061127] p-7">
      <div className="text-3xl font-black">Memória IA</div>
      <p className="mt-2 text-slate-400">Aprendizado automático por empresa.</p>

      <div className="mt-7 space-y-4">
        {!memoria.length && <div className="rounded-2xl border border-white/10 bg-[#020b1b] p-6 text-slate-500">Nenhuma memória criada ainda.</div>}
        {memoria.map((item, i) => (
          <div key={i} className="rounded-[24px] border border-white/10 bg-[#020b1b] p-5">
            <div className="font-black">{item.historico}</div>
            <div className="mt-3 grid gap-4 xl:grid-cols-3">
              <Info label="Débito" value={item.debito} />
              <Info label="Crédito" value={item.credito} />
              <Info label="Confiança" value={`${item.confianca || 0}%`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 font-black text-cyan-300">{value}</div>
    </div>
  )
}
