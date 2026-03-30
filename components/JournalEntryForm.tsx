"use client";

import { useState } from "react";

interface Neighbourhood {
  id: string;
  name: string;
  borough: string;
}

interface Props {
  neighbourhoods: Neighbourhood[];
  onSubmit: (data: { neighbourhoodId: string | null; content: string; decision: string | null }) => void;
}

const DECISION_OPTIONS = [
  { value: "no_change", label: "No decision change" },
  { value: "yes", label: "Changed to Yes" },
  { value: "no", label: "Changed to No" },
  { value: "maybe", label: "Changed to Maybe" },
];

export default function JournalEntryForm({ neighbourhoods, onSubmit }: Props) {
  const [neighbourhoodId, setNeighbourhoodId] = useState<string>("");
  const [decision, setDecision] = useState<string>("no_change");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        neighbourhoodId: neighbourhoodId || null,
        content: content.trim(),
        decision: neighbourhoodId && decision !== "no_change" ? decision : null,
      });
      setNeighbourhoodId("");
      setDecision("no_change");
      setContent("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 space-y-3">
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">New Entry</h2>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-[var(--text-muted)]">Neighbourhood</label>
          <select
            value={neighbourhoodId}
            onChange={(e) => { setNeighbourhoodId(e.target.value); setDecision("no_change"); }}
            className="w-full rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="">General note</option>
            {neighbourhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.borough})
              </option>
            ))}
          </select>
        </div>

        {neighbourhoodId && (
          <div className="flex-1">
            <label className="mb-1 block text-xs text-[var(--text-muted)]">Decision</label>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="w-full rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              {DECISION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--text-muted)]">Notes</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="Write your thoughts..."
          className="w-full rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Saving..." : "Add Entry"}
        </button>
      </div>
    </form>
  );
}
