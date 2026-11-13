import {useEffect, useRef, useState} from 'react';
import {registeredBalance} from './account-balance';
import {monthlyFixedBudget} from './budget';
import type {Lancamento} from './db';
import {financialReports} from './reporting';
import {moeda} from './utils';

const lessons = [
  {title: 'Início', text: 'Selecione a conta e o mês para conferir o saldo e os próximos pagamentos. Use o botão + para registrar uma receita ou despesa.'},
  {title: 'Lançamentos', text: 'Cadastre contas como previstas e confirme quando pagar ou receber. Use Recorrentes para contas mensais e Parcelas para compras divididas.'},
  {title: 'Orçamento', text: 'Em contas Solo e Casal, abra Divisão da renda para planejar os gastos variáveis e a reserva. Acompanhe os limites semanais. Na conta Gestora, acompanhe as contribuições.'},
  {title: 'Relatórios', text: 'Escolha o mês e confira receitas, despesas e categorias. Alterne entre mês de referência e data de pagamento para comparar os resultados.'},
  {title: 'Ajustes', text: 'Use a busca para encontrar contas financeiras, categorias, sincronização e backup. Toque no título de uma seção para abri-la ou recolhê-la.'},
];

const demoMonth = '2026-01';
const demoEntries: Lancamento[] = [
  {id: 1, descricao: 'Salário de exemplo', tipo: 'receita', natureza: 'fixo', categoria: 'Salário', data: demoMonth + '-05', valorCentavos: 360000, status: 'confirmado'},
  {id: 2, descricao: 'Aluguel de exemplo', tipo: 'despesa', natureza: 'fixo', categoria: 'Moradia', data: demoMonth + '-10', valorCentavos: 120000, status: 'previsto', recorrenciaId: 1},
  {id: 3, descricao: 'Mercado de exemplo', tipo: 'despesa', natureza: 'variavel', categoria: 'Mercado', data: demoMonth + '-12', valorCentavos: 28500, status: 'confirmado'},
];

export default function GettingStarted({initialMode, onClose}: {initialMode: 'tutorial' | 'demo'; onClose: () => void}) {
  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const lessonTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => { lessonTitle.current?.focus(); }, [mode, step]);

  return <dialog ref={dialog} className="dialog onboarding-dialog guide-dialog" aria-labelledby="guide-title"
    onCancel={event => {event.preventDefault(); onClose();}}>
    <div className="sectiontitle">
      <h2 id="guide-title">{mode === 'tutorial' ? 'Tutorial do ControlAI' : 'Demonstração'}</h2>
      <button type="button" className="secondary" onClick={onClose}>{mode === 'tutorial' ? 'Fechar tutorial' : 'Sair da demonstração'}</button>
    </div>
    {mode === 'tutorial' ? <>
      <p className="wizard-progress">Etapa {step + 1} de {lessons.length}</p>
      <h3 tabIndex={-1} ref={lessonTitle}>{lessons[step].title}</h3>
      <p>{lessons[step].text}</p>
      <div className="wizard-actions">
        {step > 0 && <button className="secondary" onClick={() => setStep(step - 1)}>Voltar</button>}
        {step < lessons.length - 1
          ? <button className="primary" onClick={() => setStep(step + 1)}>Próxima etapa</button>
          : <button className="primary" onClick={() => setMode('demo')}>Abrir demonstração</button>}
      </div>
    </> : <Demo />}
  </dialog>;
}

function Demo() {
  const [entries, setEntries] = useState(demoEntries);
  const [tab, setTab] = useState('Início');
  const balance = registeredBalance(entries, [], [], demoMonth);
  const report = financialReports(entries, undefined, demoMonth);
  const budget = monthlyFixedBudget(entries, report.income, demoMonth);

  return <>
    <p className="muted">Conta fictícia · janeiro de 2026. As alterações ficam nesta sessão de demonstração.</p>
    <div className="filters" role="group" aria-label="Áreas da demonstração">
      {['Início', 'Lançamentos', 'Orçamento', 'Relatórios'].map(name =>
        <button key={name} className={tab === name ? 'active' : ''} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}
    </div>
    <section aria-label={tab} className="demo-content">
      {tab === 'Início' && <><h3>Saldo registrado</h3><p>{moeda(balance.current)}</p><p>Abra Lançamentos e confirme o aluguel para conferir o efeito no saldo.</p></>}
      {tab === 'Lançamentos' && <div className="records">{entries.map(entry =>
        <div key={entry.id} className="record demo-record">
          <div className="recordbody"><strong>{entry.descricao}</strong><small>{entry.categoria} · {moeda(entry.valorCentavos)}</small></div>
          {entry.recorrenciaId ? <button className="secondary" onClick={() => setEntries(current => current.map(row =>
            row.id === entry.id ? {...row, status: row.status === 'previsto' ? 'confirmado' : 'previsto'} : row))}>
            {entry.status === 'previsto' ? 'Confirmar pagamento' : 'Marcar como previsto'}
          </button> : <small>{entry.tipo === 'receita' ? 'Recebido' : 'Pago'}</small>}
        </div>)}</div>}
      {tab === 'Orçamento' && <><h3>Compromissos fixos do mês</h3><p>{moeda(budget.totalCentavos)} · {budget.percentage}% da renda</p><p>O aluguel recorrente entra no planejamento enquanto ainda está previsto.</p></>}
      {tab === 'Relatórios' && <><h3>Movimentos confirmados</h3><p>Receitas {moeda(report.income)} · Despesas {moeda(report.expense)}</p>
        <ul>{report.categories.map(category => <li key={category.name}>{category.name} · {moeda(category.value * 100)}</li>)}</ul></>}
    </section>
    <button className="secondary" onClick={() => {setEntries(demoEntries); setTab('Início');}}>Reiniciar demonstração</button>
  </>;
}
