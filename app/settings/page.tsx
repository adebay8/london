"use client";

import { useState, useEffect } from "react";

interface SettingsData {
  settings: Record<string, string>;
  apiKeyStatus: { perplexity: boolean; anthropic: boolean; openai: boolean; googlePlaces: boolean };
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setData);
  }, []);

  const provider = data?.settings.analysisProvider ?? "openai";

  async function setProvider(value: string) {
    if (!data) return;
    setSaving(true);
    setData({ ...data, settings: { ...data.settings, analysisProvider: value } });
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "analysisProvider", value }),
    });
    setSaving(false);
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-8 text-2xl font-bold text-[var(--text-primary)]">Settings</h1>

      {/* Analysis Provider */}
      <section className="mb-8 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
          Analysis Model
        </h2>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Choose which LLM to use for neighbourhood analysis. Perplexity Sonar is always used for data gathering.
        </p>
        <div className="flex gap-3">
          {[
            { value: "openai", label: "OpenAI", model: "GPT-4o", icon: "🤖" },
            { value: "claude", label: "Claude", model: "Sonnet", icon: "🧠" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setProvider(opt.value)}
              disabled={saving}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                provider === opt.value
                  ? "border-[var(--accent)] bg-[var(--status-info-bg)]"
                  : "border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--text-muted)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{opt.icon}</span>
                <span className="font-medium text-[var(--text-primary)]">{opt.label}</span>
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">{opt.model}</div>
            </button>
          ))}
        </div>
      </section>

      {/* API Key Status */}
      <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
          API Keys
        </h2>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Set API keys in your <code className="rounded bg-[var(--bg-tertiary)] px-1 py-0.5 text-xs">.env.local</code> file.
        </p>
        <div className="space-y-2">
          {[
            { name: "Perplexity", env: "PERPLEXITY_API_KEY", configured: data.apiKeyStatus.perplexity },
            { name: "Anthropic (Claude)", env: "ANTHROPIC_API_KEY", configured: data.apiKeyStatus.anthropic },
            { name: "OpenAI", env: "OPENAI_API_KEY", configured: data.apiKeyStatus.openai },
            { name: "Google Places", env: "GOOGLE_PLACES_API_KEY", configured: data.apiKeyStatus.googlePlaces },
          ].map((key) => (
            <div key={key.name} className="flex items-center justify-between rounded-lg bg-[var(--bg-secondary)] px-4 py-3">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">{key.name}</div>
                <div className="text-xs font-mono text-[var(--text-muted)]">{key.env}</div>
              </div>
              <span className={`text-sm font-semibold ${key.configured ? "text-[var(--status-yes)]" : "text-[var(--status-no)]"}`}>
                {key.configured ? "Configured" : "Not set"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
