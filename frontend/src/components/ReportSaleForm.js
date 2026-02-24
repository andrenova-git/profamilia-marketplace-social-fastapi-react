import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { whatsappService } from '@/lib/whatsappService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, DollarSign, CheckCircle, Upload, X, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
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

export default function ReportSaleForm({ onSaleReported }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [offers, setOffers] = useState([]);
  const [formData, setFormData] = useState({
    offer_id: '',
    sale_type: 'venda',
    amount: '',
    notes: '',
    proof_image: ''
  });

  useEffect(() => {
    if (open) {
      loadUserOffers();
    }
  }, [open]);

  const loadUserOffers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('offers')
        .select('id, title')
        .eq('owner_id', session.user.id)
        .eq('active', true)
        .order('title');

      if (error) throw error;
      setOffers(data || []);
    } catch (error) {
      console.error('Erro ao carregar ofertas:', error);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar logado');
        return;
      }

      // Comprimir imagem
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/jpeg'
      };

      const compressedFile = await imageCompression(file, options);

      // Gerar nome único
      const fileName = `${session.user.id}/sale-proof-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

      // Upload para o Supabase Storage
      const { data, error } = await supabase.storage
        .from('offer-images')
        .upload(fileName, compressedFile, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) throw error;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('offer-images')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, proof_image: urlData.publicUrl }));
      toast.success('Comprovante enviado!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao enviar comprovante');
    } finally {
      setUploading(false);
    }
  };

  const removeProofImage = async () => {
    if (formData.proof_image) {
      try {
        const path = formData.proof_image.split('/offer-images/').pop();
        await supabase.storage.from('offer-images').remove([path]);
      } catch (error) {
        console.error('Erro ao remover imagem:', error);
      }
    }
    setFormData(prev => ({ ...prev, proof_image: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.offer_id) {
      toast.error('Selecione uma oferta');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    if (!formData.proof_image) {
      toast.error('Anexe um comprovante de pagamento');
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar logado');
        return;
      }

      // Buscar dados do usuário e da oferta
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', session.user.id)
        .single();

      const { data: offer } = await supabase
        .from('offers')
        .select('title')
        .eq('id', formData.offer_id)
        .single();

      const { error } = await supabase
        .from('sales_reports')
        .insert([{
          user_id: session.user.id,
          offer_id: formData.offer_id,
          sale_type: formData.sale_type,
          amount: parseFloat(formData.amount),
          description: formData.notes.trim() || null,
          proof_image: formData.proof_image,
          status: 'pending'
        }]);

      if (error) throw error;

      // Notificar admin via WhatsApp
      const message = `💰 *Nova Venda Reportada*\n\n` +
        `Vendedor: ${profile?.name || 'Usuário'}\n` +
        `Oferta: ${offer?.title || 'N/A'}\n` +
        `Tipo: ${formData.sale_type === 'venda' ? 'Venda de Produto' : 'Prestação de Serviço'}\n` +
        `Valor: R$ ${parseFloat(formData.amount).toFixed(2)}\n\n` +
        `⚠️ Aguardando aprovação. Verifique o comprovante no painel admin.`;

      await whatsappService.sendMessage(process.env.REACT_APP_ADMIN_WHATSAPP, message);

      toast.success('Venda reportada! Aguardando aprovação do administrador.');
      setFormData({ offer_id: '', sale_type: 'venda', amount: '', notes: '', proof_image: '' });
      setOpen(false);
      if (onSaleReported) onSaleReported();
    } catch (error) {
      console.error('Erro ao reportar venda:', error);
      toast.error('Erro ao reportar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" data-testid="btn-report-sale">
          <DollarSign className="mr-2 h-4 w-4" />
          Reportar Venda/Serviço
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reportar Venda ou Serviço</DialogTitle>
          <DialogDescription>
            Informe suas vendas para ajudar a medir o impacto da plataforma. 
            <strong> É obrigatório anexar comprovante de pagamento.</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="offer">Oferta relacionada *</Label>
            <Select
              value={formData.offer_id}
              onValueChange={(value) => setFormData({ ...formData, offer_id: value })}
            >
              <SelectTrigger data-testid="select-offer">
                <SelectValue placeholder="Selecione uma oferta" />
              </SelectTrigger>
              <SelectContent>
                {offers.map(offer => (
                  <SelectItem key={offer.id} value={offer.id}>{offer.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sale_type">Tipo *</Label>
            <Select
              value={formData.sale_type}
              onValueChange={(value) => setFormData({ ...formData, sale_type: value })}
            >
              <SelectTrigger data-testid="select-sale-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="venda">Venda de Produto</SelectItem>
                <SelectItem value="servico">Prestação de Serviço</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor recebido (R$) *</Label>
            <Input
              id="amount"
              data-testid="input-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>

          {/* Upload de Comprovante */}
          <div className="space-y-2">
            <Label>Comprovante de Pagamento *</Label>
            <p className="text-xs text-muted-foreground">
              Anexe uma foto ou print do comprovante (PIX, transferência, recibo, etc.)
            </p>
            
            {formData.proof_image ? (
              <Card className="relative overflow-hidden">
                <CardContent className="p-2">
                  <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden">
                    <img
                      src={formData.proof_image}
                      alt="Comprovante"
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={removeProofImage}
                      className="absolute top-2 right-2 bg-destructive text-white p-1.5 rounded-full hover:bg-destructive/90"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                  {uploading ? (
                    <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">Clique para anexar comprovante</span>
                    </>
                  )}
                </div>
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              data-testid="input-notes"
              placeholder="Ex: Cliente ficou muito satisfeito..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 text-sm">
              O reporte será verificado pelo administrador antes de ser contabilizado.
              Reportes falsos podem resultar em bloqueio do perfil.
            </AlertDescription>
          </Alert>

          <Button type="submit" disabled={loading || uploading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Enviar para Aprovação
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
