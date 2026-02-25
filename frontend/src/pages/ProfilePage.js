import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Mail, Phone, Camera, Save, ShoppingBag, Star, Scale, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

// Profile Page - user profile management and statistics
export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    totalOffers: 0,
    activeOffers: 0,
    pendingOffers: 0,
    totalReviews: 0,
    averageRating: 0,
    totalMediations: 0
  });
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    neighborhood: '',
    bio: ''
  });
  const navigate = useNavigate();

  // CORREÇÃO 1: loadProfile envolvido em useCallback
  const loadProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      setProfile(data);
      setFormData({
        name: data.name || '',
        whatsapp: data.whatsapp || '',
        neighborhood: data.neighborhood || '',
        bio: data.bio || ''
      });
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      toast.error('Erro ao carregar perfil');
    }
  }, []);

  // CORREÇÃO 2: loadStats envolvido em useCallback
  const loadStats = useCallback(async (userId) => {
    try {
      // Ofertas do usuário
      const { data: offers } = await supabase
        .from('offers')
        .select('id, active')
        .eq('owner_id', userId);

      const totalOffers = offers?.length || 0;
      const activeOffers = offers?.filter(o => o.active).length || 0;
      const pendingOffers = offers?.filter(o => !o.active).length || 0;

      // Avaliações recebidas nas ofertas do usuário
      const offerIds = offers?.map(o => o.id) || [];
      let totalReviews = 0;
      let averageRating = 0;

      if (offerIds.length > 0) {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('rating')
          .in('offer_id', offerIds)
          .eq('status', 'approved');

        if (reviews && reviews.length > 0) {
          totalReviews = reviews.length;
          averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        }
      }

      // Mediações do usuário
      const { count: mediationsCount } = await supabase
        .from('disputes')
        .select('*', { count: 'exact', head: true })
        .or(`complainant_id.eq.${userId},defendant_id.eq.${userId}`);

      setStats({
        totalOffers,
        activeOffers,
        pendingOffers,
        totalReviews,
        averageRating,
        totalMediations: mediationsCount || 0
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  }, []);

  // CORREÇÃO 3: checkAuth com dependências e carregamento paralelo otimizado
  const checkAuth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      setUser(session.user);

      // Executa as duas consultas ao banco simultaneamente para carregar mais rápido
      await Promise.all([
        loadProfile(session.user.id),
        loadStats(session.user.id)
      ]);
    } finally {
      setLoading(false);
    }
  }, [navigate, loadProfile, loadStats]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);

    try {
      // Comprimir imagem
      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 400,
        useWebWorker: true
      };

      const compressedFile = await imageCompression(file, options);

      // Gerar nome único
      const fileName = `${user.id}/avatar-${Date.now()}.jpg`;

      // Remover avatar antigo se existir
      if (profile.avatar_url) {
        const oldPath = profile.avatar_url.split('/offer-images/').pop();
        await supabase.storage.from('offer-images').remove([oldPath]);
      }

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('offer-images')
        .upload(fileName, compressedFile, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('offer-images')
        .getPublicUrl(fileName);

      // Atualizar perfil com nova URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: urlData.publicUrl });
      toast.success('Foto de perfil atualizada!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao atualizar foto de perfil');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          whatsapp: formData.whatsapp,
          neighborhood: formData.neighborhood,
          bio: formData.bio
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({ ...profile, ...formData });
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast.error('Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleSuspendAccount = async () => {
    const newStatus = profile?.status === 'suspended' ? 'active' : 'suspended';
    const actionName = newStatus === 'suspended'
      ? 'Suspender sua conta? Suas ofertas não ficarão mais visíveis ao público.'
      : 'Reativar sua conta? Suas ofertas voltarão a ficar visíveis.';

    if (!window.confirm(actionName)) return;

    try {
      const { error } = await supabase.rpc('update_profile_status', {
        target_user_id: user.id,
        new_status: newStatus
      });

      if (error) throw error;

      setProfile({ ...profile, status: newStatus });
      toast.success(newStatus === 'suspended' ? 'Conta suspensa com sucesso.' : 'Conta reativada com sucesso.');
    } catch (error) {
      console.error('Erro ao mudar status:', error);
      toast.error('Erro ao mudar status da conta');
    }
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
        <div className="flex items-center gap-4">
          <User className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Meu Perfil</h1>
            <p className="text-muted-foreground">Gerencie suas informações pessoais</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Coluna Esquerda - Foto e Status */}
          <div className="space-y-6">
            {/* Foto de Perfil */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center">
                  <div className="relative group">
                    <Avatar className="h-32 w-32">
                      <AvatarImage src={profile?.avatar_url} alt={profile?.name} />
                      <AvatarFallback className="text-4xl bg-primary/10 text-primary">
                        {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <label className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-lg">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        disabled={uploadingAvatar}
                      />
                      {uploadingAvatar ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </label>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold">{profile?.name}</h2>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant={profile?.is_approved ? "default" : "secondary"}>
                      {profile?.is_approved ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Aprovado
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3 mr-1" />
                          Pendente
                        </>
                      )}
                    </Badge>
                    {profile?.role === 'admin' && (
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">
                        Admin
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Estatísticas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estatísticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Ofertas</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{stats.totalOffers}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({stats.activeOffers} ativas)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">Avaliações</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{stats.totalReviews}</span>
                    {stats.averageRating > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({stats.averageRating.toFixed(1)} ⭐)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">Mediações</span>
                  </div>
                  <span className="font-semibold">{stats.totalMediations}</span>
                </div>

                {stats.pendingOffers > 0 && (
                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      <Clock className="h-4 w-4 inline mr-1" />
                      {stats.pendingOffers} oferta(s) aguardando aprovação
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coluna Direita - Formulário */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Informações Pessoais</CardTitle>
                <CardDescription>
                  Atualize seus dados para que outros membros possam entrar em contato
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome Completo</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="name"
                          data-testid="input-profile-name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="pl-10"
                          placeholder="Seu nome"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="whatsapp"
                          data-testid="input-profile-whatsapp"
                          value={formData.whatsapp}
                          onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                          className="pl-10"
                          placeholder="5595999999999"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        value={user?.email || ''}
                        disabled
                        className="pl-10 bg-gray-50"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O email não pode ser alterado
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Bairro</Label>
                    <Input
                      id="neighborhood"
                      data-testid="input-profile-neighborhood"
                      value={formData.neighborhood}
                      onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      placeholder="Ex: Centro, Pintolândia, Caimbé..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Sobre você (opcional)</Label>
                    <textarea
                      id="bio"
                      data-testid="input-profile-bio"
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="Conte um pouco sobre você, seus produtos ou serviços..."
                      maxLength={300}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {formData.bio.length}/300 caracteres
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={saving}
                    className="w-full"
                    data-testid="btn-save-profile"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Informações da Conta */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Informações da Conta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Membro desde</span>
                  <span>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status da conta</span>
                  <Badge variant={profile?.is_approved ? "default" : "secondary"} className="text-xs">
                    {profile?.is_approved ? 'Ativa' : 'Pendente de aprovação'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo de conta</span>
                  <span className="capitalize">{profile?.role === 'admin' ? 'Administrador' : 'Usuário'}</span>
                </div>

                <div className="pt-4 mt-4 border-t">
                  <Button
                    variant={profile?.status === 'suspended' ? 'default' : 'destructive'}
                    className="w-full"
                    onClick={handleSuspendAccount}
                  >
                    {profile?.status === 'suspended' ? 'Reativar Minha Conta' : 'Suspender Minha Conta'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {profile?.status === 'suspended'
                      ? 'Ao reativar, suas ofertas aprovadas voltarão a aparecer.'
                      : 'Suas ofertas ficarão ocultas enquanto a conta estiver suspensa.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}