"""Reject APKs with stale web assets after a failed frontend build or sync."""
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
apk = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'android/app/build/outputs/apk/debug/app-debug.apk'
files = [path for path in (root / 'dist').rglob('*') if path.is_file()]
if not files or not (root / 'dist/index.html').is_file():
    raise SystemExit('FALHA: build web ausente; gere e sincronize a interface nativa primeiro.')
with zipfile.ZipFile(apk) as archive:
    for path in files:
        name = 'assets/public/' + path.relative_to(root / 'dist').as_posix()
        if name not in archive.namelist() or archive.read(name) != path.read_bytes():
            raise SystemExit(f'FALHA: APK contém interface desatualizada: {name}')
    if any(name in archive.namelist() for name in ['assets/public/sw.js', 'assets/public/registerSW.js']):
        raise SystemExit('FALHA: service worker web não deve ser empacotado no APK nativo.')
    scripts = b''.join(archive.read(name) for name in archive.namelist() if name.startswith('assets/public/assets/') and name.endswith('.js'))
    if b'ControlAI 1.36' not in scripts:
        raise SystemExit('FALHA: versão visível da interface não corresponde à versão atual.')
print(f'OK: {len(files)} arquivos web do APK são idênticos ao build atual; interface ControlAI 1.36 confirmada.')
