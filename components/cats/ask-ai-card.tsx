'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Sparkles, ExternalLink, Copy, ChevronDown, ChevronRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type AIDestination = 'chatgpt' | 'claude' | 'gemini';

// chatgpt.com and claude.ai both support ?q= pre-fill for shortish prompts,
// but full cat records routinely blow past safe URL length. Clipboard is the
// reliable path; the `?q=` hint is only a nicety for short follow-ups.
const DESTINATIONS: Record<AIDestination, { label: string; url: (q: string) => string }> = {
  chatgpt: {
    label: 'ChatGPT',
    url: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`
  },
  claude: {
    label: 'Claude',
    url: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`
  },
  gemini: {
    label: 'Gemini',
    url: () => 'https://gemini.google.com/'
  }
};

// URL-prefill quietly truncates past a few KB in some browsers — keep it short.
const URL_PREFILL_MAX = 1500;

const SUGGESTIONS_KEYS = ['weight', 'diet', 'followup', 'concerns'] as const;

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function AskAICard({ catId, catName }: { catId: string; catName: string }) {
  const t = useTranslations('askAi');
  const [question, setQuestion] = useState('');
  const [destination, setDestination] = useState<AIDestination>('chatgpt');
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchPrompt = useMutation({
    mutationFn: async (q: string): Promise<string> => {
      const r = await fetch(`/api/cats/${catId}/ai-prompt`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q })
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Failed');
      return body.prompt as string;
    },
    onError: (e: Error) => toast.error(e.message)
  });

  async function handleOpen() {
    const q = question.trim();
    if (!q) return;
    try {
      const prompt = await fetchPrompt.mutateAsync(q);
      setLastPrompt(prompt);
      const copied = await copyToClipboard(prompt);
      const dest = DESTINATIONS[destination];
      const url =
        prompt.length <= URL_PREFILL_MAX && destination !== 'gemini'
          ? dest.url(prompt)
          : dest.url('');
      window.open(url, '_blank', 'noopener,noreferrer');
      if (copied) toast.success(t('copiedAndOpened', { dest: dest.label }));
      else toast.message(t('openedNoCopy', { dest: dest.label }));
    } catch {
      // error toast already shown in onError
    }
  }

  async function handleCopy() {
    const q = question.trim();
    if (!q) return;
    try {
      const prompt = await fetchPrompt.mutateAsync(q);
      setLastPrompt(prompt);
      const copied = await copyToClipboard(prompt);
      if (copied) toast.success(t('copied'));
      else toast.error(t('copyFailed'));
    } catch {
      /* onError already toasted */
    }
  }

  return (
    <Card className="md:col-span-2 overflow-hidden border-l-4 border-l-fuchsia-400 bg-gradient-to-r from-fuchsia-50/50 to-transparent dark:from-fuchsia-950/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-fuchsia-500" />
          {t('title')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t('subtitle', { name: catName })}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={3}
          placeholder={t('placeholder')}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setQuestion(t(`suggestions.${k}`))}
              className="text-xs px-2 py-1 rounded-full border border-fuchsia-200 bg-white text-fuchsia-700 hover:bg-fuchsia-50 dark:bg-transparent dark:border-fuchsia-900 dark:text-fuchsia-300 dark:hover:bg-fuchsia-950/40"
            >
              {t(`suggestions.${k}`)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">{t('destLabel')}</span>
            {(Object.keys(DESTINATIONS) as AIDestination[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDestination(d)}
                className={
                  'px-2 py-0.5 rounded-md border ' +
                  (destination === d
                    ? 'bg-fuchsia-500 border-fuchsia-500 text-white'
                    : 'bg-white dark:bg-transparent border-muted text-foreground hover:bg-muted/30')
                }
              >
                {DESTINATIONS[d].label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              disabled={!question.trim() || fetchPrompt.isPending}
            >
              <Copy className="h-4 w-4" /> {t('copyPrompt')}
            </Button>
            <Button
              type="button"
              onClick={handleOpen}
              disabled={!question.trim() || fetchPrompt.isPending}
              className="bg-fuchsia-500 text-white shadow hover:bg-fuchsia-600"
            >
              <ExternalLink className="h-4 w-4" />
              {fetchPrompt.isPending ? t('preparing') : t('openIn', { dest: DESTINATIONS[destination].label })}
            </Button>
          </div>
        </div>

        {lastPrompt && (
          <div className="space-y-1 pt-1">
            <button
              type="button"
              onClick={() => setPreviewOpen((o) => !o)}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {previewOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {t('showPrompt')}
            </button>
            {previewOpen && (
              <pre className="whitespace-pre-wrap text-[11px] leading-snug rounded-md bg-muted/40 p-2 max-h-64 overflow-auto">
                {lastPrompt}
              </pre>
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground italic">{t('disclaimer')}</p>
      </CardContent>
    </Card>
  );
}
