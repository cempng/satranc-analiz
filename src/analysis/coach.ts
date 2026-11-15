import type Anthropic from '@anthropic-ai/sdk';
import { MOVE_CLASS_META } from './moveClasses';
import type { MoveComment } from './comments';
import type { MoveClassification } from './classify';
import type { PlyMove } from '../lib/pgn';
import { localSan, t } from '../i18n/core';

export const COACH_MODEL = 'claude-opus-5-5';

export interface CoachInput {
  move: PlyMove;
  info: MoveClassification;
  comment: MoveComment;
}

function buildUserMessage({ move, info, comment }: CoachInput): string {
  const side = t(move.color === 'w' ? 'common.white' : 'common.black');
  return [
    t('coach.fen', { fen: move.fenBefore }),
    t('coach.move', { move: `${move.moveNumber}${move.color === 'w' ? '.' : '...'} ${localSan(move.san)}`, side }),
    t('coach.class', { cls: MOVE_CLASS_META[info.cls].label }),
    t('coach.win', { side, before: Math.round(info.winBefore), after: Math.round(info.winAfter) }),
    comment.evalChange ? t('coach.eval', { eval: comment.evalChange }) : '',
    comment.line ? `${comment.line.label}: ${comment.line.text}` : '',
    t('coach.findings', { text: [comment.headline, ...comment.details].join(' ') }),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Kullanıcının kendi API anahtarıyla tarayıcıdan Claude'a koç yorumu sorar.
 * Anahtar yalnızca bu tarayıcıda saklanır ve doğrudan Anthropic API'sine gönderilir.
 */
export async function fetchCoachComment(apiKey: string, input: CoachInput, signal?: AbortSignal): Promise<string> {
  const { default: AnthropicClient } = await import('@anthropic-ai/sdk');
  const client = new AnthropicClient({ apiKey, dangerouslyAllowBrowser: true });

  try {
    const response = await client.beta.messages.create(
      {
        model: COACH_MODEL,
        max_tokens: 4000,
        output_config: { effort: 'low' },
        // Güvenlik sınıflandırıcısı reddederse istek sunucu tarafında uygun bir modelle yeniden denenir.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: t('coach.system'),
        messages: [{ role: 'user', content: buildUserMessage(input) }],
      },
      { signal },
    );

    if (response.stop_reason === 'refusal') throw new Error(t('coach.err.refusal'));
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (!text) throw new Error(t('coach.err.empty'));
    return text;
  } catch (error) {
    if (error instanceof AnthropicClient.AuthenticationError) throw new Error(t('coach.err.auth'));
    if (error instanceof AnthropicClient.PermissionDeniedError) throw new Error(t('coach.err.permission'));
    if (error instanceof AnthropicClient.RateLimitError) throw new Error(t('coach.err.rate'));
    if (error instanceof AnthropicClient.APIConnectionError) throw new Error(t('coach.err.connection'));
    if (error instanceof AnthropicClient.APIError) throw new Error(t('coach.err.api', { status: error.status ?? '?' }));
    throw error;
  }
}
