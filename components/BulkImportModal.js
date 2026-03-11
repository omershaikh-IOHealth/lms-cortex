'use client';
import { useState, useRef, useCallback } from 'react';

// ─── CSV/XLSX parser ─────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 1) return [];
  // Handle quoted commas
  const splitLine = (line) => {
    const result = [];
    let current = '';
    let inQuote  = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  };
  const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = splitLine(line);
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] ?? '' }), {});
  });
}

async function parseXLSX(file) {
  const xlsxMod = await import('xlsx');
  const XLSX = xlsxMod.default ?? xlsxMod;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        // Normalize header keys to lowercase_underscore
        const normalised = rows.map(r =>
          Object.fromEntries(
            Object.entries(r).map(([k, v]) => [k.toLowerCase().replace(/\s+/g, '_'), String(v)])
          )
        );
        resolve(normalised);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

function downloadCSV(filename, headers, sampleRow = null) {
  const headerLine = headers.map(h => h.label).join(',');
  const rows = sampleRow ? [sampleRow.join(',')] : [];
  const blob = new Blob([headerLine + (rows.length ? '\n' + rows.join('\n') : '')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Cell editors ─────────────────────────────────────────────────────────────
function CellInput({ value, onChange, type = 'text', placeholder }) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full min-w-[80px] bg-transparent border-0 outline-none text-cortex-text text-xs px-1 py-0.5 placeholder:text-cortex-border"
    />
  );
}

function CellSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-transparent border-0 outline-none text-cortex-text text-xs px-0.5 py-0.5 cursor-pointer appearance-none">
      <option value="">—</option>
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BulkImportModal({
  title,
  columns,           // [{key, label, required, type:'text'|'select'|'password', options, placeholder, csvKey}]
  onClose,
  onImport,          // async (rows, extras) => { results, succeeded, total }
  templateFilename,
  templateSample,    // array of sample values in column order
  extras,            // extra fields above the table (e.g., default_password)
}) {
  const [step, setStep]       = useState('table'); // 'table' | 'importing' | 'results'
  const [rows, setRows]       = useState(() => [makeEmptyRow(columns)]);
  const [extraVals, setExtraVals] = useState(() =>
    (extras || []).reduce((a, e) => ({ ...a, [e.key]: e.defaultValue ?? '' }), {})
  );
  const [isDragging, setIsDragging] = useState(false);
  const [fileError,  setFileError]  = useState('');
  const [importing,  setImporting]  = useState(false);
  const [results,    setResults]    = useState(null);
  const fileRef = useRef();

  function makeEmptyRow(cols) {
    return cols.reduce((obj, c) => ({ ...obj, [c.key]: c.defaultValue ?? '' }), {});
  }

  const updateCell = (rowIdx, key, val) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [key]: val } : r));
  };

  const addRow = () => setRows(prev => [...prev, makeEmptyRow(columns)]);

  const deleteRow = (idx) => setRows(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));

  const handleFile = async (file) => {
    setFileError('');
    try {
      let parsed;
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        parsed = parseCSV(text);
      } else if (file.name.match(/\.xlsx?$/i)) {
        parsed = await parseXLSX(file);
      } else {
        setFileError('Only CSV and XLSX files are supported.');
        return;
      }
      if (!parsed.length) { setFileError('File is empty or could not be parsed.'); return; }
      // Map parsed rows to column keys
      const mapped = parsed.map(pr => {
        const row = makeEmptyRow(columns);
        columns.forEach(col => {
          const csvKey = col.csvKey || col.key;
          const aliases = [csvKey, col.label.toLowerCase().replace(/\s+/g, '_'), col.label.toLowerCase()];
          for (const alias of aliases) {
            if (pr[alias] !== undefined && pr[alias] !== '') { row[col.key] = String(pr[alias]); break; }
          }
        });
        return row;
      });
      setRows(mapped);
    } catch (err) {
      setFileError('Failed to parse file: ' + err.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    const nonEmpty = rows.filter(r => {
      const requiredKeys = columns.filter(c => c.required).map(c => c.key);
      return requiredKeys.some(k => r[k]?.trim?.());
    });
    if (!nonEmpty.length) return;

    setImporting(true); setStep('importing');
    try {
      const res = await onImport(nonEmpty, extraVals);
      setResults(res);
      setStep('results');
    } catch (err) {
      setFileError('Import failed: ' + err.message);
      setStep('table');
    } finally {
      setImporting(false);
    }
  };

  const nonEmptyCount = rows.filter(r => columns.filter(c => c.required).some(c => r[c.key]?.trim?.())).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl flex flex-col"
        style={{ width: 'min(95vw, 1100px)', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border flex-shrink-0">
          <div>
            <h2 className="font-semibold text-cortex-text">{title}</h2>
            <p className="text-xs text-cortex-muted mt-0.5">Fill the table manually or upload a CSV / XLSX file to pre-populate it</p>
          </div>
          <button onClick={onClose} className="text-cortex-muted hover:text-cortex-text transition">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {step !== 'results' && (
            <div className="px-6 pt-4 pb-3 flex-shrink-0 space-y-3">
              {/* Upload zone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition flex items-center gap-4 ${isDragging ? 'border-cortex-accent bg-cortex-accent/5' : 'border-cortex-border hover:border-cortex-accent/50 hover:bg-cortex-bg'}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cortex-muted flex-shrink-0">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-cortex-text font-medium">Drop a CSV or XLSX file here, or click to browse</p>
                  <p className="text-xs text-cortex-muted mt-0.5">The file will pre-fill the table below. You can still edit the rows before importing.</p>
                </div>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); downloadCSV(templateFilename, columns, templateSample); }}
                  className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-muted hover:text-cortex-text hover:bg-cortex-bg transition whitespace-nowrap">
                  ↓ Download template
                </button>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                  onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
              </div>

              {fileError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-red-600 dark:text-red-400 text-sm">
                  {fileError}
                </div>
              )}

              {/* Extra fields (e.g., default password) */}
              {extras?.length > 0 && (
                <div className="flex items-center gap-4 flex-wrap">
                  {extras.map(ext => (
                    <div key={ext.key} className="flex items-center gap-2">
                      <label className="text-xs font-medium text-cortex-muted whitespace-nowrap">{ext.label}</label>
                      <input
                        type={ext.type || 'text'}
                        value={extraVals[ext.key] || ''}
                        onChange={e => setExtraVals(p => ({ ...p, [ext.key]: e.target.value }))}
                        placeholder={ext.placeholder || ''}
                        className="bg-cortex-bg border border-cortex-border rounded-lg px-3 py-1.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent w-48"
                      />
                      {ext.hint && <span className="text-[11px] text-cortex-muted">{ext.hint}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Table */}
          {step !== 'results' && (
            <div className="flex-1 overflow-auto px-6 pb-4">
              <table className="w-full text-xs border-separate" style={{ borderSpacing: 0 }}>
                <thead className="sticky top-0 z-10 bg-cortex-surface">
                  <tr>
                    <th className="text-left py-2 pr-2 text-cortex-muted font-medium w-8">#</th>
                    {columns.map(col => (
                      <th key={col.key} className="text-left py-2 px-2 text-cortex-muted font-medium whitespace-nowrap">
                        {col.label}
                        {col.required && <span className="text-cortex-accent ml-0.5">*</span>}
                      </th>
                    ))}
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} className="group">
                      <td className="py-0.5 pr-2 text-cortex-muted text-[11px] align-middle">{ri + 1}</td>
                      {columns.map(col => (
                        <td key={col.key}
                          className="py-0.5 px-1 border border-cortex-border align-middle bg-cortex-bg first:rounded-l last:rounded-r"
                          style={{ minWidth: col.minWidth || 100, maxWidth: col.maxWidth || 200 }}>
                          {col.type === 'select' ? (
                            <CellSelect
                              value={row[col.key]}
                              onChange={v => updateCell(ri, col.key, v)}
                              options={typeof col.options === 'function' ? col.options(row) : col.options}
                            />
                          ) : (
                            <CellInput
                              type={col.type || 'text'}
                              value={row[col.key]}
                              onChange={v => updateCell(ri, col.key, v)}
                              placeholder={col.placeholder || col.label}
                            />
                          )}
                        </td>
                      ))}
                      <td className="py-0.5 pl-1 align-middle">
                        <button onClick={() => deleteRow(ri)}
                          className="opacity-0 group-hover:opacity-100 text-cortex-muted hover:text-cortex-danger transition w-5 h-5 flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button onClick={addRow}
                className="mt-3 text-xs text-cortex-muted hover:text-cortex-text border border-dashed border-cortex-border hover:border-cortex-accent rounded-lg px-4 py-2 transition w-full">
                + Add row
              </button>
            </div>
          )}

          {/* Importing progress */}
          {step === 'importing' && (
            <div className="flex-1 flex items-center justify-center flex-col gap-3 py-12">
              <div className="w-8 h-8 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-cortex-muted text-sm">Importing {nonEmptyCount} rows…</p>
            </div>
          )}

          {/* Results */}
          {step === 'results' && results && (
            <div className="flex-1 overflow-auto px-6 py-4">
              {/* Summary banner */}
              <div className={`rounded-xl px-5 py-3 mb-3 flex items-center gap-3 ${
                results.succeeded === results.total
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : results.succeeded === 0
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
              }`}>
                <div className="text-2xl">
                  {results.succeeded === results.total ? '✅' : results.succeeded === 0 ? '❌' : '⚠️'}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-cortex-text">
                    {results.succeeded} of {results.total} rows imported successfully
                  </div>
                  {results.succeeded < results.total && (
                    <div className="text-xs text-cortex-muted mt-0.5">
                      {results.total - results.succeeded} row(s) failed — see details below
                    </div>
                  )}
                </div>
                {(results.emailsSent !== undefined) && (
                  <div className="flex gap-2 flex-shrink-0">
                    {results.emailsSent > 0 && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                        ✉ {results.emailsSent} invited
                      </span>
                    )}
                    {results.emailsFailed > 0 && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium">
                        ✉ {results.emailsFailed} email failed
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Per-row results */}
              <div className="space-y-1.5">
                {results.results?.map((r, i) => (
                  <div key={i} className={`flex items-start gap-3 px-4 py-2.5 rounded-lg text-sm border ${
                    r.success
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30'
                      : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'
                  }`}>
                    <span className="flex-shrink-0 font-mono text-[11px] text-cortex-muted w-8">#{r.row}</span>
                    <span className={`font-medium flex-shrink-0 ${r.success ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {r.success ? '✓' : '✗'}
                    </span>
                    <span className="text-cortex-muted truncate">{r.email || r.name || '—'}</span>
                    {r.success && r.emailSent === false && (
                      <span className="text-orange-500 text-[11px] flex-shrink-0 ml-auto">
                        ✉ Email failed{r.emailError ? ` — ${r.emailError}` : ''}
                      </span>
                    )}
                    {r.success && r.emailSent === true && (
                      <span className="text-blue-500 text-[11px] flex-shrink-0 ml-auto">✉ Invited</span>
                    )}
                    {!r.success && <span className="text-red-500 text-xs ml-auto flex-shrink-0">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-cortex-border flex items-center justify-between gap-3">
          <div className="text-xs text-cortex-muted">
            {step === 'table' && `${rows.length} row${rows.length !== 1 ? 's' : ''} · ${nonEmptyCount} filled`}
            {step === 'results' && results && `${results.succeeded}/${results.total} imported`}
          </div>
          <div className="flex gap-3">
            {step === 'results' ? (
              <>
                <button onClick={() => { setStep('table'); setRows([makeEmptyRow(columns)]); setResults(null); }}
                  className="px-4 py-2 border border-cortex-border rounded-lg text-sm text-cortex-muted hover:bg-cortex-bg transition">
                  Import More
                </button>
                <button onClick={onClose}
                  className="px-4 py-2 bg-cortex-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
                  Done
                </button>
              </>
            ) : (
              <>
                <button onClick={onClose}
                  className="px-4 py-2 border border-cortex-border rounded-lg text-sm text-cortex-muted hover:bg-cortex-bg transition">
                  Cancel
                </button>
                <button onClick={handleImport} disabled={importing || nonEmptyCount === 0}
                  className="px-5 py-2 bg-cortex-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                  {importing ? 'Importing…' : `Import ${nonEmptyCount} row${nonEmptyCount !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
