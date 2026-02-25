import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { whatsappService } from '@/lib/whatsappService';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, Edit, Trash2, Clock, CheckCircle, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import ImageUpload from '@/components/ImageUpload';
import { Badge } from '@/components/ui/badge';
import ReportSaleForm from '@/components/ReportSaleForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const CATEGORIES = [
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'artesanato', label: 'Artesanato' },
  { value: 'outros', label: 'Outros' }
];

// My Offers Page - manages user's own products and services
export default function MyOffersPage() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: 'servicos',
    neighborhood: '',
    images: []
  });

  const loadOffers = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOffers(data || []);
    } catch (error) {
      console.error('Erro ao carregar ofertas:', error);
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

    if (!profileData?.is_approved) {
      toast.error('Seu perfil ainda não foi aprovado pelo administrador.');
    }

    loadOffers(session.user.id);
  }, [navigate, loadOffers]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!profile?.is_approved) {
      toast.error('Seu perfil precisa ser aprovado primeiro.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Admins podem publicar diretamente, usuários comuns precisam de aprovação
      const isAdmin = profile?.role === 'admin';
      const shouldBeActive = editingOffer ? editingOffer.active : isAdmin;

      const offerData = {
        title: formData.title,
        description: formData.description,
        price: formData.price ? parseFloat(formData.price) : null,
        category: formData.category,
        neighborhood: formData.neighborhood,
        images: formData.images,
        owner_id: user.id,
        active: shouldBeActive // Admins: true, Usuários: false (pendente de aprovação)
      };

      if (editingOffer) {
        const { error } = await supabase
          .from('offers')
          .update(offerData)
          .eq('id', editingOffer.id);

        if (error) throw error;
        toast.success('Oferta atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('offers')
          .insert([offerData]);

        if (error) throw error;

        if (isAdmin) {
          toast.success('Oferta criada e publicada com sucesso!');
        } else {
          // ---- INÍCIO DO GATILHO DO WHATSAPP ----
          try {
            const adminPhone = process.env.REACT_APP_ADMIN_WHATSAPP;
            if (adminPhone) {
              const normalMessage = `📦 *Nova Oferta Aguardando Aprovação!*\n\nO usuário *${profile.name}* acabou de cadastrar uma nova oferta:\n\n*Título:* ${formData.title}\n*Categoria:* ${formData.category}\n*Bairro:* ${formData.neighborhood || 'Não informado'}\n\nAcesse o painel para moderar e ativar a oferta.`;
              await whatsappService.sendMessage(adminPhone, normalMessage);
              console.log("Notificação de nova oferta enviada para admin!");
            } else {
              console.warn("Número de admin não configurado na Vercel.");
            }
          } catch (wppError) {
            console.error("Erro ao enviar notificação de WhatsApp:", wppError);
          }
          // ---- FIM DO GATILHO DO WHATSAPP ----

          toast.success('Oferta criada! Aguardando aprovação do administrador.');
        }
      }

      setDialogOpen(false);
      resetForm();
      loadOffers(user.id);
    } catch (error) {
      console.error('Erro ao salvar oferta:', error);
      toast.error('Erro ao salvar oferta');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (offer) => {
    setEditingOffer(offer);
    setFormData({
      title: offer.title,
      description: offer.description,
      price: offer.price?.toString() || '',
      category: offer.category,
      neighborhood: offer.neighborhood || '',
      images: offer.images || []
    });
    setDialogOpen(true);
  };

  const handleDelete = async (offerId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta oferta?')) return;

    try {
      const { error } = await supabase
        .from('offers')
        .delete()
        .eq('id', offerId);

      if (error) throw error;

      toast.success('Oferta excluída com sucesso!');
      setOffers(offers.filter(o => o.id !== offerId));
    } catch (error) {
      console.error('Erro ao excluir oferta:', error);
      toast.error('Erro ao excluir oferta');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      price: '',
      category: 'servicos',
      neighborhood: '',
      images: []
    });
    setEditingOffer(null);
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Minhas Ofertas</h1>
            <p className="text-muted-foreground">Gerencie seus anúncios</p>
          </div>
          <div className="flex gap-2">
            <ReportSaleForm />
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button data-testid="btn-new-offer">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Oferta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingOffer ? 'Editar Oferta' : 'Nova Oferta'}
                  </DialogTitle>
                  <DialogDescription>
                    Preencha os dados do seu produto ou serviço
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título *</Label>
                    <Input
                      id="title"
                      data-testid="input-offer-title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição *</Label>
                    <Textarea
                      id="description"
                      data-testid="input-offer-description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Preço (R$)</Label>
                      <Input
                        id="price"
                        data-testid="input-offer-price"
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Categoria *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                      >
                        <SelectTrigger data-testid="select-offer-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Bairro</Label>
                    <Input
                      id="neighborhood"
                      data-testid="input-offer-neighborhood"
                      value={formData.neighborhood}
                      onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      placeholder="Ex: Centro, Paraviana..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Fotos (máximo 10)</Label>
                    <ImageUpload
                      images={formData.images}
                      onChange={(images) => setFormData({ ...formData, images })}
                      maxImages={10}
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
                      data-testid="btn-save-offer"
                      type="submit"
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        editingOffer ? 'Atualizar' : 'Criar Oferta'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Lista de Ofertas */}
        {offers.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <p className="text-muted-foreground">Você ainda não possui ofertas cadastradas.</p>
              <Button
                onClick={() => setDialogOpen(true)}
                className="mt-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeira Oferta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {offers.map(offer => (
              <Card key={offer.id} data-testid={`my-offer-${offer.id}`} className={!offer.active ? 'border-yellow-300 bg-yellow-50/50' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-xl">{offer.title}</CardTitle>
                        {offer.active ? (
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Aprovada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            <Clock className="h-3 w-3 mr-1" />
                            Pendente de Aprovação
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {CATEGORIES.find(c => c.value === offer.category)?.label}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        data-testid={`btn-edit-${offer.id}`}
                        size="icon"
                        variant="outline"
                        onClick={() => handleEdit(offer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        data-testid={`btn-delete-${offer.id}`}
                        size="icon"
                        variant="outline"
                        onClick={() => handleDelete(offer.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-4">{offer.description}</p>
                  {offer.price && (
                    <p className="text-lg font-bold text-primary">
                      R$ {parseFloat(offer.price).toFixed(2)}
                    </p>
                  )}
                  {offer.images && offer.images.length > 0 && (
                    <div className="flex gap-2 mt-4 overflow-x-auto">
                      {offer.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`${offer.title} ${idx + 1}`}
                          className="h-20 w-20 object-cover rounded"
                        />
                      ))}
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