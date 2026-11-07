export function expenseWeight(expenses:number,income:number){return income>0?expenses/income*100:null;}
export function expenseWeightText(expenses:number,income:number){const ratio=expenseWeight(expenses,income);return ratio===null?'Sem receitas recebidas':ratio.toLocaleString('pt-BR',{maximumFractionDigits:2})+'% das receitas recebidas';}
