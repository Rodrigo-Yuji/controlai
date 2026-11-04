import { Capacitor } from '@capacitor/core';

export async function exportBackupFile(contents: string, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const [{Filesystem, Directory, Encoding}, {Share}] = await Promise.all([
      import('@capacitor/filesystem'), import('@capacitor/share'),
    ]);
    const file = await Filesystem.writeFile({path:`backups/${filename}`, data:contents, directory:Directory.Cache, encoding:Encoding.UTF8, recursive:true});
    await Share.share({title:'Backup do ControlAI', dialogTitle:'Salvar ou compartilhar backup', files:[file.uri]});
    return;
  }
  const url = URL.createObjectURL(new Blob([contents], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
