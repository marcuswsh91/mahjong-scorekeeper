import { useRef, useState } from 'react';
import { backupFileName, buildBackup, describeMerge, loadLastBackup, mergeBackup, parseBackup, saveLastBackup } from '../storage/backup';
import type { KV } from '../storage/store';

/**
 * Save the file: the phone's share sheet when it can share files (AirDrop, Save to Files,
 * Messages…), otherwise a normal download.
 */
async function shareOrDownload(name: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Mahjong score keeper backup' });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // any other share failure: fall through to a download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

export function BackupCard({ kv, sessionCount, onImported }: { kv: KV; sessionCount: number; onImported: () => void }) {
  const [last, setLast] = useState(loadLastBackup(kv));
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const exportNow = async () => {
    const now = new Date();
    const backup = buildBackup(kv, now);
    const r = await shareOrDownload(backupFileName(now), JSON.stringify(backup));
    if (r === 'cancelled') { setMessage({ text: 'Backup cancelled; nothing was saved.' }); return; }
    saveLastBackup(kv, now.toISOString());
    setLast(now.toISOString());
    setMessage({ text: `Backed up ${backup.sessions.length} session${backup.sessions.length === 1 ? '' : 's'}. Keep the file somewhere off this phone (Files, iCloud, AirDrop to another device).` });
  };

  const importFile = async (f: File | undefined) => {
    if (!f) return;
    const parsed = parseBackup(await f.text());
    if (!parsed.ok) { setMessage({ text: parsed.error, bad: true }); return; }
    setMessage({ text: describeMerge(mergeBackup(kv, parsed.backup)) });
    onImported();
  };

  const stale = sessionCount > 0 && (!last || Date.now() - Date.parse(last) > 7 * 24 * 3600 * 1000);
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Backup 備份</h3>
      <p className={stale ? 'note' : 'muted small'}>
        {last ? `Last backup: ${new Date(last).toLocaleString()}.` : 'Never backed up.'} Scores are saved only on this phone.
      </p>
      <div className="row">
        <button className="primary" onClick={() => { void exportNow(); }}>Export backup</button>
        <button onClick={() => input.current?.click()}>Import backup</button>
        <input ref={input} type="file" accept="application/json,.json" hidden
          onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <p className="muted small">Import adds sessions this phone doesn't have and newer hands of ones it does. It never deletes or overwrites what's here.</p>
      {message && <p className={message.bad ? 'alert' : 'small'}>{message.text}</p>}
    </div>
  );
}
