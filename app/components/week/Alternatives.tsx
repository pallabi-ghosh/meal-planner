"use client";

import type { DinnerIdea } from "@/lib/dishes";
import { formatKcal } from "@/lib/calories";
import { toddlerBadge } from "@/lib/toddler";

export interface Alternative extends DinnerIdea {
  issues: string[]; // why it isn't toddler-safe; empty when fine
}

// Three other dinners for the same night, each one tap to use.
export default function Alternatives({
  title,
  ideas,
  loading,
  note,
  busy,
  onUse,
  onMore,
  onClose,
}: {
  title: string;
  ideas: Alternative[];
  loading: boolean;
  note: string | null;
  busy: boolean;
  onUse: (idea: Alternative) => void;
  onMore: () => void;
  onClose: () => void;
}) {
  return (
    <div className="card alt-card" aria-live="polite">
      <div className="alt-head">
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div className="alt-actions">
          <button type="button" className="link-btn" disabled={loading} onClick={onMore}>
            Show others
          </button>
          <button type="button" className="link-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {loading ? (
        <div className="small">Finding ideas…</div>
      ) : (
        <div className="alt-grid">
          {ideas.map((idea) => (
            <div key={idea.dish} className="alt-item">
              <div style={{ fontWeight: 500 }}>{idea.dish}</div>
              <div className="small">
                {[idea.cuisine, idea.kcal ? `${formatKcal(idea.kcal)} kcal` : null].filter(Boolean).join(" · ")}
              </div>
              <div className={`small${idea.issues.length > 0 ? " warn" : ""}`}>
                {idea.issues.length > 0 ? toddlerBadge(idea.issues) : "Toddler-safe"}
              </div>
              <button type="button" className="btn ghost sm" disabled={busy} onClick={() => onUse(idea)}>
                Use this
              </button>
            </div>
          ))}
        </div>
      )}
      {note ? <div className="small">{note}</div> : null}
    </div>
  );
}
