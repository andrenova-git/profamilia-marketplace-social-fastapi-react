import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Menu, Home, Package, Shield, User, LogOut, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Logos oficiais (armazenadas localmente em /public/images/)
const LOGO_CASA_UNIAO = '/images/logo-casa-uniao.png';
const LOGO_PRO_FAMILIA = '/images/logo-pro-familia.png';

export default function Header() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Erro ao carregar perfil:', error);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  };

  const handleSignOut = async () => {
    setUser(null);
    setProfile(null);
    setMobileMenuOpen(false);

    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      console.error('Erro ao fazer logout (ignorando):', error);
    }

    localStorage.removeItem('sb-xyqwymmbhtphfejlehjy-auth-token');
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.clear();

    window.location.href = '/auth';
  };

  const handleNavigate = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
      {/* Container com max-width para manter harmonia em monitores grandes */}
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4">

        {/* ===== LOGOS - Canto Esquerdo ===== */}
        <button
          data-testid="logo-home"
          onClick={() => navigate('/')}
          className="flex items-center gap-3 sm:gap-4 lg:gap-5 hover:opacity-90 transition-opacity flex-shrink-0"
        >
          {/* Logo Casa da União - Tamanho generoso */}
          <img
            src={LOGO_CASA_UNIAO}
            alt="Associação Beneficente Casa da União"
            className="h-16 sm:h-18 md:h-20 lg:h-[88px] w-auto object-contain"
          />

          {/* Divisor vertical */}
          <div className="h-12 sm:h-14 lg:h-16 w-px bg-gray-300" />

          {/* Logo Pró-Família - Tamanho generoso */}
          <img
            src={LOGO_PRO_FAMILIA}
            alt="Pró-Família Geração de Renda"
            className="h-16 sm:h-18 md:h-20 lg:h-[88px] w-auto object-contain"
          />
        </button>

        {/* ===== NAVEGAÇÃO DESKTOP - Direita ===== */}
        <nav className="hidden md:flex items-center gap-2 lg:gap-4 ml-8">
          {user ? (
            <>
              <Button
                data-testid="btn-minhas-ofertas"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/minhas-ofertas')}
                className="text-sm lg:text-base"
              >
                <Package className="h-4 w-4 mr-2" />
                Minhas Ofertas
              </Button>

              {profile?.role === 'admin' && (
                <Button
                  data-testid="btn-admin"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="text-primary font-semibold text-sm lg:text-base"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              )}

              {profile && (
                <Badge variant="outline" className="text-xs lg:text-sm px-2 lg:px-3 py-1">
                  {profile.role === 'admin' ? 'Admin' : 'Usuário'}
                </Badge>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    data-testid="btn-user-menu"
                    variant="ghost"
                    className="relative h-10 w-10 lg:h-11 lg:w-11 rounded-full ml-2"
                  >
                    <Avatar className="h-10 w-10 lg:h-11 lg:w-11">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="bg-primary text-white text-base lg:text-lg">
                        {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium text-sm">{profile?.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/perfil')}>
                    <User className="h-4 w-4 mr-2" />
                    Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/minhas-ofertas')}>
                    <Package className="h-4 w-4 mr-2" />
                    Minhas Ofertas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/mediacao')}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Mediação Online
                  </DropdownMenuItem>
                  {profile?.role === 'admin' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/admin')}>
                        <Shield className="h-4 w-4 mr-2" />
                        Painel Admin
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              data-testid="btn-entrar"
              onClick={() => navigate('/auth')}
              size="default"
              className="text-sm lg:text-base px-6"
            >
              Entrar
            </Button>
          )}
        </nav>

        {/* ===== MENU MOBILE (Hamburger) - Direita ===== */}
        <div className="md:hidden flex items-center gap-4 ml-6">
          {user ? (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" data-testid="btn-mobile-menu" className="h-11 w-11">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[340px]">
                <SheetHeader className="border-b pb-4 mb-4">
                  <SheetTitle className="flex items-center gap-3">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="bg-primary text-white text-xl">
                        {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="font-semibold text-lg">{profile?.name}</p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {profile?.role === 'admin' ? 'Administrador' : 'Usuário'}
                      </Badge>
                    </div>
                  </SheetTitle>
                </SheetHeader>

                <nav className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    className="justify-start h-14 text-base font-medium"
                    onClick={() => handleNavigate('/')}
                  >
                    <Home className="h-5 w-5 mr-4" />
                    Início
                  </Button>

                  <Button
                    variant="ghost"
                    className="justify-start h-14 text-base font-medium"
                    onClick={() => handleNavigate('/minhas-ofertas')}
                  >
                    <Package className="h-5 w-5 mr-4" />
                    Minhas Ofertas
                  </Button>

                  <Button
                    variant="ghost"
                    className="justify-start h-14 text-base font-medium"
                    onClick={() => handleNavigate('/perfil')}
                  >
                    <User className="h-5 w-5 mr-4" />
                    Meu Perfil
                  </Button>

                  <Button
                    variant="ghost"
                    className="justify-start h-14 text-base font-medium"
                    onClick={() => handleNavigate('/mediacao')}
                  >
                    <MessageSquare className="h-5 w-5 mr-4" />
                    Mediação Online
                  </Button>

                  {profile?.role === 'admin' && (
                    <>
                      <div className="border-t my-3" />
                      <Button
                        variant="ghost"
                        className="justify-start h-14 text-base font-semibold text-primary"
                        onClick={() => handleNavigate('/admin')}
                      >
                        <Shield className="h-5 w-5 mr-4" />
                        Painel Admin
                      </Button>
                    </>
                  )}

                  <div className="border-t my-3" />

                  <Button
                    variant="ghost"
                    className="justify-start h-14 text-base font-medium text-destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-5 w-5 mr-4" />
                    Sair
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          ) : (
            <Button
              data-testid="btn-entrar-mobile"
              onClick={() => navigate('/auth')}
              size="default"
              className="h-11 px-5 text-base"
            >
              Entrar
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
