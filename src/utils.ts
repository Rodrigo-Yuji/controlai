export const moeda = (centavos: number) => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(centavos/100);
export const hoje = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const mesAtual = () => hoje().slice(0,7);
export const paraCentavos = (valor: string) => { const n=Number(valor.replace(',','.')); return Number.isFinite(n) ? Math.round(n*100) : NaN; };
export const dataBR = (s:string) => s.split('-').reverse().join('/');

export const horaAtual = () => {const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
