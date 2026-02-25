import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { whatsappService } from '@/lib/whatsappService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, MapPin, ArrowLeft, Star, User } from 'lucide-react';
import { toast } from 'sonner';
import ReviewForm, { ReviewCard } from '@/components/ReviewForm';

const CATEGORIES = [
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'artesanato', label: 'Artesanato' },
  { value: 'outros', label: 'Outros' }
];

// Offer Details Page - displays full offer information with reviews
export default function OfferDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);

  const loadCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', session.user.id)
        .single();
      setCurrentUser(profile);
    }
  };

  const loadReviews = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          author:profiles(name, avatar_url)
        `)
        .eq('offer_id', id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
    }
  }, [id]);

  const loadOffer = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select(`
          *,
          profiles (
            id,
            name,
            whatsapp,
            neighborhood,
            avatar_url
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      if (!data || !data.active) {
        toast.error('Oferta não encontrada ou não está disponível');
        navigate('/');
        return;
      }

      setOffer(data);
      loadReviews();
    } catch (error) {
      console.error('Erro ao carregar oferta:', error);
      toast.error('Erro ao carregar oferta');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, loadReviews]);

  useEffect(() => {
    loadOffer();
    loadCurrentUser();
  }, [loadOffer]);

  const handleContact = async () => {
    setContacting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // 1. Registrar o contato para métricas (Silencioso se falhar)
      if (session?.user) {
        try {
          await supabase
            .from('contact_logs')
            .insert([{ offer_id: offer.id, buyer_id: session.user.id }]);
        } catch (logError) {
          console.log('Aviso: Falha ao registrar log de contato', logError);
        }
      }

      // 2. Notificar o vendedor via WhatsApp (API Evolution) - Graceful degradation
      const buyerName = currentUser?.name || 'Alguém';
      if (whatsappService.notifySellerOfInterest) {
        try {
          await whatsappService.notifySellerOfInterest(
            offer.profiles.whatsapp,
            offer.profiles.name,
            offer.title,
            buyerName
          );
        } catch (whatsError) {
          console.log('Aviso: Falha ao notificar vendedor via API. Abrindo link direto.', whatsError);
        }
      }

      // 3. Redirecionar para o WhatsApp do vendedor (Agora dentro do fluxo seguro)
      const message = `Olá! Vi seu anúncio "${offer.title}" na plataforma Pró-Família e gostaria de mais informações.`;
      const whatsappLink = whatsappService.getWhatsAppLink(offer.profiles.whatsapp, message);
      window.open(whatsappLink, '_blank');

      toast.success('Iniciando conversa com o vendedor...');

    } catch (error) {
      console.error('Erro crítico no processo de contato:', error);
      toast.error('Ocorreu um erro ao tentar entrar em contato. Tente novamente.');
    } finally {
      setContacting(false);
    }
  };

  // Calcular média das avaliações
  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!offer) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="container max-w-4xl mx-auto space-y-6">
        {/* Botão Voltar */}
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4"
          data-testid="btn-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para ofertas
        </Button>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Imagens */}
          <div className="space-y-4">
            {/* Imagem Principal - Sem corte */}
            <Card className="overflow-hidden">
              <div className="bg-slate-100 flex items-center justify-center min-h-[320px]">
                {offer.images && offer.images.length > 0 ? (
                  <img
                    src={offer.images[selectedImage]}
                    alt={offer.title}
                    className="max-w-full max-h-[400px] object-contain"
                  />
                ) : (
                  <div className="w-full h-80 flex items-center justify-center">
                    <span className="text-slate-400">Sem imagem</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Miniaturas */}
            {offer.images && offer.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {offer.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors bg-slate-100 flex items-center justify-center ${selectedImage === idx ? 'border-primary' : 'border-transparent'
                      }`}
                  >
                    <img
                      src={img}
                      alt={`${offer.title} ${idx + 1}`}
                      className="max-w-full max-h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Coluna Direita - Detalhes */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-2xl">{offer.title}</CardTitle>
                  <Badge variant="secondary">
                    {CATEGORIES.find(c => c.value === offer.category)?.label}
                  </Badge>
                </div>

                {/* Avaliação média */}
                {reviews.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${star <= Math.round(averageRating)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                            }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium">{averageRating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">
                      ({reviews.length} {reviews.length === 1 ? 'avaliação' : 'avaliações'})
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Preço */}
                {offer.price && (
                  <div className="text-3xl font-bold text-primary">
                    R$ {parseFloat(offer.price).toFixed(2)}
                  </div>
                )}

                {/* Descrição */}
                <div>
                  <h3 className="font-semibold mb-2">Descrição</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{offer.description}</p>
                </div>

                {/* Localização */}
                {offer.neighborhood && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {offer.neighborhood}
                  </div>
                )}

                {/* Vendedor */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Vendedor</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                      {offer.profiles.avatar_url ? (
                        <img
                          src={offer.profiles.avatar_url}
                          alt={offer.profiles.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        offer.profiles.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{offer.profiles.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Membro da comunidade
                      </p>
                    </div>
                  </div>
                </div>

                {/* Botão de Contato */}
                <Button
                  onClick={handleContact}
                  className="w-full"
                  size="lg"
                  disabled={contacting}
                  data-testid="btn-contact"
                >
                  {contacting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Iniciando contato...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="mr-2 h-5 w-5" />
                      Entrar em Contato via WhatsApp
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Seção de Avaliações */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Avaliações</h2>

          {/* Lista de Avaliações */}
          {reviews.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Star className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-muted-foreground">
                  Esta oferta ainda não possui avaliações.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Seja o primeiro a avaliar!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}

          {/* Formulário de Avaliação */}
          {currentUser && currentUser.id !== offer.profiles.id && (
            <ReviewForm
              offerId={offer.id}
              offerTitle={offer.title}
              onReviewSubmitted={loadReviews}
            />
          )}

          {!currentUser && (
            <Card>
              <CardContent className="py-6 text-center">
                <User className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                <p className="text-muted-foreground">
                  Faça login para deixar sua avaliação
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate('/auth')}
                >
                  Entrar
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}