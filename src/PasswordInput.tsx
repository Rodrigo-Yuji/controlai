import {useState,type InputHTMLAttributes} from 'react';
import {Eye,EyeOff} from 'lucide-react';
export default function PasswordInput(props:Omit<InputHTMLAttributes<HTMLInputElement>,'type'>){const [visible,setVisible]=useState(false);return <span className="password-input"><input {...props} type={visible?'text':'password'}/><button type="button" aria-label={visible?'Esconder senha':'Visualizar senha'} aria-pressed={visible} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></span>;}
