import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { whatsappService } from '@/lib/whatsappService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, MapPin, Search, Filter, Loader2, ImageIcon, ChevronRight, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const CATEGORIES = [
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'artesanato', label: 'Artesanato' },
  { value: 'outros', label: 'Outros' }
];

export default function HomePage() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('all');
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [contactingOffer, setContactingOffer] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    loadOffers();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', session.user.id)
        .single();
      setCurrentUser(profile);
    }
  };

  const loadOffers = async () => {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select(`
          *,
          profiles (
            name,
            whatsapp,
            neighborhood
          )
        `)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOffers(data || []);
      
      const uniqueNeighborhoods = [...new Set(data?.map(o => o.neighborhood).filter(Boolean))];
      setNeighborhoods(uniqueNeighborhoods);
    } catch (error) {
      console.error('Erro ao carregar ofertas:', error);
      toast.error('Erro ao carregar ofertas');
    } finally {
      setLoading(false);
    }
  };

  const filteredOffers = offers.filter(offer => {
    const matchesSearch = offer.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         offer.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || offer.category === selectedCategory;
    const matchesNeighborhood = selectedNeighborhood === 'all' || offer.neighborhood === selectedNeighborhood;
    return matchesSearch && matchesCategory && matchesNeighborhood;
  });

  const handleContact = async (offer) => {
    setContactingOffer(offer.id);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        await supabase
          .from('contact_logs')
          .insert([{ offer_id: offer.id, buyer_id: session.user.id }])
          .catch(() => {});
      }
      
      const buyerName = currentUser?.name || 'Alguém';
      await whatsappService.notifySellerOfInterest(
        offer.profiles.whatsapp,
        offer.profiles.name,
        offer.title,
        buyerName
      );
      
      toast.success('O vendedor foi notificado do seu interesse!');
    } catch (error) {
      console.error('Erro ao notificar vendedor:', error);
    } finally {
      setContactingOffer(null);
    }
    
    const message = `Olá! Vi seu anúncio "${offer.title}" na plataforma Pró-Família e gostaria de mais informações.`;
    const whatsappLink = whatsappService.getWhatsAppLink(offer.profiles.whatsapp, message);
    window.open(whatsappLink, '_blank');
  };

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedNeighborhood('all');
    setSearchTerm('');
  };

  const hasActiveFilters = selectedCategory !== 'all' || selectedNeighborhood !== 'all' || searchTerm !== '';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* ===== HERO SECTION ===== */}
      <div className="relative hero-gradient text-white overflow-hidden">
        {/* Padrão de fundo sutil */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAzIi8+PC9nPjwvc3ZnPg==')] opacity-50"></div>
        
        {/* Container centralizado com max-width */}
        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 lg:pt-12 pb-20 sm:pb-24 lg:pb-28 text-center">
          <Badge className="mb-4 sm:mb-5 lg:mb-6 bg-white/20 text-white border-white/30 hover:bg-white/30 text-sm lg:text-base px-4 py-1">
            Comunidade Pró-Família Conecta
          </Badge>
          
          {/* Título principal com text-shadow para legibilidade */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-5 lg:mb-6 leading-tight"
              style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.35)' }}>
            Conectando Nossa<br />
            <span className="text-blue-100">Irmandade</span>
          </h1>
          
          {/* Descrição com fonte mais pesada e shadow */}
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white font-semibold max-w-3xl mx-auto leading-relaxed px-2"
             style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.45)' }}>
            A beneficência do ensinar a pescar — gerando renda, empreendedorismo e valorizando talentos da nossa comunidade
          </p>
        </div>
      </div>

      {/* ===== BARRA DE BUSCA ===== */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-10 lg:-mt-12 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-5 lg:p-6 border border-gray-100">
          
          {/* ===== VERSÃO MOBILE: Campo de busca + Botão de filtros ===== */}
          <div className="lg:hidden space-y-3">
            {/* Campo de Busca Principal */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                data-testid="input-search-mobile"
                placeholder="O que você está procurando?"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-13 text-base border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Filtros Colapsáveis */}
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full h-12 justify-between text-base rounded-xl border-gray-200"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtros
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-2 h-5 px-2 text-xs bg-primary/10 text-primary">
                        Ativos
                      </Badge>
                    )}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-3 space-y-3">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger data-testid="select-category-mobile" className="h-12 rounded-xl border-gray-200 bg-gray-50/50">
                    <Filter className="h-4 w-4 mr-2 text-gray-400" />
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Categorias</SelectItem>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood}>
                  <SelectTrigger data-testid="select-neighborhood-mobile" className="h-12 rounded-xl border-gray-200 bg-gray-50/50">
                    <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                    <SelectValue placeholder="Bairro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Bairros</SelectItem>
                    {neighborhoods.map(n => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    onClick={clearFilters}
                    className="w-full h-10 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar Filtros
                  </Button>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* ===== VERSÃO DESKTOP: Tudo em uma linha horizontal ===== */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Campo de Busca - Flex grow */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                data-testid="input-search-desktop"
                placeholder="O que você está procurando?"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-14 text-base border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Categoria - Fixed width */}
            <div className="w-52">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-category-desktop" className="h-14 rounded-xl border-gray-200 bg-gray-50/50">
                  <Filter className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bairro - Fixed width */}
            <div className="w-48">
              <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood}>
                <SelectTrigger data-testid="select-neighborhood-desktop" className="h-14 rounded-xl border-gray-200 bg-gray-50/50">
                  <MapPin className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                  <SelectValue placeholder="Bairro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Bairros</SelectItem>
                  {neighborhoods.map(n => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botão Buscar */}
            <Button className="h-14 px-8 rounded-xl text-base font-medium">
              <Search className="h-5 w-5 mr-2" />
              Buscar
            </Button>
          </div>
        </div>
      </div>

      {/* ===== CONTAGEM DE RESULTADOS ===== */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm sm:text-base">
            <span className="font-semibold text-foreground">{filteredOffers.length}</span> oferta{filteredOffers.length !== 1 ? 's' : ''} encontrada{filteredOffers.length !== 1 ? 's' : ''}
          </p>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={clearFilters}
              className="text-xs sm:text-sm text-muted-foreground hover:text-foreground hidden lg:flex"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* ===== GRID DE OFERTAS ===== */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {filteredOffers.length === 0 ? (
          <Card className="text-center py-12 sm:py-16 lg:py-20 rounded-2xl">
            <CardContent>
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-slate-100 rounded-full flex items-center justify-center">
                <Search className="h-8 w-8 sm:h-10 sm:w-10 text-slate-400" />
              </div>
              <p className="text-lg sm:text-xl font-medium text-slate-600 mb-2">Nenhuma oferta encontrada</p>
              <p className="text-sm sm:text-base text-muted-foreground">Tente ajustar os filtros ou busque por outro termo</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8">
            {filteredOffers.map(offer => (
              <Card 
                key={offer.id} 
                className="group overflow-hidden bg-white border-0 shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl" 
                data-testid={`offer-card-${offer.id}`}
              >
                {/* Imagem - Sem corte, mostra imagem completa */}
                <div 
                  onClick={() => navigate(`/oferta/${offer.id}`)}
                  className="cursor-pointer relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden flex items-center justify-center"
                >
                  {offer.images && offer.images.length > 0 ? (
                    <img
                      src={offer.images[0]}
                      alt={offer.title}
                      className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/80 flex items-center justify-center mb-2">
                        <ImageIcon className="h-7 w-7 sm:h-8 sm:w-8 text-slate-400" />
                      </div>
                      <span className="text-xs sm:text-sm text-slate-500">Sem imagem</span>
                    </div>
                  )}
                  {/* Badge de categoria */}
                  <Badge 
                    className="absolute top-3 left-3 bg-white/95 text-slate-700 border-0 shadow-sm backdrop-blur-sm text-xs font-medium"
                  >
                    {CATEGORIES.find(c => c.value === offer.category)?.label}
                  </Badge>
                </div>

                {/* Conteúdo do Card */}
                <CardContent className="p-4 sm:p-5 flex flex-col">
                  {/* Título e Descrição */}
                  <div 
                    onClick={() => navigate(`/oferta/${offer.id}`)}
                    className="cursor-pointer flex-grow"
                  >
                    <h3 className="font-semibold text-base sm:text-lg mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                      {offer.title}
                    </h3>
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                      {offer.description}
                    </p>
                  </div>

                  {/* Preço Destacado */}
                  {offer.price && (
                    <div className="mb-3">
                      <span className="text-lg sm:text-xl font-bold text-primary">
                        R$ {parseFloat(offer.price).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Vendedor */}
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                      {offer.profiles.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{offer.profiles.name}</p>
                      {offer.neighborhood && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{offer.neighborhood}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Botões */}
                  <div className="flex gap-2">
                    <Button
                      data-testid={`btn-details-${offer.id}`}
                      onClick={() => navigate(`/oferta/${offer.id}`)}
                      variant="outline"
                      className="flex-1 rounded-xl text-sm h-10"
                    >
                      Ver Detalhes
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                    <Button
                      data-testid={`btn-contact-${offer.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleContact(offer);
                      }}
                      className="flex-1 rounded-xl text-sm h-10"
                      disabled={contactingOffer === offer.id}
                    >
                      {contactingOffer === offer.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <MessageSquare className="mr-1.5 h-4 w-4" />
                          Contato
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
