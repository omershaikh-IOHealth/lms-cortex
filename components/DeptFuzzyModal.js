'use client';
import { useState } from 'react';

// Levenshtein distance
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

export function fuzzyMatch(input, candidates, threshold = 0.75) {
  const a = (input || '').toLowerCase().trim();
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const b = (c || '').toLowerCase().trim();
    if (a === b) return { match: c, score: 1 };
    const longer = Math.max(a.length, b.length);
    if (longer === 0) continue;
    const score = (longer - levenshtein(a, b)) / longer;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (bestScore >= threshold) return { match: best, score: bestScore };
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────
// ambiguousRows: [{rowIndex, rowEmail, inputDept, suggestion: string|null}]
// onResolve: (decisions: [{rowIndex, action:'use_suggestion'|'skip', resolvedDept: string|null}]) => void
export default function DeptFuzzyModal({ ambiguousRows, onResolve, onCancel }) {
  const [decisions, setDecisions] = useState(() =>
    ambiguousRows.map(r => ({
      rowIndex:    r.rowIndex,
      action:      r.suggestion ? 'use_suggestion' : 'skip',
      resolvedDept: r.suggestion || null,
    }))
  );

  const setAction = (i, action, suggestion) => {
    setDecisions(prev => prev.map((d, idx) =>
      idx === i
        ? { ...d, action, resolvedDept: action === 'use_suggestion' ? suggestion : null }
        : d
    ));
  };

  const handleApply = () => onResolve(decisions);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl flex flex-col"
        style={{ width: 'min(95vw, 640px)', maxHeight: '80vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border flex-shrink-0">
          <div>
            <h2 className="font-semibold text-cortex-text">Department Name Issues</h2>
            <p className="text-xs text-cortex-muted mt-0.5">Some department names didn't match exactly. Review each row below.</p>
          </div>
          <button onClick={onCancel} className="text-cortex-muted hover:text-cortex-text transition">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
          {ambiguousRows.map((r, i) => (
            <div key={i} className="border border-cortex-border rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono text-cortex-muted">Row {r.rowIndex + 1}</span>
                <span className="text-xs text-cortex-text font-medium truncate">{r.rowEmail}</span>
              </div>
              <div className="text-xs text-cortex-muted">
                Department entered: <span className="font-mono text-amber-400">&quot;{r.inputDept}&quot;</span>
                {r.suggestion && (
                  <> → Did you mean <span className="font-mono text-green-400">&quot;{r.suggestion}&quot;</span>?</>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {r.suggestion && (
                  <button
                    onClick={() => setAction(i, 'use_suggestion', r.suggestion)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                      decisions[i].action === 'use_suggestion'
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'border-cortex-border text-cortex-muted hover:bg-cortex-bg'
                    }`}>
                    Use &quot;{r.suggestion}&quot;
                  </button>
                )}
                <button
                  onClick={() => setAction(i, 'skip', null)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    decisions[i].action === 'skip'
                      ? 'bg-cortex-danger border-cortex-danger text-white'
                      : 'border-cortex-border text-cortex-muted hover:bg-cortex-bg'
                  }`}>
                  Skip this row
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-cortex-border flex items-center justify-end gap-3">
          <button onClick={onCancel}
            className="px-4 py-2 border border-cortex-border rounded-lg text-sm text-cortex-muted hover:bg-cortex-bg transition">
            Cancel Upload
          </button>
          <button onClick={handleApply}
            className="px-5 py-2 bg-cortex-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
            Apply &amp; Continue Import
          </button>
        </div>
      </div>
    </div>
  );
}
