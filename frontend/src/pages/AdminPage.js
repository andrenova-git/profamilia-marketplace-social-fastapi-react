import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { whatsappService } from '@/lib/whatsappService';
import { generateMetricsReport } from '@/lib/pdfReport';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Users, MessageSquare, AlertTriangle, Package, BarChart3, DollarSign, TrendingUp, ShoppingBag, Star, Search, UserCheck, Shield, Image as ImageIcon, ExternalLink, RefreshCw, FileText, Download, Calendar, Clock } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [profileSearch, setProfileSearch] = useState('');
  const [profileRoleFilter, setProfileRoleFilter] = useState('all');
  const [profileStatusFilter, setProfileStatusFilter] = useState('all');
  const [allOffers, setAllOffers] = useState([]);
  const [pendingOffers, setPendingOffers] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [pendingSales, setPendingSales] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [proofImageDialog, setProofImageDialog] = useState({ open: false, url: '' });
  const [reviewCounts, setReviewCounts] = useState({});
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [salesByMonth, setSalesByMonth] = useState([]);
  const [offersByMonth, setOffersByMonth] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [salesFilter, setSalesFilter] = useState('pending');
  const [metrics, setMetrics] = useState({
    totalOffers: 0,
    activeOffers: 0,
    totalUsers: 0,
    approvedUsers: 0,
    totalContacts: 0,
    totalSales: 0,
    totalRevenue: 0,
    recentSales: [],
    totalReviews: 0,
    averageRating: 0,
    salesApproved: 0,
    salesPending: 0,
    salesRejected: 0,
    totalSalesReports: 0,
    averageSaleValue: 0
  });
  const navigate = useNavigate();

  const loadMetrics = useCallback(async () => {
    try {
      // Total de ofertas
      const { count: totalOffers } = await supabase
        .from('offers')
        .select('*', { count: 'exact', head: true });

      // Ofertas ativas
      const { count: activeOffers } = await supabase
        .from('offers')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);

      // Total de usuários
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Usuários aprovados
      const { count: approvedUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_approved', true);

      // Métricas de avaliações
      let totalReviews = 0;
      let averageRating = 0;
      try {
        const { data: reviewsData, count: reviewCount } = await supabase
          .from('reviews')
          .select('rating', { count: 'exact' })
          .eq('status', 'approved');

        totalReviews = reviewCount || 0;
        if (reviewsData && reviewsData.length > 0) {
          const sumRatings = reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0);
          averageRating = sumRatings / reviewsData.length;
        }
      } catch (e) {
        console.log('Erro ao carregar avaliações');
      }

      // Tentar carregar métricas de contatos e vendas
      let totalContacts = 0;
      let totalSales = 0;
      let totalRevenue = 0;
      let recentSales = [];
      let salesApproved = 0;
      let salesPending = 0;
      let salesRejected = 0;
      let totalSalesReports = 0;
      let averageSaleValue = 0;

      try {
        const { count } = await supabase
          .from('contact_logs')
          .select('*', { count: 'exact', head: true });
        totalContacts = count || 0;
      } catch (e) {
        console.log('Tabela contact_logs não existe ainda');
      }

      try {
        const { data: allSalesData, error: salesError } = await supabase
          .from('sales_reports')
          .select('*')
          .order('created_at', { ascending: false });

        if (salesError) {
          console.error('Erro ao carregar vendas:', salesError);
        }

        if (allSalesData && allSalesData.length > 0) {
          const userIds = [...new Set(allSalesData.map(s => s.user_id))];
          const offerIds = [...new Set(allSalesData.map(s => s.offer_id))];

          const [usersRes, offersRes] = await Promise.all([
            supabase.from('profiles').select('id, name').in('id', userIds),
            supabase.from('offers').select('id, title').in('id', offerIds)
          ]);

          const usersMap = {};
          const offersMap = {};

          (usersRes.data || []).forEach(u => { usersMap[u.id] = u; });
          (offersRes.data || []).forEach(o => { offersMap[o.id] = o; });

          const enrichedSales = allSalesData.map(sale => ({
            ...sale,
            user: usersMap[sale.user_id] || null,
            offer: offersMap[sale.offer_id] || null
          }));

          recentSales = enrichedSales.slice(0, 10);
          totalSalesReports = enrichedSales.length;

          salesApproved = enrichedSales.filter(s => s.status === 'approved').length;
          salesPending = enrichedSales.filter(s => s.status === 'pending').length;
          salesRejected = enrichedSales.filter(s => s.status === 'rejected').length;

          const approvedSales = enrichedSales.filter(s => s.status === 'approved');
          totalRevenue = approvedSales.reduce((sum, sale) => sum + parseFloat(sale.amount || 0), 0);
          totalSales = approvedSales.length;
          averageSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
        }
      } catch (e) {
        console.log('Tabela sales_reports não existe ainda');
      }

      setMetrics({
        totalOffers: totalOffers || 0,
        activeOffers: activeOffers || 0,
        totalUsers: totalUsers || 0,
        approvedUsers: approvedUsers || 0,
        totalContacts,
        totalSales,
        totalRevenue,
        recentSales,
        totalReviews,
        averageRating,
        salesApproved,
        salesPending,
        salesRejected,
        totalSalesReports,
        averageSaleValue
      });
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    }
  }, []);

  const loadSalesByMonth = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('sales_reports')
        .select('created_at, amount, status')
        .eq('status', 'approved')
        .order('created_at', { ascending: true });

      if (data) {
        const grouped = {};
        data.forEach(sale => {
          const date = new Date(sale.created_at);
          const key = `${date.getMonth() + 1}/${date.getFullYear()}`;
          if (!grouped[key]) {
            grouped[key] = { count: 0, total: 0 };
          }
          grouped[key].count++;
          grouped[key].total += parseFloat(sale.amount || 0);
        });

        const result = Object.entries(grouped).map(([monthYear, data]) => ({
          monthYear,
          count: data.count,
          total: data.total
        }));
        setSalesByMonth(result);
      }
    } catch (e) {
      console.log('Erro ao carregar vendas por mês');
    }
  }, []);

  const loadOffersByMonth = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('offers')
        .select('created_at')
        .order('created_at', { ascending: true });

      if (data) {
        const grouped = {};
        data.forEach(offer => {
          const date = new Date(offer.created_at);
          const key = `${date.getMonth() + 1}/${date.getFullYear()}`;
          if (!grouped[key]) {
            grouped[key] = 0;
          }
          grouped[key]++;
        });

        const result = Object.entries(grouped).map(([monthYear, count]) => ({
          monthYear,
          count
        }));
        setOffersByMonth(result);
      }
    } catch (e) {
      console.log('Erro ao carregar ofertas por mês');
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [profilesRes, allProfilesRes, offersRes, reviewsRes, disputesRes, salesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('is_approved', false),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('offers').select(`
          *,
          profiles!owner_id(name, whatsapp, is_approved)
        `).order('created_at', { ascending: false }),
        supabase.from('reviews').select(`
          *,
          offer:offers(title),
          author:profiles(name)
        `).eq('status', 'pending'),
        supabase.from('disputes').select(`
          *,
          offer:offers(title),
          complainant:complainant_id(name),
          defendant:defendant_id(name)
        `).order('created_at', { ascending: false }),
        supabase.from('sales_reports').select('*').eq('status', 'pending').order('created_at', { ascending: false })
      ]);

      let enrichedPendingSales = [];
      if (salesRes.data && salesRes.data.length > 0) {
        const userIds = [...new Set(salesRes.data.map(s => s.user_id))];
        const offerIds = [...new Set(salesRes.data.map(s => s.offer_id))];

        const [usersRes2, offersRes2] = await Promise.all([
          supabase.from('profiles').select('id, name').in('id', userIds),
          supabase.from('offers').select('id, title').in('id', offerIds)
        ]);

        const usersMap = {};
        const offersMap = {};
        (usersRes2.data || []).forEach(u => { usersMap[u.id] = u; });
        (offersRes2.data || []).forEach(o => { offersMap[o.id] = o; });

        enrichedPendingSales = salesRes.data.map(sale => ({
          ...sale,
          user: usersMap[sale.user_id] || null,
          offer: offersMap[sale.offer_id] || null
        }));
      }

      setPendingProfiles(profilesRes.data || []);
      setAllProfiles(allProfilesRes.data || []);
      setAllOffers(offersRes.data || []);
      setPendingOffers((offersRes.data || []).filter(o => !o.active));
      setPendingReviews(reviewsRes.data || []);
      setDisputes(disputesRes.data || []);
      setPendingSales(enrichedPendingSales);

      if (reviewsRes.data && reviewsRes.data.length > 0) {
        const counts = {};
        for (const review of reviewsRes.data) {
          const key = `${review.offer_id}_${review.author_id}`;
          if (!counts[key]) {
            const { count } = await supabase
              .from('reviews')
              .select('*', { count: 'exact', head: true })
              .eq('offer_id', review.offer_id)
              .eq('author_id', review.author_id)
              .neq('id', review.id);
            counts[key] = count || 0;
          }
        }
        setReviewCounts(counts);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAdmin = useCallback(async () => {
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

    if (profileData?.role !== 'admin') {
      toast.error('Acesso negado. Apenas administradores.');
      navigate('/');
      return;
    }

    setProfile(profileData);
    loadData();
    loadMetrics();
    loadSalesByMonth();
    loadOffersByMonth();
  }, [navigate, loadData, loadMetrics, loadSalesByMonth, loadOffersByMonth]);

  useEffect(() => {
    checkAdmin();
  }, [checkAdmin]);

  const loadAllSales = useCallback(async () => {
    try {
      let query = supabase
        .from('sales_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (salesFilter !== 'all') {
        query = query.eq('status', salesFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro loadAllSales:', error);
        return;
      }

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(s => s.user_id))];
        const offerIds = [...new Set(data.map(s => s.offer_id))];

        const [usersRes, offersRes] = await Promise.all([
          supabase.from('profiles').select('id, name').in('id', userIds),
          supabase.from('offers').select('id, title').in('id', offerIds)
        ]);

        const usersMap = {};
        const offersMap = {};

        (usersRes.data || []).forEach(u => { usersMap[u.id] = u; });
        (offersRes.data || []).forEach(o => { offersMap[o.id] = o; });

        const enrichedData = data.map(sale => ({
          ...sale,
          user: usersMap[sale.user_id] || null,
          offer: offersMap[sale.offer_id] || null
        }));

        setAllSales(enrichedData);
      } else {
        setAllSales([]);
      }
    } catch (e) {
      console.error('Erro ao carregar vendas:', e);
    }
  }, [salesFilter]);

  useEffect(() => {
    loadAllSales();
  }, [loadAllSales]);

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      const reviewsData = {
        totalReviews: metrics.totalReviews,
        averageRating: metrics.averageRating
      };

      await generateMetricsReport(metrics, salesByMonth, offersByMonth, reviewsData);
      toast.success('Relatório PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar relatório');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleApproveProfile = async (profileId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', profileId);

      if (error) throw error;

      toast.success('Perfil aprovado!');
      setPendingProfiles(pendingProfiles.filter(p => p.id !== profileId));
    } catch (error) {
      toast.error('Erro ao aprovar perfil');
    }
  };

  const handleToggleOfferActive = async (offerId, currentStatus, offer) => {
    try {
      const { error } = await supabase
        .from('offers')
        .update({ active: !currentStatus })
        .eq('id', offerId);

      if (error) throw error;

      if (!currentStatus && offer?.profiles?.whatsapp) {
        await whatsappService.notifyOfferApproved(
          offer.profiles.whatsapp,
          offer.profiles.name,
          offer.title
        );
        toast.success('Oferta aprovada! Vendedor notificado.');
      } else if (currentStatus) {
        toast.success('Oferta desativada!');
      }

      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar oferta');
    }
  };

  const handleRejectOffer = async (offer) => {
    if (!window.confirm(`Tem certeza que deseja rejeitar a oferta "${offer.title}"?`)) return;

    try {
      const { error } = await supabase
        .from('offers')
        .delete()
        .eq('id', offer.id);

      if (error) throw error;

      if (offer?.profiles?.whatsapp) {
        await whatsappService.notifyOfferRejected(
          offer.profiles.whatsapp,
          offer.profiles.name,
          offer.title
        );
      }

      toast.success('Oferta rejeitada e vendedor notificado.');
      loadData();
    } catch (error) {
      toast.error('Erro ao rejeitar oferta');
    }
  };

  const handleDeleteOffer = async (offerId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta oferta?')) return;

    try {
      const { error } = await supabase
        .from('offers')
        .delete()
        .eq('id', offerId);

      if (error) throw error;

      toast.success('Oferta excluída!');
      loadData();
    } catch (error) {
      toast.error('Erro ao excluir oferta');
    }
  };

  const handleApproveReview = async (reviewId) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ status: 'approved' })
        .eq('id', reviewId);

      if (error) throw error;

      toast.success('Avaliação aprovada!');
      setPendingReviews(pendingReviews.filter(r => r.id !== reviewId));
    } catch (error) {
      toast.error('Erro ao aprovar avaliação');
    }
  };

  const handleRejectReview = async (reviewId) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ status: 'rejected' })
        .eq('id', reviewId);

      if (error) throw error;

      toast.success('Avaliação rejeitada!');
      setPendingReviews(pendingReviews.filter(r => r.id !== reviewId));
    } catch (error) {
      toast.error('Erro ao rejeitar avaliação');
    }
  };

  const handleApproveSale = async (saleId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { error } = await supabase
        .from('sales_reports')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: session?.user?.id
        })
        .eq('id', saleId);

      if (error) throw error;

      toast.success('Venda aprovada e contabilizada!');
      setPendingSales(pendingSales.filter(s => s.id !== saleId));
      setAllSales(allSales.map(s => s.id === saleId ? { ...s, status: 'approved', reviewed_at: new Date().toISOString() } : s));
      loadMetrics();
      loadSalesByMonth();
    } catch (error) {
      console.error('Erro ao aprovar venda:', error);
      toast.error('Erro ao aprovar venda');
    }
  };

  const handleRejectSale = async (saleId) => {
    const reason = window.prompt('Motivo da rejeição (opcional):');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { error } = await supabase
        .from('sales_reports')
        .update({
          status: 'rejected',
          admin_notes: reason || 'Comprovante não verificado',
          reviewed_at: new Date().toISOString(),
          reviewed_by: session?.user?.id
        })
        .eq('id', saleId);

      if (error) throw error;

      toast.success('Venda rejeitada.');
      setPendingSales(pendingSales.filter(s => s.id !== saleId));
      setAllSales(allSales.map(s => s.id === saleId ? { ...s, status: 'rejected', admin_notes: reason || 'Comprovante não verificado', reviewed_at: new Date().toISOString() } : s));
      loadMetrics();
    } catch (error) {
      console.error('Erro ao rejeitar venda:', error);
      toast.error('Erro ao rejeitar venda');
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
    <div className="min-h-screen bg-slate-50 py-4 sm:py-8 px-3 sm:px-4">
      <div className="container max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Painel Administrativo</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Gerencie usuários, avaliações e mediações</p>
        </div>

        <Tabs defaultValue="metrics" className="w-full">
          <div className="overflow-x-auto -mx-3 px-3 pb-2">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-7 gap-1 p-1">
              <TabsTrigger value="metrics" data-testid="tab-metrics" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3">
                <BarChart3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Métricas</span>
              </TabsTrigger>
              <TabsTrigger value="pending-offers" data-testid="tab-pending-offers" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3">
                <Package className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Pendentes</span>
                <span className="ml-1">({pendingOffers.length})</span>
              </TabsTrigger>
              <TabsTrigger value="profiles" data-testid="tab-profiles" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3">
                <Users className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Perfis</span>
                <span className="ml-1">({pendingProfiles.length})</span>
              </TabsTrigger>
              <TabsTrigger value="sales" data-testid="tab-sales" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3">
                <DollarSign className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Vendas</span>
                <span className="ml-1">({pendingSales.length})</span>
              </TabsTrigger>
              <TabsTrigger value="reviews" data-testid="tab-reviews" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3">
                <Star className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Avaliações</span>
                <span className="ml-1">({pendingReviews.length})</span>
              </TabsTrigger>
              <TabsTrigger value="offers" data-testid="tab-offers" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3">
                <ShoppingBag className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Ofertas</span>
                <span className="ml-1">({allOffers.length})</span>
              </TabsTrigger>
              <TabsTrigger value="disputes" data-testid="tab-disputes" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3">
                <AlertTriangle className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Mediações</span>
                <span className="ml-1">({disputes.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="metrics">
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Visão Geral da Plataforma</h2>
                  <p className="text-sm text-muted-foreground">Métricas e indicadores de desempenho</p>
                </div>
                <Button
                  data-testid="btn-export-pdf"
                  onClick={handleGeneratePdf}
                  disabled={generatingPdf}
                  className="w-full sm:w-auto"
                >
                  {generatingPdf ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Exportar Relatório PDF
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                <Card>
                  <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Total de Ofertas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                      <span className="text-xl sm:text-2xl font-bold">{metrics.totalOffers}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics.activeOffers} ativas
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Usuários
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                      <span className="text-xl sm:text-2xl font-bold">{metrics.totalUsers}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics.approvedUsers} aprovados
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Contatos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                      <span className="text-xl sm:text-2xl font-bold">{metrics.totalContacts}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      interesses
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Receita (Aprovada)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                      <span className="text-lg sm:text-2xl font-bold">
                        R$ {metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics.totalSales} vendas aprovadas
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                <Card>
                  <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Avaliações
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                      <span className="text-xl sm:text-2xl font-bold">{metrics.totalReviews}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      média: {metrics.averageRating.toFixed(1)} ⭐
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Vendas Pendentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                      <span className="text-xl sm:text-2xl font-bold">{metrics.salesPending}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      aguardando aprovação
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Ticket Médio
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                      <span className="text-lg sm:text-2xl font-bold">
                        R$ {metrics.averageSaleValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      por venda
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Total Reportado
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500" />
                      <span className="text-xl sm:text-2xl font-bold">{metrics.totalSalesReports}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics.salesRejected} rejeitadas
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Ofertas Postadas por Mês
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {offersByMonth.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nenhuma oferta registrada.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mês/Ano</TableHead>
                            <TableHead className="text-right">Quantidade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {offersByMonth.slice(-6).map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{item.monthYear}</TableCell>
                              <TableCell className="text-right">{item.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Vendas Aprovadas por Mês
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {salesByMonth.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nenhuma venda aprovada registrada.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mês/Ano</TableHead>
                            <TableHead className="text-right">Quantidade</TableHead>
                            <TableHead className="text-right">Valor Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salesByMonth.slice(-6).map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{item.monthYear}</TableCell>
                              <TableCell className="text-right">{item.count}</TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Vendas/Serviços Reportados Recentemente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics.recentSales.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        Nenhuma venda reportada ainda.
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Os vendedores podem reportar vendas em "Minhas Ofertas".
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Oferta</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metrics.recentSales.map(sale => (
                          <TableRow key={sale.id}>
                            <TableCell>
                              {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell className="font-medium">
                              {sale.user?.name || 'N/A'}
                            </TableCell>
                            <TableCell>{sale.offer?.title || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {sale.sale_type === 'venda' ? 'Venda' : 'Serviço'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              R$ {parseFloat(sale.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pending-offers">
            <Card>
              <CardHeader>
                <CardTitle>Ofertas Pendentes de Aprovação</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingOffers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma oferta pendente de aprovação
                  </p>
                ) : (
                  <div className="space-y-4">
                    {pendingOffers.map(offer => (
                      <Card key={offer.id} data-testid={`pending-offer-${offer.id}`} className="border-yellow-300 bg-yellow-50">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-lg">{offer.title}</h3>
                                <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                                  Aguardando Aprovação
                                </Badge>
                              </div>

                              <p className="text-sm text-muted-foreground mb-2">{offer.description}</p>

                              {offer.price && (
                                <p className="text-lg font-bold text-primary mb-2">
                                  R$ {parseFloat(offer.price).toFixed(2)}
                                </p>
                              )}

                              <div className="text-sm">
                                <span className="text-muted-foreground">Vendedor:</span>{' '}
                                <span className="font-medium">{offer.profiles?.name}</span>
                                {' | '}
                                <span className="text-muted-foreground">WhatsApp:</span>{' '}
                                <span>{offer.profiles?.whatsapp}</span>
                              </div>

                              <div className="text-xs text-muted-foreground mt-2">
                                Criada em {new Date(offer.created_at).toLocaleDateString('pt-BR')}
                              </div>

                              {offer.images && offer.images.length > 0 && (
                                <div className="flex gap-2 mt-3 overflow-x-auto">
                                  {offer.images.slice(0, 3).map((img, idx) => (
                                    <img
                                      key={idx}
                                      src={img}
                                      alt={`${offer.title} ${idx + 1}`}
                                      className="h-20 w-20 object-cover rounded border"
                                    />
                                  ))}
                                  {offer.images.length > 3 && (
                                    <div className="h-20 w-20 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-600">
                                      +{offer.images.length - 3}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-2">
                              <Button
                                data-testid={`btn-approve-offer-${offer.id}`}
                                size="sm"
                                onClick={() => handleToggleOfferActive(offer.id, offer.active, offer)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                data-testid={`btn-reject-offer-${offer.id}`}
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectOffer(offer)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profiles">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Gerenciamento de Perfis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-testid="input-search-profiles"
                      placeholder="Pesquisar por nome..."
                      value={profileSearch}
                      onChange={(e) => setProfileSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={profileRoleFilter} onValueChange={setProfileRoleFilter}>
                    <SelectTrigger data-testid="select-role-filter" className="w-full sm:w-40">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">Usuário</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={profileStatusFilter} onValueChange={setProfileStatusFilter}>
                    <SelectTrigger data-testid="select-status-filter" className="w-full sm:w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="approved">Aprovados</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-slate-700">{allProfiles.length}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {allProfiles.filter(p => p.is_approved).length}
                    </div>
                    <div className="text-xs text-muted-foreground">Aprovados</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {allProfiles.filter(p => !p.is_approved).length}
                    </div>
                    <div className="text-xs text-muted-foreground">Pendentes</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {allProfiles.filter(p => p.role === 'admin').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Admins</div>
                  </div>
                </div>

                {(() => {
                  const filteredProfiles = allProfiles.filter(p => {
                    const matchesSearch = p.name?.toLowerCase().includes(profileSearch.toLowerCase()) ||
                      p.whatsapp?.includes(profileSearch);
                    const matchesRole = profileRoleFilter === 'all' || p.role === profileRoleFilter;
                    const matchesStatus = profileStatusFilter === 'all' ||
                      (profileStatusFilter === 'approved' && p.is_approved) ||
                      (profileStatusFilter === 'pending' && !p.is_approved);
                    return matchesSearch && matchesRole && matchesStatus;
                  });

                  if (filteredProfiles.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">Nenhum perfil encontrado</p>
                        {(profileSearch || profileRoleFilter !== 'all' || profileStatusFilter !== 'all') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              setProfileSearch('');
                              setProfileRoleFilter('all');
                              setProfileStatusFilter('all');
                            }}
                          >
                            Limpar filtros
                          </Button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Mostrando {filteredProfiles.length} perfil(is)
                      </p>

                      <div className="md:hidden space-y-3">
                        {filteredProfiles.map(p => (
                          <Card key={p.id} data-testid={`profile-card-${p.id}`} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                  {p.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div>
                                  <p className="font-medium">{p.name || 'Sem nome'}</p>
                                  <p className="text-sm text-muted-foreground">{p.whatsapp || '-'}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {p.role === 'admin' ? (
                                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Admin
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">Usuário</Badge>
                                )}
                                {p.is_approved ? (
                                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                                    Aprovado
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-xs">
                                    Pendente
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Cadastro: {new Date(p.created_at).toLocaleDateString('pt-BR')}
                              </span>
                              {!p.is_approved && (
                                <Button
                                  data-testid={`btn-approve-profile-mobile-${p.id}`}
                                  size="sm"
                                  onClick={() => handleApproveProfile(p.id)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Aprovar
                                </Button>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>

                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>WhatsApp</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Cadastro</TableHead>
                              <TableHead>Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredProfiles.map(p => (
                              <TableRow key={p.id} data-testid={`profile-row-${p.id}`}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                                      {p.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <span className="font-medium">{p.name || 'Sem nome'}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {p.whatsapp || '-'}
                                </TableCell>
                                <TableCell>
                                  {p.role === 'admin' ? (
                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                                      <Shield className="h-3 w-3 mr-1" />
                                      Admin
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">
                                      Usuário
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {p.is_approved ? (
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                      <UserCheck className="h-3 w-3 mr-1" />
                                      Aprovado
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                                      Pendente
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {new Date(p.created_at).toLocaleDateString('pt-BR')}
                                </TableCell>
                                <TableCell>
                                  {!p.is_approved && (
                                    <Button
                                      data-testid={`btn-approve-profile-${p.id}`}
                                      size="sm"
                                      onClick={() => handleApproveProfile(p.id)}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Aprovar
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="offers">
            <Card>
              <CardHeader>
                <CardTitle>Todas as Ofertas</CardTitle>
              </CardHeader>
              <CardContent>
                {allOffers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma oferta cadastrada
                  </p>
                ) : (
                  <div className="space-y-4">
                    {allOffers.map(offer => (
                      <Card key={offer.id} data-testid={`offer-${offer.id}`} className={!offer.profiles?.is_approved ? 'border-yellow-300 bg-yellow-50' : ''}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-lg">{offer.title}</h3>
                                {!offer.profiles?.is_approved && (
                                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                                    Vendedor Pendente
                                  </Badge>
                                )}
                                {!offer.active && (
                                  <Badge variant="outline" className="bg-gray-100 text-gray-800">
                                    Inativa
                                  </Badge>
                                )}
                                {offer.active && offer.profiles?.is_approved && (
                                  <Badge variant="outline" className="bg-green-100 text-green-800">
                                    Publicada
                                  </Badge>
                                )}
                              </div>

                              <p className="text-sm text-muted-foreground mb-2">{offer.description}</p>

                              {offer.price && (
                                <p className="text-lg font-bold text-primary mb-2">
                                  R$ {parseFloat(offer.price).toFixed(2)}
                                </p>
                              )}

                              <div className="text-sm">
                                <span className="text-muted-foreground">Vendedor:</span>{' '}
                                <span className="font-medium">{offer.profiles?.name}</span>
                                {' | '}
                                <span className="text-muted-foreground">WhatsApp:</span>{' '}
                                <span>{offer.profiles?.whatsapp}</span>
                              </div>

                              <div className="text-xs text-muted-foreground mt-2">
                                Criada em {new Date(offer.created_at).toLocaleDateString('pt-BR')}
                              </div>

                              {offer.images && offer.images.length > 0 && (
                                <div className="flex gap-2 mt-3 overflow-x-auto">
                                  {offer.images.slice(0, 3).map((img, idx) => (
                                    <img
                                      key={idx}
                                      src={img}
                                      alt={`${offer.title} ${idx + 1}`}
                                      className="h-20 w-20 object-cover rounded border"
                                    />
                                  ))}
                                  {offer.images.length > 3 && (
                                    <div className="h-20 w-20 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-600">
                                      +{offer.images.length - 3}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-2">
                              <Button
                                data-testid={`btn-toggle-offer-${offer.id}`}
                                size="sm"
                                variant={offer.active ? "outline" : "default"}
                                onClick={() => handleToggleOfferActive(offer.id, offer.active, offer)}
                              >
                                {offer.active ? 'Desativar' : 'Ativar'}
                              </Button>
                              <Button
                                data-testid={`btn-delete-offer-${offer.id}`}
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteOffer(offer.id)}
                              >
                                Excluir
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Gestão de Vendas Reportadas
                  </CardTitle>
                  <Select value={salesFilter} onValueChange={setSalesFilter}>
                    <SelectTrigger data-testid="select-sales-filter" className="w-full sm:w-40">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="approved">Aprovadas</SelectItem>
                      <SelectItem value="rejected">Rejeitadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-yellow-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{metrics.salesPending}</div>
                    <div className="text-xs text-muted-foreground">Pendentes</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{metrics.salesApproved}</div>
                    <div className="text-xs text-muted-foreground">Aprovadas</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{metrics.salesRejected}</div>
                    <div className="text-xs text-muted-foreground">Rejeitadas</div>
                  </div>
                </div>

                {allSales.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      {salesFilter === 'pending' ? 'Nenhuma venda aguardando aprovação' :
                        salesFilter === 'approved' ? 'Nenhuma venda aprovada' :
                          salesFilter === 'rejected' ? 'Nenhuma venda rejeitada' :
                            'Nenhuma venda reportada'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allSales.map(sale => (
                      <Card
                        key={sale.id}
                        data-testid={`sale-${sale.id}`}
                        className={`border-l-4 ${sale.status === 'pending' ? 'border-l-yellow-500' :
                            sale.status === 'approved' ? 'border-l-green-500' :
                              'border-l-red-500'
                          }`}
                      >
                        <CardContent className="pt-6">
                          <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="font-semibold">{sale.user?.name}</span>
                                <Badge variant="outline">
                                  {sale.sale_type === 'venda' ? '🛍️ Venda' : '🔧 Serviço'}
                                </Badge>
                                <Badge
                                  className={
                                    sale.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                      sale.status === 'approved' ? 'bg-green-100 text-green-800' :
                                        'bg-red-100 text-red-800'
                                  }
                                >
                                  {sale.status === 'pending' ? '⏳ Pendente' :
                                    sale.status === 'approved' ? '✅ Aprovada' :
                                      '❌ Rejeitada'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-1">
                                Oferta: {sale.offer?.title}
                              </p>
                              <p className="text-xl font-bold text-green-600 mb-2">
                                R$ {parseFloat(sale.amount).toFixed(2)}
                              </p>
                              {sale.description && (
                                <p className="text-sm text-muted-foreground italic">
                                  "{sale.description}"
                                </p>
                              )}
                              {sale.admin_notes && (
                                <p className="text-sm text-red-600 mt-1">
                                  <strong>Motivo:</strong> {sale.admin_notes}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                Reportado em {new Date(sale.created_at).toLocaleString('pt-BR')}
                              </p>
                              {sale.reviewed_at && (
                                <p className="text-xs text-muted-foreground">
                                  Revisado em {new Date(sale.reviewed_at).toLocaleString('pt-BR')}
                                </p>
                              )}
                            </div>

                            <div className="w-full md:w-48">
                              {sale.proof_image ? (
                                <button
                                  type="button"
                                  onClick={() => setProofImageDialog({ open: true, url: sale.proof_image })}
                                  className="w-full aspect-square bg-slate-100 rounded-lg overflow-hidden border hover:border-primary transition-colors group"
                                >
                                  <img
                                    src={sale.proof_image}
                                    alt="Comprovante"
                                    className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                                  />
                                </button>
                              ) : (
                                <div className="w-full aspect-square bg-red-50 rounded-lg flex items-center justify-center border border-red-200">
                                  <div className="text-center">
                                    <ImageIcon className="h-8 w-8 mx-auto text-red-400 mb-1" />
                                    <span className="text-xs text-red-500">Sem comprovante</span>
                                  </div>
                                </div>
                              )}
                              <p className="text-xs text-center text-muted-foreground mt-1">
                                Clique para ampliar
                              </p>
                            </div>

                            {sale.status === 'pending' && (
                              <div className="flex flex-row md:flex-col gap-2 justify-end">
                                <Button
                                  data-testid={`btn-approve-sale-${sale.id}`}
                                  size="sm"
                                  onClick={() => handleApproveSale(sale.id)}
                                  className="flex-1 md:flex-none"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Aprovar
                                </Button>
                                <Button
                                  data-testid={`btn-reject-sale-${sale.id}`}
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRejectSale(sale.id)}
                                  className="flex-1 md:flex-none"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Rejeitar
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Avaliações Pendentes de Moderação
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingReviews.length === 0 ? (
                  <div className="text-center py-8">
                    <Star className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Nenhuma avaliação pendente</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingReviews.map(review => {
                      const key = `${review.offer_id}_${review.author_id}`;
                      const previousCount = reviewCounts[key] || 0;
                      const isRepeat = previousCount > 0;

                      return (
                        <Card
                          key={review.id}
                          data-testid={`pending-review-${review.id}`}
                          className={isRepeat ? 'border-l-4 border-l-orange-500' : ''}
                        >
                          <CardContent className="pt-6">
                            {isRepeat && (
                              <Alert className="bg-orange-50 border-orange-200 mb-4">
                                <RefreshCw className="h-4 w-4 text-orange-600" />
                                <AlertDescription className="text-orange-800 text-sm">
                                  <strong>⚠️ AVALIAÇÃO REPETIDA:</strong> Este usuário já avaliou esta oferta{' '}
                                  <strong>{previousCount}x</strong> anteriormente. Verifique se houve nova compra
                                  antes de aprovar.
                                </AlertDescription>
                              </Alert>
                            )}

                            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className="font-semibold">{review.author?.name}</span>
                                  <Badge variant="outline">⭐ {review.rating}/5</Badge>
                                  {review.evaluation_number && review.evaluation_number > 1 && (
                                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                                      {review.evaluation_number}ª avaliação
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-1">
                                  Oferta: {review.offer?.title}
                                </p>
                                <p className="text-sm bg-slate-50 p-3 rounded-lg">"{review.comment}"</p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Enviada em {new Date(review.created_at).toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                                <Button
                                  data-testid={`btn-approve-review-${review.id}`}
                                  size="sm"
                                  onClick={() => handleApproveReview(review.id)}
                                  className="flex-1 sm:flex-none"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Aprovar
                                </Button>
                                <Button
                                  data-testid={`btn-reject-review-${review.id}`}
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRejectReview(review.id)}
                                  className="flex-1 sm:flex-none"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Rejeitar
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="disputes">
            <Card>
              <CardHeader>
                <CardTitle>Mediações Online (ODR)</CardTitle>
              </CardHeader>
              <CardContent>
                {disputes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma mediação registrada
                  </p>
                ) : (
                  <div className="space-y-4">
                    {disputes.map(dispute => (
                      <Card key={dispute.id} data-testid={`mediation-${dispute.id}`}>
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <h3 className="font-semibold text-lg">{dispute.title}</h3>
                              <Badge
                                variant={dispute.status === 'resolved' ? 'default' : 'secondary'}
                              >
                                {dispute.status === 'open' ? 'Aberta' :
                                  dispute.status === 'in_mediation' ? 'Em Mediação' :
                                    dispute.status === 'resolved' ? 'Resolvida' : dispute.status}
                              </Badge>
                            </div>
                            <p className="text-sm">{dispute.description}</p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Solicitante:</span>
                                <p className="font-medium">{dispute.complainant?.name}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Vendedor:</span>
                                <p className="font-medium">{dispute.defendant?.name}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/mediacao`)}
                            >
                              Ir para Mediação
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={proofImageDialog.open} onOpenChange={(open) => setProofImageDialog({ ...proofImageDialog, open })}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Comprovante de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <img
              src={proofImageDialog.url}
              alt="Comprovante de pagamento"
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => window.open(proofImageDialog.url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir em nova aba
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}