import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { whatsappService } from '@/lib/whatsappService';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Scale, MessageCircle, Send, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import ImageUpload from '@/components/ImageUpload';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

const MAX_IMAGES = 6;

export default function MediationPage() {
  const [mediations, setMediations] = useState([]);
  const [allOffers, setAllOffers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [selectedMediation, setSelectedMediation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    seller_id: '',
    offer_id: '',
    title: '',
    description: '',
    images: []
  });

  const loadData = useCallback(async (userId, role) => {
    try {
      let query = supabase.from('disputes').select(`
        *,
        offer:offers(title),
        complainant:profiles!disputes_complainant_id_fkey(id, name),
        defendant:profiles!disputes_defendant_id_fkey(id, name)
      `);

      // Se não for admin, filtrar apenas as mediações onde o usuário é parte
      if (role !== 'admin') {
        query = query.or(`complainant_id.eq.${userId},defendant_id.eq.${userId}`);
      }

      const [mediationsRes, offersRes] = await Promise.all([
        query.order('created_at', { ascending: false }),
        supabase.from('offers')
          .select(`
            id, 
            title, 
            owner_id,
            owner:profiles!offers_owner_id_fkey(id, name)
          `)
          .eq('active', true)
      ]);

      const offers = offersRes.data || [];
      setAllOffers(offers);

      // Extrair vendedores únicos (excluindo o próprio usuário)
      const uniqueSellers = [];
      const sellerIds = new Set();
      offers.forEach(offer => {
        if (offer.owner_id !== userId && !sellerIds.has(offer.owner_id)) {
          sellerIds.add(offer.owner_id);
          uniqueSellers.push({
            id: offer.owner_id,
            name: offer.owner?.name || 'Vendedor'
          });
        }
      });
      setSellers(uniqueSellers);

      setMediations(mediationsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar mediações:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    setProfile(profileData);
    loadData(session.user.id, profileData?.role);
  }, [navigate, loadData]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Filtrar ofertas pelo vendedor selecionado
  const filteredOffers = formData.seller_id
    ? allOffers.filter(o => o.owner_id === formData.seller_id)
    : allOffers.filter(o => o.owner_id !== profile?.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const selectedOffer = allOffers.find(o => o.id === formData.offer_id);
      if (!selectedOffer) throw new Error('Oferta não encontrada');

      const { data: offerData } = await supabase
        .from('offers')
        .select('owner_id')
        .eq('id', formData.offer_id)
        .single();

      // Não permitir abrir mediação contra si mesmo
      if (offerData.owner_id === user.id) {
        toast.error('Você não pode abrir uma mediação contra sua própria oferta');
        setLoading(false);
        return;
      }

      const mediationData = {
        offer_id: formData.offer_id,
        complainant_id: user.id,
        defendant_id: offerData.owner_id,
        title: formData.title,
        description: formData.description,
        status: 'open',
        images: formData.images,
        messages: [{
          author_id: user.id,
          author_name: profile.name,
          message: formData.description,
          images: formData.images,
          created_at: new Date().toISOString(),
          type: 'complaint'
        }]
      };

      const { error } = await supabase
        .from('disputes')
        .insert([mediationData]);

      if (error) throw error;

      const { data: defendantProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', offerData.owner_id)
        .single();

      // Notificar via WhatsApp
      await whatsappService.notifyNewDispute(
        formData.title,
        profile.name,
        defendantProfile.name
      );

      toast.success('Solicitação de mediação criada com sucesso!');
      setDialogOpen(false);
      resetForm();
      loadData(user.id, profile?.role);
    } catch (error) {
      console.error('Erro ao criar mediação:', error);
      toast.error('Erro ao criar mediação');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedMediation) return;

    setSendingMessage(true);
    try {
      const currentMessages = selectedMediation.messages || [];
      const newMsg = {
        author_id: profile.id,
        author_name: profile.name,
        author_role: profile.role,
        message: newMessage.trim(),
        created_at: new Date().toISOString(),
        type: profile.role === 'admin' ? 'mediator' : 'party'
      };

      const { error } = await supabase
        .from('disputes')
        .update({
          messages: [...currentMessages, newMsg],
          status: selectedMediation.status === 'open' ? 'in_mediation' : selectedMediation.status
        })
        .eq('id', selectedMediation.id);

      if (error) throw error;

      // Atualizar localmente
      setSelectedMediation({
        ...selectedMediation,
        messages: [...currentMessages, newMsg],
        status: selectedMediation.status === 'open' ? 'in_mediation' : selectedMediation.status
      });

      setNewMessage('');
      toast.success('Mensagem enviada');

      // Recarregar dados
      const { data: { user } } = await supabase.auth.getUser();
      loadData(user.id, profile?.role);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleResolve = async (mediationId, resolution) => {
    try {
      const { error } = await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          resolution_notes: resolution,
          resolved_at: new Date().toISOString()
        })
        .eq('id', mediationId);

      if (error) throw error;

      toast.success('Mediação encerrada com sucesso!');
      setSelectedMediation(null);
      const { data: { user } } = await supabase.auth.getUser();
      loadData(user.id, profile?.role);
    } catch (error) {
      console.error('Erro ao resolver mediação:', error);
      toast.error('Erro ao resolver mediação');
    }
  };

  const resetForm = () => {
    setFormData({
      seller_id: '',
      offer_id: '',
      title: '',
      description: '',
      images: []
    });
  };

  const getStatusLabel = (status) => {
    const labels = {
      'open': 'Aberta',
      'in_mediation': 'Em Mediação',
      'resolved': 'Resolvida',
      'closed': 'Encerrada'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'open': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'in_mediation': 'bg-blue-100 text-blue-800 border-blue-300',
      'resolved': 'bg-green-100 text-green-800 border-green-300',
      'closed': 'bg-gray-100 text-gray-800 border-gray-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading && mediations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="container max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Scale className="h-8 w-8" />
              Mediação Online
            </h1>
            <p className="text-muted-foreground">Resolução Online de Conflitos (ODR)</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="btn-new-mediation">
                <Plus className="mr-2 h-4 w-4" />
                Solicitar Mediação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Solicitar Mediação</DialogTitle>
                <DialogDescription>
                  Relate um problema com alguma transação ou serviço para que um mediador possa ajudar a resolver.
                </DialogDescription>
              </DialogHeader>

              <Alert className="bg-blue-50 border-blue-200">
                <Scale className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm">
                  A mediação é um processo confidencial. Apenas você, o vendedor e os mediadores (administradores) terão acesso às informações.
                </AlertDescription>
              </Alert>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Filtro por Vendedor */}
                <div className="space-y-2">
                  <Label htmlFor="seller">Filtrar por Vendedor</Label>
                  <Select
                    value={formData.seller_id}
                    onValueChange={(value) => setFormData({ ...formData, seller_id: value, offer_id: '' })}
                  >
                    <SelectTrigger data-testid="select-seller">
                      <SelectValue placeholder="Todos os vendedores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os vendedores</SelectItem>
                      {sellers.map(seller => (
                        <SelectItem key={seller.id} value={seller.id}>
                          {seller.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Seleção de Oferta */}
                <div className="space-y-2">
                  <Label htmlFor="offer">Oferta Relacionada *</Label>
                  <Select
                    value={formData.offer_id}
                    onValueChange={(value) => setFormData({ ...formData, offer_id: value })}
                    required
                  >
                    <SelectTrigger data-testid="select-mediation-offer">
                      <SelectValue placeholder="Selecione uma oferta" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredOffers.length === 0 ? (
                        <SelectItem value="" disabled>
                          Nenhuma oferta disponível
                        </SelectItem>
                      ) : (
                        filteredOffers.map(offer => (
                          <SelectItem key={offer.id} value={offer.id}>
                            {offer.title} - {offer.owner?.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Título */}
                <div className="space-y-2">
                  <Label htmlFor="title">Título da Solicitação *</Label>
                  <Input
                    id="title"
                    data-testid="input-mediation-title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Produto não entregue"
                    required
                  />
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição do Problema *</Label>
                  <Textarea
                    id="description"
                    data-testid="input-mediation-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={5}
                    placeholder="Descreva em detalhes o que aconteceu..."
                    required
                  />
                </div>

                {/* Upload de Fotos com ajuste de enquadramento */}
                <div className="space-y-2">
                  <Label>Fotos/Evidências (máximo {MAX_IMAGES})</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Adicione fotos que comprovem o problema relatado (prints, fotos do produto, conversas, etc.)
                  </p>

                  <ImageUpload
                    images={formData.images}
                    onChange={(newImages) => setFormData({ ...formData, images: newImages })}
                    maxImages={MAX_IMAGES}
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    data-testid="btn-submit-mediation"
                    type="submit"
                    disabled={loading || !formData.offer_id}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Solicitar Mediação'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de Mediações */}
        {mediations.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Você não possui solicitações de mediação.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Caso tenha algum problema com uma transação, clique em "Solicitar Mediação".
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {mediations.map(mediation => (
              <Card
                key={mediation.id}
                data-testid={`mediation-card-${mediation.id}`}
                className={`cursor-pointer hover:shadow-md transition-shadow ${selectedMediation?.id === mediation.id ? 'ring-2 ring-primary' : ''
                  }`}
                onClick={() => setSelectedMediation(mediation)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{mediation.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Oferta: {mediation.offer?.title}
                      </p>
                    </div>
                    <Badge variant="outline" className={getStatusColor(mediation.status)}>
                      {getStatusLabel(mediation.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm line-clamp-2">{mediation.description}</p>

                  {/* Mostrar fotos se houver */}
                  {mediation.images && mediation.images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {mediation.images.slice(0, 4).map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`Evidência ${idx + 1}`}
                          className="h-16 w-16 object-cover rounded border shrink-0"
                        />
                      ))}
                      {mediation.images.length > 4 && (
                        <div className="h-16 w-16 bg-gray-100 rounded border flex items-center justify-center shrink-0">
                          <span className="text-xs text-gray-600">+{mediation.images.length - 4}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Solicitante:</span>
                      <p className="font-medium">{mediation.complainant?.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vendedor:</span>
                      <p className="font-medium">{mediation.defendant?.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Criada em {new Date(mediation.created_at).toLocaleDateString('pt-BR')}</span>
                    {mediation.messages && mediation.messages.length > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {mediation.messages.length} mensagens
                      </span>
                    )}
                  </div>

                  {mediation.resolution_notes && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <p className="text-sm font-medium text-green-800 mb-1">
                        ✅ Resolução:
                      </p>
                      <p className="text-sm text-green-700">{mediation.resolution_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Painel de Detalhes da Mediação Selecionada */}
        {selectedMediation && selectedMediation.status !== 'resolved' && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Conversa - {selectedMediation.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fotos da mediação */}
              {selectedMediation.images && selectedMediation.images.length > 0 && (
                <div className="bg-slate-100 rounded-lg p-3">
                  <p className="text-sm font-medium mb-2 flex items-center gap-1">
                    <ImageIcon className="h-4 w-4" />
                    Evidências anexadas ({selectedMediation.images.length})
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {selectedMediation.images.map((img, idx) => (
                      <a
                        key={idx}
                        href={img}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <img
                          src={img}
                          alt={`Evidência ${idx + 1}`}
                          className="h-24 w-24 object-cover rounded border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensagens */}
              <div className="bg-slate-100 rounded-lg p-4 max-h-96 overflow-y-auto space-y-3">
                {(!selectedMediation.messages || selectedMediation.messages.length === 0) ? (
                  <p className="text-center text-muted-foreground text-sm">
                    Nenhuma mensagem ainda. Inicie a conversa.
                  </p>
                ) : (
                  selectedMediation.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${msg.type === 'mediator'
                          ? 'bg-blue-100 border-l-4 border-blue-500'
                          : msg.author_id === profile?.id
                            ? 'bg-primary/10 ml-8'
                            : 'bg-white mr-8'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {msg.author_name}
                          {msg.type === 'mediator' && (
                            <Badge variant="outline" className="ml-2 text-xs">Mediador</Badge>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {msg.images.map((img, imgIdx) => (
                            <a key={imgIdx} href={img} target="_blank" rel="noopener noreferrer">
                              <img src={img} alt="" className="h-16 w-16 object-cover rounded" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Campo de Nova Mensagem */}
              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  rows={2}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  className="self-end"
                >
                  {sendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Botão de Resolver (apenas admin) */}
              {profile?.role === 'admin' && (
                <div className="border-t pt-4">
                  <Button
                    variant="outline"
                    className="w-full bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                    onClick={() => {
                      const resolution = prompt('Digite a resolução final desta mediação:');
                      if (resolution) {
                        handleResolve(selectedMediation.id, resolution);
                      }
                    }}
                  >
                    ✅ Encerrar Mediação com Resolução
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}