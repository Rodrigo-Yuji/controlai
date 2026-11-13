import {createContext} from 'react';

export const SettingsSearch = createContext('');

export function normalizeSetting(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim();
}
