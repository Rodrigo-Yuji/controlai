import {useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
export default function PullToRefresh(){
 const [distance,setDistance]=useState(0),[refreshing,setRefreshing]=useState(false),[message,setMessage]=useState('');
 const gesture=useRef<{x:number;y:number;distance:number}|null>(null),busy=useRef(false);
 useEffect(()=>{
  const start=(e:TouchEvent)=>{if(document.querySelector('[role="dialog"]')||busy.current||e.touches.length!==1||window.innerWidth>900||window.scrollY>0||(e.target as Element)?.closest('input,textarea,select,button,[role="dialog"]'))return;gesture.current={x:e.touches[0].clientX,y:e.touches[0].clientY,distance:0};};
  const move=(e:TouchEvent)=>{const g=gesture.current;if(!g||e.touches.length!==1)return;const y=e.touches[0].clientY-g.y,x=Math.abs(e.touches[0].clientX-g.x);if(y<=0||x>y||window.scrollY>0){gesture.current=null;setDistance(0);return;}g.distance=Math.min(110,y*.55);if(g.distance>8&&e.cancelable)e.preventDefault();setDistance(g.distance);};
  const end=()=>{const g=gesture.current;gesture.current=null;setDistance(0);if(!g||g.distance<65||busy.current)return;busy.current=true;setRefreshing(true);setMessage('');
   const sync=new Promise<void>(resolve=>{let settled=false;const done=()=>{if(!settled){settled=true;resolve();}};window.dispatchEvent(new CustomEvent('controlai-refresh',{detail:{done}}));setTimeout(done,16000);});
   const update=navigator.serviceWorker?.getRegistration().then(registration=>registration?.update()).catch(()=>undefined);
   Promise.all([sync,update]).then(()=>setMessage('Atualização concluída. Confira o estado da sincronização.')).finally(()=>{busy.current=false;setRefreshing(false);setTimeout(()=>setMessage(''),3500);});
  };
  const cancel=()=>{gesture.current=null;setDistance(0);};
  document.addEventListener('touchstart',start,{passive:true});document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',end);document.addEventListener('touchcancel',cancel);
  return()=>{document.removeEventListener('touchstart',start);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);document.removeEventListener('touchcancel',cancel);};
 },[]);
 if(!distance&&!refreshing&&!message)return null;
 return <div className="pull-refresh" role="status"><RefreshCw size={18} className={refreshing?'spinning':''}/>{refreshing?'Atualizando dados…':message|| (distance>=65?'Solte para atualizar':'Puxe para atualizar')}</div>;
}
