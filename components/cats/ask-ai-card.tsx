'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Sparkles, Send, ChevronDown, ChevronRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type AskResponse = {
  answer: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
  context: string;
};

const SUGGESTIONS_KEYS = ['weight', 'diet', 'followup', 'concerns'] as const;

export function AskAICard({ catId, catName }: { catId: string; catName: string }) {
  const t = useTranslations('askAi');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [contextOpen, setContextOpen] = useState(false);

  const ask = useMutation({
    mutationFn: async (q: string): Promise<AskResponse> => {
      const r = await fetch(`/api/cats/${catId}/ask-ai`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q })
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Failed');
      return body;
    },
    onSuccess: (data) => setAnswer(data),
    onError: (e: Error) => toast.error(e.message)
  });

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setAnswer(null);
    ask.mutate(trimmed);
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(question);
          }}
          className="space-y-2"
        >
          <Textarea
            rows={3}
            placeholder={t('placeholder')}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={ask.isPending}
          />
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                disabled={ask.isPending}
                onClick={() => submit(t(`suggestions.${k}`))}
                className="text-xs px-2 py-1 rounded-full border border-fuchsia-200 bg-white text-fuchsia-700 hover:bg-fuchsia-50 dark:bg-transparent dark:border-fuchsia-900 dark:text-fuchsia-300 dark:hover:bg-fuchsia-950/40 disabled:opacity-50"
              >
                {t(`suggestions.${k}`)}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={ask.isPending || !question.trim()}
              className="bg-fuchsia-500 text-white shadow hover:bg-fuchsia-600"
            >
              <Send className="h-4 w-4" />
              {ask.isPending ? t('thinking') : t('ask')}
            </Button>
          </div>
        </form>

        {ask.isPending && <p className="text-sm text-muted-foreground">{t('thinkingHint')}</p>}

        {answer && (
          <div className="space-y-2">
            <div className="rounded-md border bg-background p-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer.answer}</p>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t('meta', {
                model: answer.model,
                inTokens: answer.usage.input_tokens,
                outTokens: answer.usage.output_tokens,
                cached: answer.usage.cache_read_input_tokens
              })}
            </div>
            <button
              type="button"
              onClick={() => setContextOpen((o) => !o)}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {contextOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {t('showContext')}
            </button>
            {contextOpen && (
              <pre className="whitespace-pre-wrap text-[11px] leading-snug rounded-md bg-muted/40 p-2 max-h-64 overflow-auto">
                {answer.context}
              </pre>
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground italic">{t('disclaimer')}</p>
      </CardContent>
    </Card>
  );
}
