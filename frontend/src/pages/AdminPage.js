import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { whatsappService } from '@/lib/whatsappService';
import { generateMetricsReport } from '@/lib/pdfReport';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Users,
  AlertTriangle,
  Package,
  BarChart3,
  DollarSign,
  ShoppingBag,
  Star,
  Search,
  Shield,
  ShieldOff,
  ExternalLink,
  Download,
  Trash2,
  ImageIcon,
  RefreshCw,
  UserCog,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'; export default function AdminPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // Perfis
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [profileSearch, setProfileSearch] = useState('');
  const [profileRoleFilter, setProfileRoleFilter] = useState('all');
  const [profileStatusFilter, setProfileStatusFilter] = useState('all');

  // Ofertas / Reviews / Vendas / Disputas
  const [allOffers, setAllOffers] = useState([]);
  const [pendingOffers, setPendingOffers] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [pendingSales, setPendingSales] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [disputes, setDisputes] = useState([]);

  const [proofImageDialog, setProofImageDialog] = useState({ open: false, url: '' });
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [metrics, setMetrics] = useState({
    totalOffers: 0,
    activeOffers: 0,
    totalUsers: 0,
    approvedUsers: 0,
    totalSales: 0,
    totalRevenue: 0,
    recentSales: [],
    totalReviews: 0,
    averageRating: 0,
    salesPending: 0,
    totalSalesReports: 0,
    averageSaleValue: 0,
  });

  // =========================
  // LOADERS
  // =========================
  const loadMetrics = useCallback(async () => {
    try {
      const { count: totalOffers } = await supabase.from('offers').select('*', { count: 'exact', head: true });
      const { count: activeOffers } = await supabase.from('offers').select('*', { count: 'exact', head: true }).eq('active', true);
      const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: approvedUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_approved', true);

      const { data: reviewsData, count: reviewCount } = await supabase
        .from('reviews')
        .select('rating', { count: 'exact' })
        .eq('status', 'approved');

      let averageRating = 0;
      if (reviewsData?.length) {
        averageRating =
          reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsData.length;
      }

      const { data: allSalesData } = await supabase
        .from('sales_reports')
        .select('*')
        .order('created_at', { ascending: false });

      let totalRevenue = 0;
      let totalSales = 0;
      let recentSales = [];
      let salesPending = 0;

      if (allSalesData?.length) {
        const approved = allSalesData.filter((s) => s.status === 'approved');
        totalRevenue = approved.reduce((sum, sale) => sum + parseFloat(String(sale.amount || 0)), 0);
        totalSales = approved.length;
        salesPending = allSalesData.filter((s) => s.status === 'pending').length;
        recentSales = allSalesData.slice(0, 10);
      }

      setMetrics((prev) => ({
        ...prev,
        totalOffers: totalOffers || 0,
        activeOffers: activeOffers || 0,
        totalUsers: totalUsers || 0,
        approvedUsers: approvedUsers || 0,
        totalSales,
        totalRevenue,
        recentSales,
        totalReviews: reviewCount || 0,
        averageRating,
        salesPending,
        totalSalesReports: allSalesData?.length || 0,
        averageSaleValue: totalSales > 0 ? totalRevenue / totalSales : 0,
      }));
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
      toast.error('Erro ao carregar métricas');
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [profilesRes, allProfilesRes, offersRes, reviewsRes, disputesRes, salesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('is_approved', false).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase
          .from('offers')
          .select(`*, profiles!owner_id(name, whatsapp, is_approved)`)
          .order('created_at', { ascending: false }),
        supabase
          .from('reviews')
          .select(`*, offer:offers(title), author:profiles(name)`)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('disputes')
          .select(`*, offer:offers(title), complainant:complainant_id(name), defendant:defendant_id(name)`)
          .order('created_at', { ascending: false }),
        supabase.from('sales_reports').select('*').order('created_at', { ascending: false }),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (allProfilesRes.error) throw allProfilesRes.error;
      if (offersRes.error) throw offersRes.error;
      if (reviewsRes.error) throw reviewsRes.error;
      if (disputesRes.error) throw disputesRes.error;
      if (salesRes.error) throw salesRes.error;

      const profilesData = (profilesRes.data || []);
      const allProfilesData = (allProfilesRes.data || []);
      const offersData = (offersRes.data || []);
      const reviewsData = (reviewsRes.data || []);
      const disputesData = (disputesRes.data || []);
      const salesData = (salesRes.data || []);

      setPendingProfiles(profilesData);
      setAllProfiles(allProfilesData);
      setAllOffers(offersData);
      setPendingOffers(offersData.filter((o) => !o.active));
      setPendingReviews(reviewsData);
      setDisputes(disputesData);

      if (salesData.length) {
        const userIds = [...new Set(salesData.map((s) => s.user_id).filter(Boolean))];
        const { data: userData, error: userErr } = await supabase.from('profiles').select('id, name').in('id', userIds);
        if (userErr) throw userErr;

        const userMap = Object.fromEntries((userData || []).map((u) => [u.id, u.name || 'Sem nome']));
        const enrichedSales = salesData.map((s) => ({ ...s, userName: userMap[s.user_id] || 'Usuário' }));

        setAllSales(enrichedSales);
        setPendingSales(enrichedSales.filter((s) => s.status === 'pending'));
      } else {
        setAllSales([]);
        setPendingSales([]);
      }
    } catch (error) {
      console.error('Erro loadData:', error);
      toast.error('Erro ao carregar dados do painel');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: authData } = await supabase.auth.getSession();
        const session = authData.session;

        if (!session) {
          navigate('/auth');
          return;
        }

        const { data: pData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error || !pData) {
          navigate('/');
          return;
        }

        if (pData.role !== 'admin') {
          navigate('/');
          return;
        }

        setProfile(pData);
        await Promise.all([loadData(), loadMetrics()]);
      } catch (err) {
        console.error(err);
        navigate('/');
      }
    };

    checkAdmin();
  }, [navigate, loadData, loadMetrics]);

  // =========================
  // FILTERS (Perfis)
  // =========================
  const filteredProfiles = useMemo(() => {
    return allProfiles.filter((p) => {
      const q = profileSearch.trim().toLowerCase();
      const name = (p.name || '').toLowerCase();
      const phone = (p.whatsapp || '').toLowerCase();

      const matchesSearch = !q || name.includes(q) || phone.includes(q);

      const role = (p.role || 'user');
      const matchesRole = profileRoleFilter === 'all' ? true : role === profileRoleFilter;

      const approved = !!p.is_approved;
      const matchesStatus =
        profileStatusFilter === 'all'
          ? true
          : profileStatusFilter === 'approved'
            ? approved
            : !approved;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [allProfiles, profileSearch, profileRoleFilter, profileStatusFilter]);

  const profileStats = useMemo(() => {
    const total = allProfiles.length;
    const approved = allProfiles.filter((p) => p.is_approved).length;
    const pending = allProfiles.filter((p) => !p.is_approved).length;
    const admins = allProfiles.filter((p) => p.role === 'admin').length;

    return { total, approved, pending, admins };
  }, [allProfiles]);

  // =========================
  // HANDLERS - PERFIS
  // =========================
  const handleApproveProfile = async (id) => {
    try {
      const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', id);
      if (error) throw error;

      toast.success('Perfil aprovado!');
      await Promise.all([loadData(), loadMetrics()]);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao aprovar perfil');
    }
  };

  const handleRejectProfile = async (id) => {
    if (!window.confirm('Desaprovar este perfil? Ele voltará a ficar pendente.')) return;

    try {
      const { error } = await supabase.from('profiles').update({ is_approved: false }).eq('id', id);
      if (error) throw error;

      toast.success('Perfil desaprovado.');
      await Promise.all([loadData(), loadMetrics()]);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao desaprovar perfil');
    }
  };

  const handleToggleProfileStatus = async (id, currentStatus, name) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const actionName = newStatus === 'suspended' ? 'Suspender' : 'Reativar';
    if (!window.confirm(`${actionName} conta de ${name || 'este perfil'}?`)) return;

    try {
      const { error } = await supabase.rpc('update_profile_status', {
        target_user_id: id,
        new_status: newStatus
      });
      if (error) throw error;

      toast.success(`Perfil ${newStatus === 'suspended' ? 'suspenso' : 'reativado'}.`);
      await Promise.all([loadData(), loadMetrics()]);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao mudar status do perfil.');
    }
  };

  const handleDeleteProfile = async (id, name) => {
    if (!window.confirm(`Excluir permanentemente ${name || 'este perfil'}? Esta ação é irreversível e excluirá todo o histórico desse usuário no sistema.`)) return;

    try {
      const { error } = await supabase.rpc('admin_delete_user', { target_user_id: id });
      if (error) throw error;

      // Remove imediatamente da interface (estado local) para que desapareça da aba e das listagens.
      // Isso evita que o usuário continue aparecendo caso a exclusão no banco não conclua instantaneamente
      // ou se o Supabase bloquear silenciosamente a deleção via RLS.
      setAllProfiles((prev) => prev.filter((p) => p.id !== id));
      setPendingProfiles((prev) => prev.filter((p) => p.id !== id));

      toast.success('Usuário removido.');

      // Atualiza apenas as métricas, sem refazer o loadData completo para não sobrescrever a UI
      await loadMetrics();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir. Verifique se existem ofertas, revisões ou transações vinculadas a este perfil.');
    }
  };

  const handlePromoteToAdmin = async (id, name) => {
    if (!window.confirm(`Promover ${name || 'este usuário'} para Administrador?`)) return;

    try {
      const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', id);
      if (error) throw error;

      toast.success('Usuário promovido para admin!');
      await Promise.all([loadData(), loadMetrics()]);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao promover usuário');
    }
  };

  const handleDemoteToUser = async (id, name) => {
    if (!window.confirm(`Rebaixar ${name || 'este administrador'} para usuário comum?`)) return;

    try {
      const { error } = await supabase.from('profiles').update({ role: 'user' }).eq('id', id);
      if (error) throw error;

      toast.success('Administrador rebaixado para usuário.');
      await Promise.all([loadData(), loadMetrics()]);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao alterar role');
    }
  };

  // =========================
  // HANDLERS - OFERTAS
  // =========================
  const handleToggleOfferActive = async (id, current, offer) => {
    try {
      const next = !current;
      const { error } = await supabase.from('offers').update({ active: next }).eq('id', id);
      if (error) throw error;

      if (next && offer.profiles?.whatsapp) {
        await whatsappService.notifyOfferApproved(
          offer.profiles.whatsapp,
          offer.profiles.name || 'Usuário',
          offer.title
        );
      }

      toast.success(next ? 'Oferta ativada/aprovada.' : 'Oferta pausada/rejeitada.');
      await Promise.all([loadData(), loadMetrics()]);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao alterar status da oferta');
    }
  };

  // =========================
  // HANDLERS - VENDAS
  // =========================
  const handleApproveSale = async (id) => {
    try {
      const { error } = await supabase
        .from('sales_reports')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast.success('Venda aprovada!');
      await Promise.all([loadData(), loadMetrics()]);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao aprovar venda');
    }
  };

  const handleRejectSale = async (id) => {
    const reason = window.prompt('Motivo da rejeição:') ?? '';
    try {
      const { error } = await supabase
        .from('sales_reports')
        .update({
          status: 'rejected',
          admin_notes: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Venda rejeitada.');
      await Promise.all([loadData(), loadMetrics()]);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao rejeitar venda');
    }
  };

  // =========================
  // HANDLERS - REVIEWS
  // =========================
  const handleApproveReview = async (id) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;

      toast.success('Avaliação aprovada!');
      await Promise.all([loadData(), loadMetrics()]);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao aprovar avaliação');
    }
  };

  const handleRemoveReview = async (id) => {
    if (!window.confirm('Remover esta avaliação?')) return;

    try {
      const { error } = await supabase
        .from('reviews')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

      toast.success('Avaliação removida/rejeitada.');
      await Promise.all([loadData(), loadMetrics()]);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao remover avaliação');
    }
  };

  // =========================
  // PDF
  // =========================
  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      await generateMetricsReport(
        metrics,
        [],
        [],
        {
          totalReviews: metrics.totalReviews,
          averageRating: metrics.averageRating,
        }
      );
      toast.success('PDF gerado com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-slate-50 py-4 sm:py-8 px-3 sm:px-4">
      <div className="container max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <header className="flex flex-col sm:flex-row justify-between sm:items-end gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Painel Administrativo</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gerencie usuários, avaliações, ofertas e mediações
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => Promise.all([loadData(), loadMetrics()])} variant="ghost" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </header>

        <Tabs defaultValue="profiles" className="w-full">
          <div className="overflow-x-auto pb-2 -mx-3 px-3">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-7 gap-1 p-1">
              <TabsTrigger value="metrics" className="text-xs sm:text-sm">
                <BarChart3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Métricas</span>
              </TabsTrigger>

              <TabsTrigger value="pending-offers" className="text-xs sm:text-sm">
                <Package className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Pendentes</span> ({pendingOffers.length})
              </TabsTrigger>

              <TabsTrigger value="profiles" className="text-xs sm:text-sm">
                <Users className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Perfis</span> ({pendingProfiles.length})
              </TabsTrigger>

              <TabsTrigger value="sales" className="text-xs sm:text-sm">
                <DollarSign className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Vendas</span> ({pendingSales.length})
              </TabsTrigger>

              <TabsTrigger value="reviews" className="text-xs sm:text-sm">
                <Star className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Avaliações</span> ({pendingReviews.length})
              </TabsTrigger>

              <TabsTrigger value="offers" className="text-xs sm:text-sm">
                <ShoppingBag className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Ofertas</span> ({allOffers.length})
              </TabsTrigger>

              <TabsTrigger value="disputes" className="text-xs sm:text-sm">
                <AlertTriangle className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Mediações</span> ({disputes.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ========================= TAB: MÉTRICAS ========================= */}
          <TabsContent value="metrics" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-lg font-semibold">Indicadores de Desempenho</h2>
              <Button onClick={handleGeneratePdf} disabled={generatingPdf} size="sm">
                {generatingPdf ? (
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exportar Relatório PDF
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground">USUÁRIOS</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalUsers}</div>
                  <p className="text-xs text-green-600">{metrics.approvedUsers} aprovados</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground">RECEITA</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    R$ {Number(metrics.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-blue-600">{metrics.totalSales} vendas aprovadas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground">OFERTAS</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalOffers}</div>
                  <p className="text-xs text-orange-600">{metrics.activeOffers} ativas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground">MÉDIA AVALIAÇÃO</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Number(metrics.averageRating || 0).toFixed(1)} ⭐</div>
                  <p className="text-xs text-purple-600">{metrics.totalReviews} avaliações</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Últimas Movimentações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.recentSales.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Nenhuma movimentação encontrada.
                          </TableCell>
                        </TableRow>
                      ) : (
                        metrics.recentSales.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>
                              {s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : '-'}
                            </TableCell>
                            <TableCell className="font-medium">
                              {s.userName || `ID: ${String(s.user_id).slice(0, 6)}`}
                            </TableCell>
                            <TableCell>
                              R$ {Number(s.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={s.status === 'approved' ? 'default' : 'outline'}>
                                {s.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================= TAB: PENDENTES (OFERTAS) ========================= */}
          <TabsContent value="pending-offers">
            <div className="grid gap-4">
              {pendingOffers.length === 0 ? (
                <Card className="py-12 text-center text-muted-foreground">
                  <CardContent>Nenhuma oferta aguardando revisão.</CardContent>
                </Card>
              ) : (
                pendingOffers.map((o) => (
                  <Card key={o.id} className="border-yellow-200 bg-yellow-50/20">
                    <CardContent className="pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1">
                        <h3 className="font-bold text-lg">{o.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          Vendedor: {o.profiles?.name || '-'} | WhatsApp: {o.profiles?.whatsapp || '-'}
                        </p>
                        <p className="text-sm line-clamp-2">{o.description || '-'}</p>
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                          className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
                          size="sm"
                          onClick={() => handleToggleOfferActive(o.id, false, o)}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Aprovar
                        </Button>

                        <Button
                          className="flex-1 sm:flex-none"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleToggleOfferActive(o.id, true, o)}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Rejeitar/Pausar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* ========================= TAB: PERFIS (COMPLETA) ========================= */}
          <TabsContent value="profiles">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Gerenciamento de Perfis
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Filtros */}
                <div className="flex flex-col lg:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Pesquisar por nome ou WhatsApp..."
                      value={profileSearch}
                      onChange={(e) => setProfileSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={profileRoleFilter} onValueChange={(v) => setProfileRoleFilter(v)}>
                    <SelectTrigger className="w-full lg:w-44">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Roles</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                      <SelectItem value="user">Usuários</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={profileStatusFilter}
                    onValueChange={(v) => setProfileStatusFilter(v)}
                  >
                    <SelectTrigger className="w-full lg:w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="approved">Aprovados</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Cards resumo */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="bg-slate-50">
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold">{profileStats.total}</div>
                      <p className="text-sm text-muted-foreground">Total</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-green-50">
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-green-600">{profileStats.approved}</div>
                      <p className="text-sm text-muted-foreground">Aprovados</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-yellow-50">
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-yellow-600">{profileStats.pending}</div>
                      <p className="text-sm text-muted-foreground">Pendentes</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-blue-50">
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-blue-600">{profileStats.admins}</div>
                      <p className="text-sm text-muted-foreground">Admins</p>
                    </CardContent>
                  </Card>
                </div>

                {/* DESKTOP TABLE */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>WhatsApp</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead className="text-right min-w-[420px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredProfiles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhum perfil encontrado com os filtros aplicados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProfiles.map((p) => {
                          const isSelf = profile?.id === p.id;
                          const isAdmin = p.role === 'admin';
                          const isApproved = !!p.is_approved;

                          return (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.name || 'Sem nome'}</TableCell>

                              <TableCell className="text-muted-foreground">
                                {p.whatsapp || '-'}
                              </TableCell>

                              <TableCell>
                                <Badge
                                  variant={isAdmin ? 'default' : 'outline'}
                                  className={isAdmin ? 'bg-blue-600 hover:bg-blue-600' : ''}
                                >
                                  {isAdmin ? 'Admin' : 'Usuário'}
                                </Badge>
                              </TableCell>

                              <TableCell>
                                <Badge
                                  className={
                                    isApproved
                                      ? 'bg-green-100 text-green-700 hover:bg-green-100'
                                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                                  }
                                >
                                  {isApproved ? 'Aprovado' : 'Pendente'}
                                </Badge>
                                {p.status === 'suspended' && (
                                  <Badge variant="destructive" className="ml-2 mt-1 lg:mt-0">Suspenso</Badge>
                                )}
                              </TableCell>

                              <TableCell>
                                {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '-'}
                              </TableCell>

                              <TableCell className="text-right">
                                <div className="flex flex-wrap justify-end gap-2">
                                  {/* Aprovar / Desaprovar */}
                                  {!isApproved ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleApproveProfile(p.id)}
                                      title="Aprovar"
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Aprovar
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-orange-600 border-orange-200"
                                      onClick={() => handleRejectProfile(p.id)}
                                      title="Desaprovar"
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Desaprovar
                                    </Button>
                                  )}

                                  {/* Role */}
                                  {!isAdmin ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-blue-600 border-blue-200"
                                      onClick={() => handlePromoteToAdmin(p.id, p.name)}
                                      title="Tornar Admin"
                                    >
                                      <Shield className="h-4 w-4 mr-1" />
                                      Tornar Admin
                                    </Button>
                                  ) : (
                                    !isSelf && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-indigo-600 border-indigo-200"
                                        onClick={() => handleDemoteToUser(p.id, p.name)}
                                        title="Tornar Usuário"
                                      >
                                        <ShieldOff className="h-4 w-4 mr-1" />
                                        Tornar Usuário
                                      </Button>
                                    )
                                  )}

                                  {/* Suspender / Ativar */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={p.status === 'suspended' ? "text-green-600 border-green-200" : "text-amber-600 border-amber-200"}
                                    disabled={isSelf}
                                    onClick={() => handleToggleProfileStatus(p.id, p.status || 'active', p.name)}
                                    title={p.status === 'suspended' ? 'Reativar Conta' : 'Suspender Conta'}
                                  >
                                    {p.status === 'suspended' ? <CheckCircle className="h-4 w-4 mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                                    {p.status === 'suspended' ? 'Reativar' : 'Suspender'}
                                  </Button>

                                  {/* Excluir (bloqueia autoexclusão) */}
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={isSelf}
                                    onClick={() => handleDeleteProfile(p.id, p.name)}
                                    title={isSelf ? 'Você não pode excluir seu próprio perfil' : 'Excluir permanentemente'}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Excluir
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* MOBILE / TABLET CARDS */}
                <div className="lg:hidden space-y-3">
                  {filteredProfiles.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        Nenhum perfil encontrado com os filtros aplicados.
                      </CardContent>
                    </Card>
                  ) : (
                    filteredProfiles.map((p) => {
                      const isSelf = profile?.id === p.id;
                      const isAdmin = p.role === 'admin';
                      const isApproved = !!p.is_approved;

                      return (
                        <Card key={p.id} className="border">
                          <CardContent className="pt-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-base">{p.name || 'Sem nome'}</p>
                                <p className="text-sm text-muted-foreground">{p.whatsapp || '-'}</p>
                              </div>

                              <div className="flex flex-col gap-1 items-end">
                                <Badge
                                  variant={isAdmin ? 'default' : 'outline'}
                                  className={isAdmin ? 'bg-blue-600 hover:bg-blue-600' : ''}
                                >
                                  {isAdmin ? 'Admin' : 'Usuário'}
                                </Badge>

                                <div className="flex gap-1 flex-wrap justify-end">
                                  <Badge
                                    className={
                                      isApproved
                                        ? 'bg-green-100 text-green-700 hover:bg-green-100'
                                        : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                                    }
                                  >
                                    {isApproved ? 'Aprovado' : 'Pendente'}
                                  </Badge>
                                  {p.status === 'suspended' && (
                                    <Badge variant="destructive">Suspenso</Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-xs text-muted-foreground">
                              Cadastro: {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '-'}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {!isApproved ? (
                                <Button size="sm" onClick={() => handleApproveProfile(p.id)}>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Aprovar
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-orange-600 border-orange-200"
                                  onClick={() => handleRejectProfile(p.id)}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Desaprovar
                                </Button>
                              )}

                              {!isAdmin ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-blue-600 border-blue-200"
                                  onClick={() => handlePromoteToAdmin(p.id, p.name)}
                                >
                                  <Shield className="h-4 w-4 mr-1" />
                                  Tornar Admin
                                </Button>
                              ) : (
                                !isSelf && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-indigo-600 border-indigo-200"
                                    onClick={() => handleDemoteToUser(p.id, p.name)}
                                  >
                                    <ShieldOff className="h-4 w-4 mr-1" />
                                    Tornar Usuário
                                  </Button>
                                )
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                className={p.status === 'suspended' ? "text-green-600 border-green-200 sm:col-span-2" : "text-amber-600 border-amber-200 sm:col-span-2"}
                                disabled={isSelf}
                                onClick={() => handleToggleProfileStatus(p.id, p.status || 'active', p.name)}
                              >
                                {p.status === 'suspended' ? <CheckCircle className="h-4 w-4 mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                                {p.status === 'suspended' ? 'Reativar Conta' : 'Suspender Conta'}
                              </Button>

                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={isSelf}
                                onClick={() => handleDeleteProfile(p.id, p.name)}
                                className="sm:col-span-2"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Excluir Permanentemente
                              </Button>
                            </div>

                            {isSelf && (
                              <p className="text-xs text-muted-foreground">
                                Você não pode alterar sua própria role para usuário nem excluir seu próprio perfil.
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================= TAB: VENDAS ========================= */}
          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <CardTitle>Validação de Vendas</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {pendingSales.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground">
                    Nenhuma venda aguardando validação.
                  </p>
                ) : (
                  pendingSales.map((s) => (
                    <Card key={s.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex-1">
                          <p className="font-bold text-lg">{s.userName || 'Usuário'}</p>
                          <p className="text-sm text-muted-foreground">
                            Reportou uma venda de{' '}
                            <span className="font-bold text-green-700">
                              R$ {Number(s.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </p>

                          {s.proof_image ? (
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto text-blue-600"
                              onClick={() => setProofImageDialog({ open: true, url: s.proof_image || '' })}
                            >
                              <ImageIcon className="mr-1 h-4 w-4" />
                              Visualizar Comprovante
                            </Button>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1">Sem comprovante anexado.</p>
                          )}
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => handleApproveSale(s.id)}>
                            Validar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 sm:flex-none"
                            onClick={() => handleRejectSale(s.id)}
                          >
                            Rejeitar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================= TAB: REVIEWS ========================= */}
          <TabsContent value="reviews">
            <div className="grid gap-4">
              {pendingReviews.length === 0 ? (
                <Card className="py-12 text-center text-muted-foreground">
                  <CardContent>Nenhuma avaliação para moderar.</CardContent>
                </Card>
              ) : (
                pendingReviews.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="pt-6 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-bold">{r.author?.name || 'Usuário'}</p>
                          <p className="text-sm text-muted-foreground italic">
                            Sobre: {r.offer?.title || 'Oferta'}
                          </p>
                        </div>

                        <div className="flex">
                          {[...Array(Number(r.rating || 0))].map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      </div>

                      <p className="text-sm bg-slate-50 p-3 rounded-md">
                        “{r.comment || 'Sem comentário'}”
                      </p>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-200 text-green-700"
                          onClick={() => handleApproveReview(r.id)}
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => handleRemoveReview(r.id)}
                        >
                          Remover
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* ========================= TAB: OFERTAS ========================= */}
          <TabsContent value="offers">
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {allOffers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Nenhuma oferta cadastrada.
                          </TableCell>
                        </TableRow>
                      ) : (
                        allOffers.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium">{o.title}</TableCell>
                            <TableCell>{o.profiles?.name || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={o.active ? 'default' : 'outline'}>
                                {o.active ? 'Ativa' : 'Pausada'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleOfferActive(o.id, o.active, o)}
                              >
                                {o.active ? 'Pausar' : 'Ativar'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================= TAB: DISPUTES ========================= */}
          <TabsContent value="disputes">
            <div className="grid gap-4">
              {disputes.length === 0 ? (
                <Card className="py-12 text-center text-muted-foreground">
                  <CardContent>Nenhum conflito registrado.</CardContent>
                </Card>
              ) : (
                disputes.map((d) => (
                  <Card
                    key={d.id}
                    className="hover:border-primary transition-colors cursor-pointer"
                    onClick={() => navigate('/mediacao')}
                  >
                    <CardContent className="pt-6 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold">{d.title || 'Mediação'}</h3>
                        <p className="text-sm text-muted-foreground">
                          Partes: {d.complainant?.name || '-'} vs {d.defendant?.name || '-'}
                        </p>
                        <Badge className="mt-2" variant="outline">
                          {d.status || 'aberta'}
                        </Badge>
                      </div>
                      <ExternalLink className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* DIALOG - COMPROVANTE */}
      <Dialog
        open={proofImageDialog.open}
        onOpenChange={(open) => setProofImageDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprovante de Pagamento</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
            <div className="w-full aspect-video bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border">
              {proofImageDialog.url ? (
                <img
                  src={proofImageDialog.url}
                  className="max-h-full object-contain"
                  alt="Comprovante"
                />
              ) : (
                <Loader2 className="animate-spin" />
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => window.open(proofImageDialog.url, '_blank')}
                variant="outline"
                disabled={!proofImageDialog.url}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver em nova aba
              </Button>

              <Button
                onClick={() => setProofImageDialog({ open: false, url: '' })}
                variant="ghost"
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
