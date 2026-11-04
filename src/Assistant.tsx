import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Mic, MicOff } from 'lucide-react';
import { db, type Categoria, type Conta, type Fechamento, type Lancamento } from './db';
import { hoje, moeda } from './utils';
import { commandDraft, detectColumns, draftError, fingerprint, MAX_ROWS, parseCsv, spreadsheetDrafts, toEntry, type Cell, type Column, type Columns, type Draft } from './assistant';

interface Props { conta: Conta; categorias: Categoria[]; registros: Lancamento[]; fechamentos: Fechamento[] }
interface SpeechResult { isFinal: boolean; 0: { transcript: string } }
interface Speech {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<SpeechResult>; resultIndex: number }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; abort(): void;
}
type SpeechConstructor = new () => Speech;
function speechConstructor(): SpeechConstructor | undefined {
  const scope = window as unknown as { SpeechRecognition?: SpeechConstructor; webkitSpeechRecognition?: SpeechConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}
const columnLabels: Record<Column, string> = {descricao:'Descrição', valor:'Valor', data:'Data', tipo:'Tipo', categoria:'Categoria', status:'Status', observacao:'Observação'};
function excelCell(value: unknown): Cell {
  return value instanceof Date || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null;
}

export default function Assistant({ conta, categorias, registros, fechamentos }: Props) {
  const [sheets, setSheets] = useState<{name: string; rows: Cell[][]}[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [columns, setColumns] = useState<Columns>(detectColumns([]));
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [command, setCommand] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [listening, setListening] = useState(false);
  const speech = useRef<Speech | null>(null);
  const busy = useRef(false);
  const fileRequest = useRef(0);
  const rows = sheets[sheetIndex]?.rows ?? [];
  const closed = fechamentos.map(item => item.mes);
  const existing = useMemo(() => new Set(registros.map(fingerprint)), [registros]);
  const duplicates = new Set<number>();
  const seen = new Set(existing);
  drafts.forEach((draft, index) => {
    if (draftError(draft, categorias, [])) return;
    const key = fingerprint(toEntry(draft, conta.id, categorias));
    if (seen.has(key)) duplicates.add(index);
    if (draft.selecionada) seen.add(key);
  });
  const selected = drafts.filter((draft, index) => draft.selecionada && !(skipDuplicates && duplicates.has(index)));
  const hasErrors = selected.some(draft => draftError(draft, categorias, closed));
  const Voice = speechConstructor();

  useEffect(() => () => {
    fileRequest.current++;
    if (speech.current) { speech.current.onend = null; speech.current.onerror = null; speech.current.onresult = null; speech.current.abort(); }
  }, []);

  async function readFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const request = ++fileRequest.current;
    setError(''); setMessage(''); setDrafts([]); setSheets([]); setLoading(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Escolha um arquivo de até 5 MB.');
      let loaded: {name: string; rows: Cell[][]}[];
      if (/\.csv$/i.test(file.name)) {
        const buffer = await file.arrayBuffer();
        let text: string;
        try { text = new TextDecoder('utf-8', {fatal:true}).decode(buffer); }
        catch { text = new TextDecoder('windows-1252').decode(buffer); }
        loaded = [{name:file.name, rows:parseCsv(text)}];
      } else if (/\.xlsx$/i.test(file.name)) {
        const { default: readExcel } = await import('read-excel-file/browser');
        loaded = (await readExcel(file)).map(sheet => ({name:sheet.sheet, rows:sheet.data.map(row => row.map(excelCell))}));
      } else throw new Error('Use CSV ou Excel .xlsx. Para .xls, salve uma cópia como .xlsx ou CSV.');
      loaded = loaded.filter(sheet => sheet.rows.some(row => row.some(cell => cell !== null && String(cell).trim() !== '')));
      if (!loaded.length) throw new Error('A planilha está vazia.');
      if (request !== fileRequest.current) return;
      setSheets(loaded); setSheetIndex(0); setColumns(detectColumns(loaded[0].rows[0] ?? []));
    } catch (err) { if (request === fileRequest.current) setError(err instanceof Error ? err.message : 'Não foi possível ler o arquivo.'); }
    finally { if (request === fileRequest.current) setLoading(false); }
  }
  function reviewSheet() {
    setError(''); setMessage(''); setDrafts([]);
    try {
      const result = spreadsheetDrafts(rows, columns, categorias, hoje());
      if (!result.length) throw new Error('Não há lançamentos para revisar.');
      setDrafts(result);
    } catch (err) { setError(err instanceof Error ? err.message : 'Verifique as colunas.'); }
  }
  function reviewCommand() {
    setError(''); setMessage(''); setDrafts([]);
    try { setDrafts([commandDraft(command, categorias, hoje())]); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível interpretar.'); }
  }
  function startVoice() {
    if (!Voice || saving || loading) return;
    setError(''); setMessage('');
    if (speech.current) {
      speech.current.onresult = null; speech.current.onerror = null; speech.current.onend = null;
      speech.current.abort();
    }
    const recognition = new Voice();
    speech.current = recognition;
    recognition.lang = 'pt-BR'; recognition.continuous = false; recognition.interimResults = false;
    recognition.onresult = event => {
      const result = event.results[event.resultIndex];
      if (result?.isFinal) { setCommand(result[0].transcript); setDrafts([]); setMessage('Texto reconhecido. Clique em Interpretar comando para revisar.'); }
    };
    recognition.onerror = event => {
      setListening(false);
      if (event.error === 'aborted') return;
      setError(event.error === 'not-allowed' ? 'Permita o microfone no navegador ou digite o comando.'
        : event.error === 'no-speech' ? 'Não ouvi uma frase. Tente novamente ou digite o comando.'
        : 'O reconhecimento de voz não está disponível agora. Você pode digitar o comando.');
    };
    recognition.onend = () => { if (speech.current === recognition) { setListening(false); speech.current = null; } };
    try { recognition.start(); setListening(true); }
    catch { setListening(false); setError('Não foi possível iniciar o microfone. Digite o comando ou tente novamente.'); }
  }
  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts(current => current.map((draft, i) => i === index ? {...draft, ...patch} : draft));
  }
  async function save() {
    if (busy.current || !selected.length || hasErrors) return;
    busy.current = true; setSaving(true); setError(''); setMessage('');
    try {
      // Read account ownership, categories, closures and duplicates again inside one transaction.
      const result = await db.transaction('rw', [db.contas, db.categorias, db.fechamentos, db.lancamentos], async () => {
        if (!await db.contas.get(conta.id)) throw new Error('Esta conta não existe mais. Selecione outra conta.');
        const freshCategories = await db.categorias.where('contaId').equals(conta.id).toArray();
        const freshClosed = (await db.fechamentos.where('contaId').equals(conta.id).toArray()).map(item => item.mes);
        const keys = new Set((await db.lancamentos.where('contaId').equals(conta.id).toArray()).map(fingerprint));
        const entries: Lancamento[] = [];
        let skipped = 0;
        for (const draft of drafts.filter(item => item.selecionada)) {
          const validation = draftError(draft, freshCategories, []);
          if (validation) throw new Error(`Linha ${draft.linha}: ${validation}`);
          const entry = toEntry(draft, conta.id, freshCategories);
          const key = fingerprint(entry);
          if (skipDuplicates && keys.has(key)) { skipped++; continue; }
          const closureError = draftError(draft, freshCategories, freshClosed);
          if (closureError) throw new Error(`Linha ${draft.linha}: ${closureError}`);
          entries.push(entry); keys.add(key);
        }
        if (entries.length) await db.lancamentos.bulkAdd(entries);
        return {saved:entries.length, skipped};
      });
      setDrafts([]); setCommand('');
      setMessage(`${result.saved} lançamento(s) adicionado(s) à conta ${conta.nome}.${result.skipped ? ` ${result.skipped} possível(is) duplicata(s) ignorada(s).` : ''}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar os lançamentos.'); }
    finally { busy.current = false; setSaving(false); }
  }

  return <div className="assistant">
    <p className="muted">Importe uma planilha ou descreva um lançamento. A interpretação usa regras locais, sem IA paga. Revise os dados antes de confirmar na conta <strong>{conta.nome}</strong>.</p>
    <fieldset disabled={loading || saving || listening} className="assistant-section panel">
      <legend>Importar planilha</legend>
      <p className="muted">CSV ou Excel .xlsx, até 5 MB e {MAX_ROWS} lançamentos por aba. A primeira linha deve conter os nomes das colunas. Os arquivos são lidos neste dispositivo.</p>
      <label className="assistant-file"><FileUp size={20}/>Selecionar planilha<input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={readFile}/></label>
      {loading && <p role="status">Lendo planilha…</p>}
      {sheets.length > 0 && <div className="fields assistant-mapping">
        <label>Aba da planilha<select value={sheetIndex} onChange={event => {const index = Number(event.target.value); setSheetIndex(index); setColumns(detectColumns(sheets[index].rows[0] ?? [])); setDrafts([]);}}>{sheets.map((sheet, i) => <option key={i} value={i}>{sheet.name}</option>)}</select></label>
        <p className="muted">Confira as colunas. Sem Tipo: valores negativos viram despesas e positivos viram receitas. Sem Data: usamos hoje. Sem Status: usamos confirmado. Categorias são sugeridas quando não informadas.</p>
        <div className="assistant-columns">{(Object.keys(columnLabels) as Column[]).map(key => <label key={key}>Coluna de {columnLabels[key].toLowerCase()}{['descricao','valor'].includes(key) ? ' *' : ''}<select value={columns[key]} onChange={event => {setColumns(current => ({...current, [key]:Number(event.target.value)})); setDrafts([]);}}><option value={-1}>Não informada</option>{rows[0]?.map((header, index) => <option key={index} value={index}>{String(header ?? '') || `Coluna ${index + 1}`}</option>)}</select></label>)}</div>
        <button className="primary" type="button" onClick={reviewSheet}>Revisar planilha</button>
      </div>}
    </fieldset>
    <section className="panel">
      <h3>Comando por texto ou voz</h3>
      <p className="muted">Exemplo: “comprei almoço por 40 reais” ou “recebi salário de 2500 reais ontem”. Um lançamento por comando; sem data, usamos hoje. Valores por extenso simples também são aceitos.</p>
      <div className="fields"><label>Seu comando<textarea rows={3} value={command} disabled={saving || loading || listening} onChange={event => {setCommand(event.target.value); setDrafts([]);}} placeholder="Comprei almoço por 40 reais"/></label></div>
      <p className="muted">O reconhecimento de voz depende do navegador, pode precisar de internet e pode enviar áudio ao serviço de voz dele. O ControlAI interpreta o texto localmente e não grava áudio.</p>
      {!Voice && <p className="muted">Este navegador não oferece reconhecimento de voz. Use o campo de texto ou o ditado do teclado do celular.</p>}
      {listening ? <button type="button" className="secondary" onClick={() => {speech.current?.abort(); setListening(false);}}><MicOff size={18}/>Cancelar gravação</button>
        : <button type="button" className="secondary" disabled={!Voice || loading || saving} onClick={startVoice}><Mic size={18}/>Usar microfone</button>}
      <button type="button" className="primary" disabled={!command.trim() || listening || loading || saving} onClick={reviewCommand}>Interpretar comando</button>
      {listening && <p role="status">Ouvindo… diga uma receita ou despesa.</p>}
    </section>
    {error && <p className="error assistant-message" role="alert">{error}</p>}
    {message && <p className="success assistant-message" role="status">{message}</p>}
    {drafts.length > 0 && <section className="panel assistant-review">
      <h3>Revisar lançamentos</h3>
      <p className="muted">Nenhum dado foi gravado ainda. Ajuste as informações e desmarque as linhas que não deseja adicionar. Categorias e meses fechados são conferidos novamente ao salvar.</p>
      <fieldset disabled={saving} className="assistant-review-fields">
        <label className="check"><input type="checkbox" checked={skipDuplicates} onChange={event => setSkipDuplicates(event.target.checked)}/>Ignorar possíveis duplicatas</label>
        <p className="muted">Comparamos data, tipo, valor, descrição e categoria. Desmarque a opção para permitir lançamentos iguais de propósito.</p>
        {drafts.map((draft, index) => {
          const validation = draftError(draft, categorias, closed);
          const available = categorias.filter(category => category.tipo === draft.tipo);
          return <fieldset className={`assistant-draft${!draft.selecionada ? ' assistant-deselected' : ''}`} key={index}>
            <legend><label className="check"><input type="checkbox" checked={draft.selecionada} onChange={event => updateDraft(index, {selecionada:event.target.checked})}/>Linha {draft.linha}</label></legend>
            {duplicates.has(index) && <p className="assistant-warning">Possível duplicata{skipDuplicates ? ' — será ignorada.' : ' — será adicionada se selecionada.'}</p>}
            <div className="fields assistant-columns">
              <label>Descrição<input maxLength={120} value={draft.descricao} onChange={event => updateDraft(index, {descricao:event.target.value})}/></label>
              <label>Valor (R$)<input inputMode="decimal" value={draft.valor} onChange={event => updateDraft(index, {valor:event.target.value})}/>{!draft.valor && draft.valorOriginal && <small>Valor original não interpretado: {draft.valorOriginal}</small>}</label>
              <label>Data<input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(draft.data) ? draft.data : ''} onChange={event => updateDraft(index, {data:event.target.value})}/></label>
              <label>Tipo<select value={draft.tipo} onChange={event => {const tipo = event.target.value; updateDraft(index, {tipo, categoria:categorias.find(category => category.tipo === tipo)?.nome ?? ''});}}>{!['despesa','receita'].includes(draft.tipo) && <option value={draft.tipo}>Selecione o tipo</option>}<option value="despesa">Despesa</option><option value="receita">Receita</option></select></label>
              <label>Categoria<select value={draft.categoria} onChange={event => updateDraft(index, {categoria:event.target.value})}>{!available.some(category => category.nome === draft.categoria) && <option value={draft.categoria}>{draft.categoria ? `${draft.categoria} — selecione uma categoria válida` : 'Selecione uma categoria'}</option>}{available.map(category => <option key={category.id} value={category.nome}>{category.nome}</option>)}</select></label>
              <label>Status<select value={draft.status} onChange={event => updateDraft(index, {status:event.target.value})}>{!['confirmado','previsto'].includes(draft.status) && <option value={draft.status}>Selecione o status</option>}<option value="confirmado">{draft.tipo === 'receita' ? 'Recebido' : 'Pago'}</option><option value="previsto">Previsto</option></select></label>
              <label className="assistant-note">Observação (opcional)<textarea rows={2} value={draft.observacao} onChange={event => updateDraft(index, {observacao:event.target.value})}/></label>
            </div>
            {validation && <p className="error">{validation}</p>}
            {!validation && <p className="muted">{draft.tipo === 'receita' ? 'Receita' : 'Despesa'} de {moeda(toEntry(draft, conta.id, categorias).valorCentavos)} · {categorias.find(category => category.nome === draft.categoria && category.tipo === draft.tipo)?.natureza === 'fixo' ? 'Fixo' : 'Variável'}</p>}
          </fieldset>;
        })}
        <p><strong>{selected.length} lançamento(s) para adicionar à conta {conta.nome}.</strong></p>
        {hasErrors && <p className="error">Corrija ou desmarque as linhas com erro para continuar.</p>}
        <button type="button" className="primary" disabled={saving || !selected.length || hasErrors} onClick={save}>{saving ? 'Adicionando…' : 'Confirmar lançamentos'}</button>
        <button type="button" className="secondary" disabled={saving} onClick={() => setDrafts([])}>Descartar revisão</button>
      </fieldset>
    </section>}
    <p className="muted">O assistente adiciona lançamentos; ele não restaura nem substitui o banco. Para um backup completo, use Ajustes.</p>
  </div>;
}
