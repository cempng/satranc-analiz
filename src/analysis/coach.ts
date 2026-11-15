import type Anthropic from '@anthropic-ai/sdk';
import { MOVE_CLASS_META } from './moveClasses';
import type { MoveComment } from './comments';
import type { MoveClassification } from './classify';
import { toTurkishSan, type PlyMove } from '../lib/pgn';

export const COACH_MODEL = 'claude-opus-5-5';

const SYSTEM_PROMPT = `Sen deneyimli ve sıcak bir satranç koçusun. Öğrencin bir oyununu analiz ediyor.
Sana pozisyonu (FEN), oynanan hamleyi, hamlenin sınıfını ve Stockfish motorunun bulgularını vereceğim.
Görevin: bu hamle hakkında Türkçe, 2-4 cümlelik doğal bir koç yorumu yazmak.
- Hamlenin neden iyi ya da kötü olduğunu fikir düzeyinde açıkla (plan, taş aktivitesi, şah güvenliği, taktik motif).
- Motorun verdiği bilgilerle çelişme; hamle ya da değerlendirme uydurma.
- Türkçe satranç notasyonu kullan (Ş, V, K, F, A).
- Başlık, madde işareti veya markdown kullanma; yalnızca düz metin yaz.`;

export interface CoachInput {
  move: PlyMove;
  info: MoveClassification;
  comment: MoveComment;
}

function buildUserMessage({ move, info, comment }: CoachInput): string {
  const side = move.color === 'w' ? 'Beyaz' : 'Siyah';
  return [
    `Hamleden önceki pozisyon (FEN): ${move.fenBefore}`,
    `Oynanan hamle: ${move.moveNumber}${move.color === 'w' ? '.' : '...'} ${toTurkishSan(move.san)} (${side})`,
    `Sınıf: ${MOVE_CLASS_META[info.cls].label}`,
    `Kazanma şansı (${side} için): %${Math.round(info.winBefore)} → %${Math.round(info.winAfter)}`,
    comment.evalChange ? `Değerlendirme (beyaz perspektifi): ${comment.evalChange}` : '',
    comment.line ? `${comment.line.label}: ${comment.line.text}` : '',
    `Kural tabanlı tespitler: ${[comment.headline, ...comment.details].join(' ')}`,
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
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(input) }],
      },
      { signal },
    );

    if (response.stop_reason === 'refusal') throw new Error('Model bu isteğe yanıt vermedi.');
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (!text) throw new Error('Boş yanıt geldi.');
    return text;
  } catch (error) {
    if (error instanceof AnthropicClient.AuthenticationError) throw new Error('API anahtarı geçersiz.');
    if (error instanceof AnthropicClient.PermissionDeniedError) throw new Error('Bu anahtarın modele erişim izni yok.');
    if (error instanceof AnthropicClient.RateLimitError) throw new Error('İstek sınırına ulaşıldı, biraz sonra tekrar deneyin.');
    if (error instanceof AnthropicClient.APIConnectionError) throw new Error('Bağlantı kurulamadı.');
    if (error instanceof AnthropicClient.APIError) throw new Error(`API hatası (${error.status ?? '?'}).`);
    throw error;
  }
}
