import { useRef, useState, type DragEvent } from 'react';
import { OPERA_GAME } from '../data/sampleGames';
import { useGameStore } from '../store/gameStore';

export function PgnInput({ onLoaded }: { onLoaded?: () => void }) {
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { loadPgnText, selectCandidate, candidates, error } = useGameStore();

  const load = (pgn: string) => {
    loadPgnText(pgn);
    const s = useGameStore.getState();
    if (!s.error && s.candidates.length === 0) onLoaded?.();
  };

  const readFile = async (file: File) => {
    const content = await file.text();
    setText(content);
    load(content);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
    else {
      const dropped = e.dataTransfer.getData('text');
      if (dropped) {
        setText(dropped);
        load(dropped);
      }
    }
  };

  return (
    <div
      className={`space-y-3 rounded-lg border-2 border-dashed p-3 transition ${
        dragging ? 'border-sky-400 bg-sky-500/10' : 'border-slate-700'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="PGN metnini buraya yapıştırın ya da .pgn dosyasını sürükleyip bırakın…"
        spellCheck={false}
        className="h-32 w-full resize-y rounded-md bg-slate-950 p-2 font-mono text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => load(text)}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500"
        >
          Yükle
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
        >
          Dosya seç (.pgn)
        </button>
        <button
          type="button"
          onClick={() => {
            setText(OPERA_GAME);
            load(OPERA_GAME);
          }}
          className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
        >
          Örnek oyun yükle
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pgn,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {candidates.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm text-slate-300">Dosyada {candidates.length} oyun var, birini seçin:</p>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {candidates.map((c, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => {
                    selectCandidate(i);
                    if (c.game) onLoaded?.();
                  }}
                  className="w-full rounded-md bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-700"
                >
                  <span className="text-slate-100">
                    {i + 1}. {c.headers.White ?? '?'} – {c.headers.Black ?? '?'}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">
                    {[c.headers.Result, c.headers.Date, c.headers.Event].filter(Boolean).join(' · ')}
                  </span>
                  {c.error && <span className="block text-xs text-red-300">Hatalı: {c.error}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
