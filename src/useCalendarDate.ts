import {useEffect,useState} from 'react';
import {hoje} from './utils';
// Refresh the budget when a day changes, even if the app stayed open overnight.
export function useCalendarDate(){const [date,setDate]=useState(hoje);useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')setDate(hoje());};const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[]);return date;}
