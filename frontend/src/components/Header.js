import { useState, useEffect, useCallback } from 'react';
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

// Logos salvas na pasta /public do projeto
const LOGO_CASA_UNIAO = '/logo-cdu.png';
const LOGO_PRO_FAMILIA = '/logo-profamilia.png';

export default function Header() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const checkAuth = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    setSession(currentSession);

    if (currentSession) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .single();
      setProfile(profileData);
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      checkAuth();
    });

    return () => subscription.unsubscribe();
  }, [checkAuth]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
    setIsMobileMenuOpen(false);
  };

  const handleNavigate = (path) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        {/* Logos e Nome - Desktop & Mobile */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => navigate('/')}
        >
          <div className="flex items-center gap-2">
            <img
              src={LOGO_CASA_UNIAO}
              alt="Casa da União"
              className="h-10 md:h-12 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <div className="w-[1px] h-8 bg-slate-200 hidden sm:block" />
            <img
              src={LOGO_PRO_FAMILIA}
              alt="Pró-Família"
              className="h-10 md:h-12 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </div>
          <div className="hidden lg:flex flex-col ml-1">
            <span className="text-lg font-bold leading-tight text-slate-800">Pró-Família</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">Conecta</span>
          </div>
        </div>

        {/* Navegação Desktop */}
        <nav className="hidden md:flex items-center gap-6">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-base font-medium">
            Início
          </Button>
          <Button variant="ghost" onClick={() => navigate('/mediacao')} className="text-base font-medium">
            Mediação
          </Button>

          {session ? (
            <div className="flex items-center gap-4 ml-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full border border-slate-200 p-0 overflow-hidden">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {profile?.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end" forceMount>
                  <div className="flex flex-col space-y-1 p-3">
                    <p className="text-sm font-bold leading-none">{profile?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground mt-1">{session.user.email}</p>
                    {profile?.role === 'admin' && (
                      <Badge variant="secondary" className="w-fit mt-2 bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200">
                        Administrador
                      </Badge>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/perfil')} className="cursor-pointer py-3">
                    <User className="mr-3 h-4 w-4" />
                    <span>Meu Perfil</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/minhas-ofertas')} className="cursor-pointer py-3">
                    <Package className="mr-3 h-4 w-4" />
                    <span>Minhas Ofertas</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/mediacao')} className="cursor-pointer py-3">
                    <MessageSquare className="mr-3 h-4 w-4" />
                    <span>Mediação Online</span>
                  </DropdownMenuItem>

                  {profile?.role === 'admin' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer py-3 font-semibold text-primary">
                        <Shield className="mr-3 h-4 w-4" />
                        <span>Painel Administrativo</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer py-3 text-destructive focus:text-destructive">
                    <LogOut className="mr-3 h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Button
              data-testid="btn-entrar-desktop"
              onClick={() => navigate('/auth')}
              className="font-semibold px-6"
            >
              Entrar
            </Button>
          )}
        </nav>

        {/* Menu Mobile */}
        <div className="md:hidden flex items-center">
          {session ? (
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 border border-slate-200 rounded-full">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[350px] p-0">
                <SheetHeader className="p-6 border-b text-left">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-primary/20">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                        {profile?.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <SheetTitle className="text-lg font-bold truncate max-w-[180px]">
                        {profile?.name}
                      </SheetTitle>
                      <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-tighter h-5">
                        {profile?.role === 'admin' ? 'Administrador' : 'Membro'}
                      </Badge>
                    </div>
                  </div>
                </SheetHeader>

                <nav className="flex flex-col p-4 gap-2">
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
                    onClick={() => handleNavigate('/perfil')}
                  >
                    <User className="h-5 w-5 mr-4" />
                    Meu Perfil
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