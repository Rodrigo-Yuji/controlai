import {useContext, type ReactNode} from 'react';
import {normalizeSetting, SettingsSearch} from './settings-search';

export default function SettingsSection({
  title, keywords = '', children, initialOpen = false,
}: {title: string; keywords?: string; children: ReactNode; initialOpen?: boolean}) {
  const query = useContext(SettingsSearch);
  const searchable = normalizeSetting(title + ' ' + keywords);
  const match = !query || query.split(/\s+/).every(word => searchable.includes(word));

  return <details className="panel settings-section" hidden={!match} open={initialOpen || Boolean(query && match) || undefined}>
    <summary>{title}</summary>
    <div className="settings-content">{children}</div>
  </details>;
}
