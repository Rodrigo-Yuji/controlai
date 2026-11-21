import {useLayoutEffect,useRef,useState} from 'react';

// Observação com quebras de linha preservadas, exibida em até duas linhas.
// Quando o texto passa disso, um toque em "ver mais" mostra tudo.
export default function NoteText({text,className='recordnote'}:{text:string;className?:string}){
 const ref=useRef<HTMLParagraphElement>(null),[open,setOpen]=useState(false),[long,setLong]=useState(false);
 useLayoutEffect(()=>{const el=ref.current;if(el&&!open)setLong(el.scrollHeight>el.clientHeight+1);},[text,open]);
 return <div className={`${className} note-block`}>
  <p ref={ref} className={`note-body${open?'':' note-clamped'}`}>{text}</p>
  {(long||open)&&<button type="button" className="note-toggle" aria-expanded={open} onClick={e=>{e.stopPropagation();setOpen(v=>!v);}}>{open?'ver menos':'ver mais'}</button>}
 </div>;
}
