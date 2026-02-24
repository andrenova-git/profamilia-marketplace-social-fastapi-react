import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { whatsappService } from '@/lib/whatsappService';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
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

export default function DisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [myOffers, setMyOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    offer_id: '',
    title: '',
    description: ''
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
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
    loadData(session.user.id);
  };

  const loadData = async (userId) => {
    try {
      const [disputesRes, offersRes] = await Promise.all([
        supabase.from('disputes').select(`
          *,
          offer:offers(title),
          complainant:complainant_id(name),
          defendant:defendant_id(name)
        `).or(`complainant_id.eq.${userId},defendant_id.eq.${userId}`)
        .order('created_at', { ascending: false }),
        
        supabase.from('offers').select('id, title').eq('active', true)
      ]);

      setDisputes(disputesRes.data || []);
      setMyOffers(offersRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar disputas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const selectedOffer = myOffers.find(o => o.id === formData.offer_id);
      if (!selectedOffer) throw new Error('Oferta não encontrada');

      const { data: offerData } = await supabase
        .from('offers')
        .select('owner_id')
        .eq('id', formData.offer_id)
        .single();

      const disputeData = {
        offer_id: formData.offer_id,
        complainant_id: user.id,
        defendant_id: offerData.owner_id,
        title: formData.title,
        description: formData.description,
        status: 'open'
      };

      const { error } = await supabase
        .from('disputes')
        .insert([disputeData]);

      if (error) throw error;

      const { data: defendantProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', offerData.owner_id)
        .single();

      await whatsappService.notifyNewDispute(
        formData.title,
        profile.name,
        defendantProfile.name
      );

      toast.success('Disputa criada com sucesso!');
      setDialogOpen(false);
      resetForm();
      loadData(user.id);
    } catch (error) {
      console.error('Erro ao criar disputa:', error);
      toast.error('Erro ao criar disputa');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      offer_id: '',
      title: '',
      description: ''
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'open': 'bg-yellow-100 text-yellow-800',
      'in_mediation': 'bg-blue-100 text-blue-800',
      'resolved': 'bg-green-100 text-green-800',
      'closed': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
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
            <h1 className="text-3xl font-bold">Minhas Disputas</h1>
            <p className="text-muted-foreground">Resolução Online de Conflitos (ODR)</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="btn-new-dispute">
                <Plus className="mr-2 h-4 w-4" />
                Nova Disputa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Abrir Nova Disputa</DialogTitle>
                <DialogDescription>
                  Relate um problema com alguma transação ou serviço
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="offer">Oferta Relacionada *</Label>
                  <Select
                    value={formData.offer_id}
                    onValueChange={(value) => setFormData({ ...formData, offer_id: value })}
                    required
                  >
                    <SelectTrigger data-testid="select-dispute-offer">
                      <SelectValue placeholder="Selecione uma oferta" />
                    </SelectTrigger>
                    <SelectContent>
                      {myOffers.map(offer => (
                        <SelectItem key={offer.id} value={offer.id}>
                          {offer.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Título da Disputa *</Label>
                  <Input
                    id="title"
                    data-testid="input-dispute-title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Produto não entregue"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição do Problema *</Label>
                  <Textarea
                    id="description"
                    data-testid="input-dispute-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={5}
                    placeholder="Descreva em detalhes o que aconteceu..."
                    required
                  />
                </div>

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
                    data-testid="btn-submit-dispute"
                    type="submit"
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      'Criar Disputa'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de Disputas */}
        {disputes.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Você não possui disputas abertas.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {disputes.map(dispute => (
              <Card key={dispute.id} data-testid={`dispute-card-${dispute.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{dispute.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Oferta: {dispute.offer?.title}
                      </p>
                    </div>
                    <Badge className={getStatusColor(dispute.status)}>
                      {dispute.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">{dispute.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Reclamante:</span>
                      <p className="font-medium">{dispute.complainant?.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vendedor:</span>
                      <p className="font-medium">{dispute.defendant?.name}</p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Criada em {new Date(dispute.created_at).toLocaleDateString('pt-BR')}
                  </div>

                  {dispute.resolution_notes && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-green-800 mb-1">
                        Resolução:
                      </p>
                      <p className="text-sm text-green-700">{dispute.resolution_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
