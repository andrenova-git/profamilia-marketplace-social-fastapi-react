import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { whatsappService } from '@/lib/whatsappService';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Loader2, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Component for submitting reviews with duplicate detection
export default function ReviewForm({ offerId, offerTitle, onReviewSubmitted }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previousReviewsCount, setPreviousReviewsCount] = useState(0);

  // Wrapped in useCallback to satisfy exhaustive-deps rule
  const checkPreviousReviews = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { count } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('offer_id', offerId)
        .eq('author_id', session.user.id);

      setPreviousReviewsCount(count || 0);
    } catch (error) {
      console.error('Erro ao verificar avaliações anteriores:', error);
    }
  }, [offerId]);

  useEffect(() => {
    checkPreviousReviews();
  }, [checkPreviousReviews]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error('Por favor, selecione uma avaliação de 1 a 5 estrelas');
      return;
    }

    if (!comment.trim()) {
      toast.error('Por favor, escreva um comentário');
      return;
    }

    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar logado para avaliar');
        return;
      }

      // Buscar nome do autor
      const { data: authorProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', session.user.id)
        .single();

      // Número da avaliação (1 = primeira, 2 = segunda, etc.)
      const evaluationNumber = previousReviewsCount + 1;

      const { error } = await supabase
        .from('reviews')
        .insert([{
          offer_id: offerId,
          author_id: session.user.id,
          rating,
          comment: comment.trim(),
          status: 'pending',
          evaluation_number: evaluationNumber
        }]);

      if (error) throw error;

      // Notificar admin via WhatsApp sobre nova avaliação
      // Incluir aviso se for avaliação repetida
      const isRepeat = evaluationNumber > 1;
      const reviewMessage = isRepeat
        ? `📝 *Nova Avaliação (REPETIDA #${evaluationNumber})*\n\n⚠️ ATENÇÃO: Este usuário já avaliou esta oferta ${previousReviewsCount}x antes!\n\nOferta: ${offerTitle}\nAutor: ${authorProfile?.name || 'Usuário'}\nNota: ${'⭐'.repeat(rating)} (${rating}/5)\n\nVerifique se houve nova compra antes de aprovar.`
        : null;

      if (isRepeat) {
        // Fallback condicional seguro
        if (whatsappService.sendMessage && process.env.REACT_APP_ADMIN_WHATSAPP) {
          await whatsappService.sendMessage(process.env.REACT_APP_ADMIN_WHATSAPP, reviewMessage);
        }
      } else {
        if (whatsappService.notifyNewReview) {
          await whatsappService.notifyNewReview(offerTitle, authorProfile?.name || 'Usuário', rating);
        }
      }

      toast.success('Avaliação enviada! Aguardando aprovação do moderador.');
      setRating(0);
      setComment('');
      setPreviousReviewsCount(evaluationNumber);
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      toast.error('Erro ao enviar avaliação');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Avaliar "{offerTitle}"</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Aviso de avaliação repetida */}
          {previousReviewsCount > 0 && (
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                Você já avaliou esta oferta {previousReviewsCount} vez(es).
                Esta será sua {previousReviewsCount + 1}ª avaliação e passará por verificação
                adicional do moderador para confirmar nova compra.
              </AlertDescription>
            </Alert>
          )}

          {/* Seletor de Estrelas */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Sua avaliação</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                  data-testid={`star-${star}`}
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${star <= (hoverRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                      }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {rating === 0 && 'Clique nas estrelas para avaliar'}
              {rating === 1 && '⭐ Muito ruim'}
              {rating === 2 && '⭐⭐ Ruim'}
              {rating === 3 && '⭐⭐⭐ Regular'}
              {rating === 4 && '⭐⭐⭐⭐ Bom'}
              {rating === 5 && '⭐⭐⭐⭐⭐ Excelente!'}
            </p>
          </div>

          {/* Campo de Comentário */}
          <div className="space-y-2">
            <label htmlFor="comment" className="text-sm font-medium">
              Seu comentário
            </label>
            <Textarea
              id="comment"
              data-testid="review-comment"
              placeholder="Conte sua experiência com este produto/serviço..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500 caracteres
            </p>
          </div>

          {/* Aviso sobre comentários ofensivos */}
          <Alert variant="warning" className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 text-sm">
              <strong>Atenção:</strong> Comentários ofensivos, com linguagem imprópria ou que não
              correspondam à realidade serão rejeitados pelo moderador. Seja respeitoso e honesto
              em sua avaliação.
            </AlertDescription>
          </Alert>

          {/* Botão de Enviar */}
          <Button
            type="submit"
            disabled={submitting || rating === 0}
            className="w-full"
            data-testid="btn-submit-review"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              previousReviewsCount > 0 ? 'Enviar Nova Avaliação' : 'Enviar Avaliação'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Componente para exibir uma avaliação
export function ReviewCard({ review }) {
  return (
    <Card className="bg-slate-50">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{review.author?.name || 'Usuário'}</span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${star <= review.rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                      }`}
                  />
                ))}
              </div>
            </div>
            <p className="text-sm text-gray-700">{review.comment}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(review.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente para listar avaliações de uma oferta
export function ReviewsList({ offerId }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // CORREÇÃO 1: Transformado em useCallback para referenciar no useEffect
  const loadReviews = useCallback(async () => {
    setLoading(true); // Garante que o loading reapareça se a oferta mudar
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          author:profiles(name)
        `)
        .eq('offer_id', offerId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  // CORREÇÃO 2: Alterado de useState para useEffect (Erro crítico do React)
  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-4">
        Esta oferta ainda não possui avaliações aprovadas.
      </p>
    );
  }

  // Calcular média
  const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-5 w-5 ${star <= Math.round(averageRating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
                }`}
            />
          ))}
        </div>
        <span className="font-semibold">{averageRating.toFixed(1)}</span>
        <span className="text-muted-foreground text-sm">({reviews.length} avaliações)</span>
      </div>

      <div className="space-y-3">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}