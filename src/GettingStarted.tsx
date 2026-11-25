import {useEffect,useRef,useState,type ComponentType} from 'react';
import {BarChart3,CreditCard,Home,Landmark,PiggyBank,Plus,Repeat2,Settings,Sparkles,Users,type LucideProps} from 'lucide-react';
import {registeredBalance} from './account-balance';
import type {Lancamento,Recorrencia,Reserva} from './db';
import {shiftMonth} from './finance';
import {recurringMonth,recurringSummary,toggleSkip,type RecurringMonth} from './recurring-status';
import {financialReports} from './reporting';
import {boxBalance} from './reserve-boxes';
import {dataBR,hoje,mesAtual,moeda} from './utils';

type Lesson={icon:ComponentType<LucideProps>;title:string;text:string;points:string[];where:string};
const lessons:Lesson[]=[
 {icon:Sparkles,title:'Bem-vindo ao ControlAI',text:'Um app para saber quanto você tem, o que ainda falta pagar e para onde o dinheiro vai.',points:['Solo: suas finanças pessoais.','Casal: renda em comum, saldos pessoais de cada um e reserva do casal.','Gestora: casa dividida entre pessoas, com contribuições, mercado e acertos (aba Mercado).'],where:'Você pode ter várias contas e trocar entre elas no topo.'},
 {icon:Home,title:'Início',text:'O resumo do mês escolhido no topo.',points:['Pendências do mês: pague, receba, pule a recorrência, edite ou exclua direto na lista.','Previsão de saldo até o fim do mês (segunda aba do mesmo cartão).','Reservas e caixinhas com metas, e aviso de empréstimo atrasado.','Saldo da conta (corrente + reserva) e resultado do mês.'],where:'Primeira aba da barra inferior.'},
 {icon:Plus,title:'Lançar receitas e despesas',text:'Toque no botão + (em Início ou Lançamentos).',points:['Previsto = ainda vai acontecer. Pago/Recebido = já aconteceu e mexe no saldo.','Compra no cartão já entra como Previsto: o saldo cai quando você paga a fatura.','Devolução de gasto: alguém devolveu parte do que você gastou (abate a categoria).','Mês de referência: a conta é de um mês e vence em outro (ex.: água de novembro paga em dezembro).','O microfone dentro do lançamento cadastra por voz.','Para trazer muitos lançamentos de uma vez, use “Importar planilha ou extrato”, no fim da aba Lançamentos.'],where:'Botão + flutuante · importação no fim de Lançamentos.'},
 {icon:Repeat2,title:'Recorrentes',text:'Contas e receitas de todo mês, com a situação do mês.',points:['Veja o que está Pago, A pagar, Atrasado ou Pulado, e quanto falta.','“Pular mês” para o que nem sempre acontece (ex.: corte de cabelo).','“Conta do mês anterior” para contas que vencem no mês seguinte.'],where:'Lançamentos → Recorrentes.'},
 {icon:CreditCard,title:'Parcelas e cartões',text:'Compras parceladas e faturas em um lugar só.',points:['Parcelas: progresso de cada compra, próxima parcela, atrasos e quanto falta.','Cartões: fatura do mês com situação, gastos por categoria e próximas faturas.','Pagar fatura confirma as compras previstas, sem criar uma segunda despesa.'],where:'Lançamentos → Parcelas e Cartões.'},
 {icon:Landmark,title:'Orçamento · Mês',text:'O planejamento do mês.',points:['Divisão da renda entre fixos, variáveis e reserva.','Orçamento semanal e limites por categoria.','Fechar o mês protege os lançamentos de alterações sem querer.'],where:'Orçamento → Mês.'},
 {icon:PiggyBank,title:'Reservas e caixinhas',text:'Dinheiro guardado, com metas e rendimentos.',points:['Crie caixinhas (viagem, carro...) com meta. Guardar, resgatar, gastar ou implantar saldo.','Rendimento: o que a caixinha rendeu (entra na reserva, não é receita do mês).','“Fora da reserva” para dinheiro separado que não soma no total.','Empréstimos: quem deve, parcelas e atrasos; a devolução volta para a caixinha certa.'],where:'Orçamento → Reservas.'},
 {icon:BarChart3,title:'Relatórios',text:'Para onde o dinheiro foi.',points:['Relatório anual de receitas e despesas.','Peso dos gastos por categoria, com a média por mês.','Escolha entre mês de referência ou data do pagamento.'],where:'Aba Relatórios.'},
 {icon:Users,title:'Compartilhar com convidados',text:'Casal e Gestora podem liberar consulta para outras pessoas.',points:['Libere o e-mail e envie o link de convite: a pessoa cria a senha e cai direto na conta.','Associe a pessoa (titular ou morador): ela vê o próprio saldo ou contribuição.','“Ver como convidado” mostra exatamente o que ela vê.'],where:'Ajustes → Acessos de consulta.'},
 {icon:Settings,title:'Ajustes e segurança',text:'Backup, sincronização, contas e categorias.',points:['Exporte o backup JSON com senha antes de atualizar o app.','Sincronize com seu login para usar em mais de um aparelho.','Histórico e lixeira guardam exclusões por 30 dias.','Contas financeiras, categorias, salário e lembretes ficam aqui.'],where:'Aba Ajustes (tem busca no topo).'},
];

export default function GettingStarted({initialMode,onClose}:{initialMode:'tutorial'|'demo';onClose:()=>void}){
 const [mode,setMode]=useState(initialMode),[step,setStep]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),title=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{const element=dialog.current!;element.showModal();return()=>element.close();},[]);
 useEffect(()=>{title.current?.focus();},[mode,step]);
 const lesson=lessons[step],Icon=lesson.icon;
 return <dialog ref={dialog} className="dialog onboarding-dialog guide-dialog guide-v2" aria-labelledby="guide-title" onCancel={event=>{event.preventDefault();onClose();}}>
  <div className="guide-top">
   <div className="filters segmented guide-modes"><button type="button" className={mode==='tutorial'?'active':''} onClick={()=>setMode('tutorial')}>Tutorial</button><button type="button" className={mode==='demo'?'active':''} onClick={()=>setMode('demo')}>Demonstração</button></div>
   <button type="button" className="textbutton" onClick={onClose}>Fechar</button>
  </div>
  {mode==='tutorial'?<>
   <div className="guide-progress" aria-hidden="true"><span style={{width:`${(step+1)/lessons.length*100}%`}}/></div>
   <div className="guide-steps" role="tablist" aria-label="Etapas do tutorial">{lessons.map((l,i)=><button type="button" role="tab" key={l.title} aria-selected={i===step} aria-label={`Etapa ${i+1}: ${l.title}`} className={i===step?'active':i<step?'done':''} onClick={()=>setStep(i)}>{i+1}</button>)}</div>
   <div className="guide-card">
    <span className="guide-icon"><Icon size={26}/></span>
    <h2 id="guide-title" tabIndex={-1} ref={title}>{lesson.title}</h2>
    <p>{lesson.text}</p>
    <ul>{lesson.points.map(p=><li key={p}>{p}</li>)}</ul>
    <p className="guide-where">📍 {lesson.where}</p>
   </div>
   <div className="wizard-actions">
    <button type="button" className="secondary" disabled={step===0} onClick={()=>setStep(step-1)}>Voltar</button>
    {step<lessons.length-1?<button type="button" className="primary" onClick={()=>setStep(step+1)}>Próxima</button>:<button type="button" className="primary" onClick={()=>setMode('demo')}>Testar na demonstração</button>}
   </div>
  </>:<><h2 id="guide-title" tabIndex={-1} ref={title} className="guide-demo-title">Demonstração</h2><Demo/></>}
 </dialog>;
}

// Fictitious data, kept only in this session. Uses the same rules of the app.
function demoData(){
 const month=mesAtual(),prev=shiftMonth(month,-1),day=(m:string,d:number)=>`${m}-${String(d).padStart(2,'0')}`;
 const recurrences:Recorrencia[]=[
  {id:1,contaId:'demo',descricao:'Aluguel',valorCentavos:150000,tipo:'despesa',natureza:'fixo',categoria:'Moradia',inicio:day(prev,5),dia:5,ativa:true},
  {id:2,contaId:'demo',descricao:'Internet',valorCentavos:9990,tipo:'despesa',natureza:'fixo',categoria:'Moradia',inicio:day(prev,15),dia:15,ativa:true},
  {id:3,contaId:'demo',descricao:'Corte de cabelo',valorCentavos:5000,tipo:'despesa',natureza:'variavel',categoria:'Cuidados',inicio:day(prev,25),dia:25,ativa:true},
  {id:4,contaId:'demo',descricao:'Água',valorCentavos:8500,tipo:'despesa',natureza:'fixo',categoria:'Moradia',inicio:day(prev,6),dia:6,ativa:true,referenciaAnterior:true},
 ];
 const entries:Lancamento[]=[
  {id:10,contaId:'demo',descricao:'Salário',valorCentavos:520000,tipo:'receita',natureza:'fixo',categoria:'Salário',data:day(month,5),status:'confirmado'},
  {id:11,contaId:'demo',descricao:'Aluguel',valorCentavos:150000,tipo:'despesa',natureza:'fixo',categoria:'Moradia',data:day(month,5),status:'confirmado',recorrenciaId:1},
  {id:12,contaId:'demo',descricao:'Mercado',valorCentavos:61000,tipo:'despesa',natureza:'variavel',categoria:'Mercado',data:day(month,8),status:'confirmado'},
  {id:13,contaId:'demo',descricao:'Restaurante',valorCentavos:18000,tipo:'despesa',natureza:'variavel',categoria:'Lazer',data:day(month,9),status:'confirmado'},
  {id:14,contaId:'demo',descricao:'Mercado',valorCentavos:55000,tipo:'despesa',natureza:'variavel',categoria:'Mercado',data:day(prev,10),status:'confirmado'},
  {id:15,contaId:'demo',descricao:'Salário',valorCentavos:520000,tipo:'receita',natureza:'fixo',categoria:'Salário',data:day(prev,5),status:'confirmado'},
 ];
 const reserves:Reserva[]=[{id:20,contaId:'demo',descricao:'Guardado',valorCentavos:300000,data:day(prev,6)},{id:21,contaId:'demo',descricao:'Viagem',valorCentavos:80000,data:day(prev,6),caixinhaId:'viagem'}];
 return {month,recurrences,entries,reserves};
}
function Demo(){
 const [data,setData]=useState(demoData),[tab,setTab]=useState('Início'),[toast,setToast]=useState('');
 const {month,recurrences,entries,reserves}=data,today=hoje();
 const balance=registeredBalance(entries,reserves,[],month);
 const rows=recurrences.map(r=>recurringMonth(r,month,entries,today)).filter((x):x is RecurringMonth=>x!==null),summary=recurringSummary(rows);
 const report=financialReports(entries,undefined,month);
 const trip=boxBalance(reserves,'viagem'),goal=300000;
 const say=(text:string)=>{setToast(text);setTimeout(()=>setToast(''),2600);};
 function pay(row:RecurringMonth){const p=row.projected;if(!p)return;setData(d=>({...d,entries:[...d.entries,{...p,id:Date.now(),status:'confirmado',data:today<p.data?today:p.data}]}));say(`${row.recurrence.descricao} paga: o saldo corrente diminuiu.`);}
 function skip(row:RecurringMonth){setData(d=>({...d,recurrences:d.recurrences.map(r=>r.id===row.recurrence.id?{...r,...toggleSkip(r,row.dueMonth,row.state!=='pulado')}:r)}));say(row.state==='pulado'?'Mês restaurado.':'Pulado: não entra no que falta pagar.');}
 function save(){setData(d=>({...d,reserves:[...d.reserves,{id:Date.now(),contaId:'demo',descricao:'Guardar',valorCentavos:10000,data:today,caixinhaId:'viagem'}]}));say('R$ 100 guardados na Viagem: saiu do corrente e entrou na reserva.');}
 return <div className="guide-demo">
  <p className="muted">Conta fictícia neste mês. Toque nos botões para ver o efeito; nada é salvo.</p>
  <div className="filters guide-demo-tabs" role="group" aria-label="Áreas da demonstração">{['Início','Recorrentes','Reservas','Relatórios'].map(name=><button type="button" key={name} className={tab===name?'active':''} aria-pressed={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</div>
  {toast&&<p className="success guide-toast" role="status">{toast}</p>}
  {tab==='Início'&&<div className="guide-demo-grid">
   <div className="guide-stat"><small>Corrente</small><strong className={balance.current<0?'red':''}>{moeda(balance.current)}</strong></div>
   <div className="guide-stat"><small>Reserva</small><strong className="green">{moeda(balance.reserve)}</strong></div>
   <div className="guide-stat wide"><small>Falta pagar em recorrentes</small><strong className="red">{moeda(summary.faltaCentavos)}</strong><span>{summary.pagos} de {summary.total} pagas</span></div>
   <p className="muted wide">Vá em Recorrentes e pague uma conta: o corrente cai e o “falta pagar” diminui.</p>
  </div>}
  {tab==='Recorrentes'&&<div className="recurring-rows">{rows.map(row=><div className={`recurring-row ${row.state}`} key={row.recurrence.id}><span className="recurring-dot" aria-hidden="true"/><div className="recurring-body"><strong>{row.recurrence.descricao}</strong><small>{row.recurrence.referenciaAnterior?'Conta deste mês · ':''}vence {dataBR(row.due).slice(0,5)}</small></div><div className="recurring-side"><strong>{moeda(row.value)}</strong><span className={`recurring-state ${row.state}`}>{{pago:'Paga',parcial:'Parcial',pendente:'A pagar',atrasado:'Atrasada',pulado:'Pulada'}[row.state]}</span></div><div className="recurring-actions">{row.projected&&<button type="button" className="recurring-pay" onClick={()=>pay(row)}>Pagar</button>}{(row.projected||row.state==='pulado')&&<button type="button" className="textbutton" onClick={()=>skip(row)}>{row.state==='pulado'?'Desfazer':'Pular mês'}</button>}</div></div>)}</div>}
  {tab==='Reservas'&&<div className="guide-demo-grid">
   <div className="guide-stat wide"><small>Caixinha Viagem</small><strong>{moeda(trip)}</strong><span className="reserve-box-goal"><span style={{width:`${Math.min(100,trip/goal*100)}%`}}/></span><span>{Math.floor(trip/goal*100)}% de {moeda(goal)}</span></div>
   <button type="button" className="primary wide" onClick={save}>Guardar R$ 100 na Viagem</button>
   <div className="guide-stat"><small>Corrente</small><strong>{moeda(balance.current)}</strong></div><div className="guide-stat"><small>Total</small><strong>{moeda(balance.total)}</strong></div>
  </div>}
  {tab==='Relatórios'&&<div className="categorylist category-table"><div className="category-head"><span>Categoria</span><span>No mês</span><span>Média/mês</span></div>{report.categories.map(c=><div key={c.name}><span>{c.name}</span><strong>{moeda(Math.round(c.value*100))}</strong><strong className="category-avg">{moeda(report.averages[c.name]??0)}</strong></div>)}</div>}
  <button type="button" className="secondary" onClick={()=>{setData(demoData());setTab('Início');}}>Reiniciar demonstração</button>
 </div>;
}
