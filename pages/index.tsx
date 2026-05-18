import { useEffect, useState } from 'react'

const API_URL = 'https://backend3-m9l6.onrender.com'

export default function Home() {
  const [view, setView] = useState('empresas')
  const [empresas, setEmpresas] = useState<any[]>([])
  const [empresaAtual, setEmpresaAtual] = useState<any>(null)
  const [empresaNome, setEmpresaNome] = useState('')
  const [empresaCnpj, setEmpresaCnpj] = useState('')
  const [contas, setContas] = useState<any[]>([])
  const [movimentos, setMovimentos] = useState<any[]>([])
  const [regras, setRegras] = useState<any[]>([])
  const [mensagem, setMensagem] = useState('')

  useEffect(() => { carregarEmpresas() }, [])

  function aviso(msg: string) {
    setMensagem(msg)
    setTimeout(() => setMensagem(''), 3000)
  }

  function dinheiro(v: any) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  async function carregarEmpresas() {
    try {
      const resp = await fetch(`${API_URL}/empresas`)
      const data = await resp.json()
      setEmpresas(Array.isArray(data) ? data : [])
    } catch { aviso('Erro ao carregar empresas.') }
  }

  async function criarEmpresa() {
    if (!empresaNome.trim()) { aviso('Informe o nome da empresa.'); return }
    try {
      const resp = await fetch(`${API_URL}/empresa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: empresaNome, cnpj: empresaCnpj })
      })
      const data = await resp.json()
      if (data.erro) { aviso(data.erro); return }
      setEmpresaAtual(data.empresa)
      setEmpresaNome('')
      setEmpresaCnpj('')
      await carregarEmpresas()
      aviso('Empresa cadastrada e selecionada.')
    } catch { aviso('Erro ao cadastrar empresa.') }
  }

  async function selecionarEmpresa(id: number) {
    try {
      const resp = await fetch(`${API_URL}/empresa/selecionar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      const data = await resp.json()
      if (data.erro) { aviso(data.erro); return }
      setEmpresaAtual(data.empresa)
      setContas(data.empresa?.plano_contas || [])
      aviso(`Empresa selecionada: ${data.empresa.nome}`)
    } catch { aviso('Erro ao selecionar empresa.') }
  }

  function normalizarConta(l: any) {
    return { codigo: l.codigo || '', classificacao: l.classificacao || '', nome: l.nome || l.conta || l.historico || l.linha || '', tipo: l.tipo || 'Analítica', grupo: l.grupo || '', debito: l.debito || '', credito: l.credito || '' }
  }

  function normalizarMovimento(l: any) {
    return { data: l.data || '', historico: l.historico || l.descricao || l.lancamento || l.linha || '', valor: Number(l.valor || 0), documento: l.documento || l.doc || '', status: l.status || 'Aguardando', confianca: l.confianca || 0, debito: l.debito || '', credito: l.credito || '', observacao: l.observacao || '', grupo_debito: l.grupo_debito || '', grupo_credito: l.grupo_credito || '', sinal_debito: l.sinal_debito || '', sinal_credito: l.sinal_credito || '' }
  }

  async function enviarArquivo(file: File, tipo: 'balancete' | 'extrato') {
    if (!empresaAtual) { aviso('Cadastre ou selecione uma empresa primeiro.'); setView('empresas'); return }
    const formData = new FormData()
    formData.append('arquivo', file)
    try {
      const resp = await fetch(`${API_URL}/upload-extrato`, { method: 'POST', body: formData })
      const data = await resp.json()
      if (data.erro) { aviso(data.erro); return }
      if (tipo === 'balancete') {
        const lista = (data.linhas || []).map(normalizarConta).filter((c: any) => c.nome)
        setContas(lista)
        setView('balancete')
        await carregarEmpresas()
        aviso(`${lista.length} contas importadas para ${empresaAtual.nome}.`)
      } else {
        const lista = (data.linhas || []).map(normalizarMovimento).filter((m: any) => m.historico || m.valor)
        setMovimentos(lista)
        setView('extrato')
        aviso(`${lista.length} movimentos importados.`)
      }
    } catch { aviso('Erro ao conectar com o backend.') }
  }

  async function conciliar() {
    if (!empresaAtual) { aviso('Selecione uma empresa primeiro.'); setView('empresas'); return }
    if (!contas.length) { aviso('Importe o plano de contas/balancete primeiro.'); setView('balancete'); return }
    if (!movimentos.length) { aviso('Importe o extrato primeiro.'); setView('extrato'); return }
    try {
      const resp = await fetch(`${API_URL}/conciliar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contas, movimentos, regras }) })
      const data = await resp.json()
      if (data.lancamentos) { setMovimentos(data.lancamentos); setView('conciliacao'); aviso('Conciliação concluída.') }
      else aviso('Backend não retornou lançamentos.')
    } catch { aviso('Erro na conciliação.') }
  }

  function alterarMovimento(index: number, campo: string, valor: any) {
    const copia = [...movimentos]
    copia[index] = { ...copia[index], [campo]: campo === 'valor' ? Number(valor) : valor }
    setMovimentos(copia)
  }

  function salvarRegra(index: number) {
    const m = movimentos[index]
    const palavra = String(m.historico || '').split(' ').slice(0, 2).join(' ')
    if (!palavra || !m.debito || !m.credito) { aviso('Preencha débito e crédito antes de salvar regra.'); return }
    setRegras([...regras, { empresa_id: empresaAtual?.id, empresa_nome: empresaAtual?.nome, palavra, debito: m.debito, credito: m.credito, observacao: 'Regra criada na revisão.' }])
    aviso('Regra salva na memória local da empresa.')
  }

  function gerarCSV() {
    const cab = ['empresa','data','historico','debito','grupo_debito','sinal_debito','credito','grupo_credito','sinal_credito','valor','documento','status','confianca','observacao']
    const linhas = movimentos.map((m) => [empresaAtual?.nome || '', m.data, m.historico, m.debito || '', m.grupo_debito || '', m.sinal_debito || '', m.credito || '', m.grupo_credito || '', m.sinal_credito || '', Math.abs(Number(m.valor || 0)).toFixed(2).replace('.', ','), m.documento || '', m.status || '', `${m.confianca || 0}%`, m.observacao || ''])
    return [cab, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  }

  function baixarCSV() {
    if (!movimentos.length) { aviso('Não há lançamentos para exportar.'); return }
    const blob = new Blob([gerarCSV()], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `orquestra_${empresaAtual?.nome || 'empresa'}_lancamentos.csv`
    a.click()
  }

  const conciliados = movimentos.filter((m) => m.status === 'Conciliado').length
  const revisar = movimentos.filter((m) => m.status === 'Revisar' || m.status === 'Pendente').length
  const media = movimentos.length ? Math.round(movimentos.reduce((s, m) => s + Number(m.confianca || 0), 0) / movimentos.length) : 0
  const abas = [['empresas','Empresas'],['dashboard','Dashboard'],['balancete','Plano/Balancete'],['extrato','Extrato'],['conciliacao','Conciliação'],['memoria','Memória IA'],['exportar','Exportar']]

  return <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#0e7490_0%,#020617_38%,#020617_100%)] text-white">
    <aside className="fixed left-0 top-0 h-screen w-80 border-r border-white/10 bg-slate-950/90 p-7 backdrop-blur-xl">
      <div className="text-3xl font-black tracking-tight">Orquestra<span className="text-cyan-400">Contábil</span></div>
      <p className="mt-4 text-sm leading-6 text-slate-400">Empresa → plano de contas → extrato → conciliação automática.</p>
      <div className="mt-6 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4"><div className="text-xs font-black text-cyan-300">EMPRESA ATUAL</div><div className="mt-2 text-sm font-bold text-white">{empresaAtual?.nome || 'Nenhuma selecionada'}</div><div className="mt-1 text-xs text-slate-400">{empresaAtual?.cnpj || ''}</div></div>
      <div className="mt-8 space-y-3">{abas.map(([id,label]) => <button key={id} onClick={() => setView(id)} className={`w-full rounded-2xl border px-4 py-4 text-left font-bold transition ${view === id ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300' : 'border-white/10 bg-slate-900/70 text-slate-200 hover:border-cyan-400/40 hover:text-cyan-300'}`}>{label}</button>)}</div>
      <div className="absolute bottom-7 left-7 right-7 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 p-5"><div className="text-xs font-black text-cyan-300">FLUXO OPERACIONAL</div><p className="mt-3 text-sm leading-6 text-slate-300">Empresa → Plano → Extrato → IA → Revisão → Exportação</p></div>
    </aside>

    <main className="ml-80 p-8">
      <section className="rounded-[36px] border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-cyan-950/70 p-10 shadow-2xl"><div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-300">ANDR / IA CONTÁBIL POR EMPRESA</div><h1 className="mt-6 max-w-5xl text-5xl font-black leading-tight tracking-tight">Conciliação inteligente com plano de contas individual</h1><p className="mt-5 max-w-4xl text-lg leading-8 text-slate-300">Cadastre a empresa, importe o plano de contas dela, envie o extrato e concilie usando somente a estrutura contábil daquela empresa.</p><button onClick={conciliar} className="mt-8 rounded-2xl bg-cyan-400 px-7 py-4 font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300">Executar Conciliação</button></section>

      {view === 'empresas' && <Panel titulo="Cadastro e Seleção de Empresas"><div className="grid grid-cols-2 gap-6"><div className="rounded-[30px] border border-white/10 bg-slate-950/60 p-7"><h2 className="text-2xl font-black">Nova Empresa</h2><input className="mt-6 w-full rounded-2xl border border-white/10 bg-slate-900 p-4" placeholder="Nome da empresa" value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} /><input className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-900 p-4" placeholder="CNPJ" value={empresaCnpj} onChange={(e) => setEmpresaCnpj(e.target.value)} /><button onClick={criarEmpresa} className="mt-6 rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950">Cadastrar Empresa</button></div><div className="rounded-[30px] border border-white/10 bg-slate-950/60 p-7"><h2 className="text-2xl font-black">Empresas Cadastradas</h2><div className="mt-6 space-y-3">{!empresas.length && <div className="text-slate-500">Nenhuma empresa cadastrada.</div>}{empresas.map((emp) => <button key={emp.id} onClick={() => selecionarEmpresa(emp.id)} className={`w-full rounded-2xl border p-4 text-left ${empresaAtual?.id === emp.id ? 'border-cyan-400/50 bg-cyan-400/10' : 'border-white/10 bg-slate-900/80'}`}><div className="font-black">{emp.nome}</div><div className="text-sm text-slate-400">{emp.cnpj || 'Sem CNPJ'}</div><div className="mt-2 text-xs text-cyan-300">{(emp.plano_contas || []).length} contas no plano</div></button>)}</div></div></div></Panel>}
      {view === 'dashboard' && <><section className="mt-8 grid grid-cols-5 gap-5"><Kpi titulo="Empresas" valor={empresas.length}/><Kpi titulo="Contas" valor={contas.length}/><Kpi titulo="Movimentos" valor={movimentos.length}/><Kpi titulo="Conciliados" valor={conciliados} cor="text-emerald-300"/><Kpi titulo="Confiança" valor={`${media}%`} cor="text-cyan-300"/></section><section className="mt-8 grid grid-cols-2 gap-6"><UploadBox titulo="Importar Plano/Balancete" descricao="CSV, PDF ou TXT com plano de contas." onChange={(file: File) => enviarArquivo(file,'balancete')}/><UploadBox titulo="Importar Extrato" descricao="PDF bancário, OFX ou CSV." onChange={(file: File) => enviarArquivo(file,'extrato')}/></section></>}
      {view === 'balancete' && <Panel titulo="Plano de Contas / Balancete da Empresa"><UploadBox titulo="Importar Plano/Balancete" descricao="CSV, PDF ou TXT com plano de contas." onChange={(file: File) => enviarArquivo(file,'balancete')}/><TabelaContas contas={contas}/></Panel>}
      {view === 'extrato' && <Panel titulo="Extrato Importado"><UploadBox titulo="Importar Extrato" descricao="PDF bancário, OFX ou CSV." onChange={(file: File) => enviarArquivo(file,'extrato')}/><TabelaMovimentos movimentos={movimentos} dinheiro={dinheiro}/></Panel>}
      {view === 'conciliacao' && <Panel titulo="Movimentos e Conciliação"><TabelaConciliacao movimentos={movimentos} dinheiro={dinheiro} alterar={alterarMovimento} salvarRegra={salvarRegra}/></Panel>}
      {view === 'memoria' && <Panel titulo="Memória IA por Empresa"><p className="mb-6 text-slate-400">Regras aprendidas nesta sessão para: {empresaAtual?.nome || 'nenhuma empresa'}.</p><TabelaRegras regras={regras}/></Panel>}
      {view === 'exportar' && <Panel titulo="Exportação"><button onClick={baixarCSV} className="rounded-2xl bg-emerald-400 px-6 py-4 font-black text-slate-950">Baixar CSV final</button><pre className="mt-6 max-h-[500px] overflow-auto rounded-2xl border border-white/10 bg-slate-950 p-5 text-sm text-slate-300">{movimentos.length ? gerarCSV() : 'Nenhum lançamento gerado ainda.'}</pre></Panel>}
    </main>
    {mensagem && <div className="fixed bottom-6 right-6 rounded-2xl border border-cyan-400/30 bg-slate-950 px-6 py-4 font-bold text-cyan-200 shadow-2xl">{mensagem}</div>}
  </div>
}

function Kpi({ titulo, valor, cor='text-white' }: { titulo: string; valor: any; cor?: string }) { return <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-6 shadow-xl"><div className="text-sm font-bold text-slate-400">{titulo}</div><div className={`mt-3 text-4xl font-black ${cor}`}>{valor}</div></div> }
function Panel({ titulo, children }: any) { return <section className="mt-8 rounded-[30px] border border-white/10 bg-slate-900/80 p-7 shadow-xl"><h2 className="mb-6 text-2xl font-black">{titulo}</h2>{children}</section> }
function UploadBox({ titulo, descricao, onChange }: any) { return <div className="rounded-[30px] border border-white/10 bg-slate-900/80 p-7 shadow-xl"><h2 className="text-2xl font-black">{titulo}</h2><p className="mt-2 text-sm text-slate-400">{descricao}</p><label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-cyan-400/30 bg-slate-950/70 p-8 text-center transition hover:border-cyan-300 hover:bg-cyan-400/5"><span className="text-lg font-black text-cyan-300">Selecionar arquivo</span><span className="mt-2 text-sm text-slate-500">CSV, PDF, OFX ou TXT</span><input type="file" accept=".csv,.pdf,.ofx,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])}/></label></div> }
function TabelaContas({ contas }: any) { return <div className="mt-6 overflow-auto rounded-2xl border border-white/10"><table className="w-full min-w-[1000px] border-collapse bg-slate-950/80"><thead><tr className="border-b border-white/10 bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400"><th className="p-4">Código</th><th className="p-4">Classificação</th><th className="p-4">Conta</th><th className="p-4">Grupo</th><th className="p-4">Débito</th><th className="p-4">Crédito</th></tr></thead><tbody>{!contas.length && <tr><td className="p-8 text-center text-slate-500" colSpan={6}>Nenhuma conta importada.</td></tr>}{contas.map((c:any,i:number)=><tr key={i} className="border-b border-white/5"><td className="p-4">{c.codigo}</td><td className="p-4">{c.classificacao}</td><td className="p-4">{c.nome || c.conta || c.linha}</td><td className="p-4">{c.grupo}</td><td className="p-4 text-cyan-300">{c.debito}</td><td className="p-4 text-blue-300">{c.credito}</td></tr>)}</tbody></table></div> }
function TabelaMovimentos({ movimentos, dinheiro }: any) { return <div className="mt-6 overflow-auto rounded-2xl border border-white/10"><table className="w-full min-w-[900px] border-collapse bg-slate-950/80"><thead><tr className="border-b border-white/10 bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400"><th className="p-4">Data</th><th className="p-4">Histórico</th><th className="p-4">Valor</th><th className="p-4">Documento</th></tr></thead><tbody>{!movimentos.length && <tr><td className="p-8 text-center text-slate-500" colSpan={4}>Nenhum movimento importado.</td></tr>}{movimentos.map((m:any,i:number)=><tr key={i} className="border-b border-white/5"><td className="p-4">{m.data}</td><td className="p-4">{m.historico || m.linha}</td><td className="p-4">{dinheiro(m.valor)}</td><td className="p-4">{m.documento}</td></tr>)}</tbody></table></div> }
function TabelaConciliacao({ movimentos, dinheiro, alterar, salvarRegra }: any) { return <div className="overflow-auto rounded-2xl border border-white/10"><table className="w-full min-w-[1500px] border-collapse bg-slate-950/80"><thead><tr className="border-b border-white/10 bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400"><th className="p-4">Data</th><th className="p-4">Histórico</th><th className="p-4">Valor</th><th className="p-4">Débito</th><th className="p-4">Sinal D</th><th className="p-4">Crédito</th><th className="p-4">Sinal C</th><th className="p-4">Status</th><th className="p-4">Score</th><th className="p-4">Observação</th><th className="p-4">Ação</th></tr></thead><tbody>{!movimentos.length && <tr><td className="p-8 text-center text-slate-500" colSpan={11}>Nenhum movimento para conciliar.</td></tr>}{movimentos.map((m:any,i:number)=><tr key={i} className="border-b border-white/5 hover:bg-white/[0.03]"><td className="p-4 text-slate-300">{m.data}</td><td className="p-4 font-medium">{m.historico || m.linha}</td><td className="p-4">{dinheiro(m.valor)}</td><td className="p-4"><input className="w-56 rounded-xl border border-white/10 bg-slate-900 p-3 text-cyan-200" value={m.debito || ''} onChange={(e)=>alterar(i,'debito',e.target.value)}/><div className="mt-1 text-xs text-slate-500">{m.grupo_debito}</div></td><td className="p-4 text-cyan-300">{m.sinal_debito}</td><td className="p-4"><input className="w-56 rounded-xl border border-white/10 bg-slate-900 p-3 text-blue-200" value={m.credito || ''} onChange={(e)=>alterar(i,'credito',e.target.value)}/><div className="mt-1 text-xs text-slate-500">{m.grupo_credito}</div></td><td className="p-4 text-blue-300">{m.sinal_credito}</td><td className="p-4"><select className="rounded-xl border border-white/10 bg-slate-900 p-3" value={m.status || 'Aguardando'} onChange={(e)=>alterar(i,'status',e.target.value)}><option>Aguardando</option><option>Conciliado</option><option>Revisar</option><option>Pendente</option></select></td><td className="p-4">{m.confianca ? `${m.confianca}%` : '-'}</td><td className="p-4 text-slate-400">{m.observacao}</td><td className="p-4"><button onClick={()=>salvarRegra(i)} className="rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950">Salvar regra</button></td></tr>)}</tbody></table></div> }
function TabelaRegras({ regras }: any) { return <div className="overflow-auto rounded-2xl border border-white/10"><table className="w-full min-w-[800px] border-collapse bg-slate-950/80"><thead><tr className="border-b border-white/10 bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400"><th className="p-4">Empresa</th><th className="p-4">Palavra</th><th className="p-4">Débito</th><th className="p-4">Crédito</th><th className="p-4">Obs</th></tr></thead><tbody>{!regras.length && <tr><td className="p-8 text-center text-slate-500" colSpan={5}>Nenhuma regra criada ainda.</td></tr>}{regras.map((r:any,i:number)=><tr key={i} className="border-b border-white/5"><td className="p-4">{r.empresa_nome}</td><td className="p-4">{r.palavra}</td><td className="p-4">{r.debito}</td><td className="p-4">{r.credito}</td><td className="p-4">{r.observacao}</td></tr>)}</tbody></table></div> }
