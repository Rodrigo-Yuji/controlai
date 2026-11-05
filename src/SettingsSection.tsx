import type {ReactNode} from 'react';
export default function SettingsSection({title,children,initialOpen=false}:{title:string;children:ReactNode;initialOpen?:boolean}){
 return <details className="panel settings-section" open={initialOpen||undefined}><summary>{title}</summary><div className="settings-content">{children}</div></details>;
}
