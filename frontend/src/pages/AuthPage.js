import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { whatsappService } from '@/lib/whatsappService'; // Importe adicionado
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Logo oficial do Pró-Família
const LOGO_PRO_FAMILIA = '/images/logo-pro-familia.png';

// Lista de códigos de países
const COUNTRY_CODES = [
  { code: '+55', country: 'Brasil', flag: '🇧🇷' },
  { code: '+1', country: 'EUA/Canadá', flag: '🇺🇸' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+57', country: 'Colômbia', flag: '🇨🇴' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪' },
  { code: '+591', country: 'Bolívia', flag: '🇧🇴' },
  { code: '+595', country: 'Paraguai', flag: '🇵🇾' },
  { code: '+598', country: 'Uruguai', flag: '🇺🇾' },
  { code: '+51', country: 'Peru', flag: '🇵🇪' },
  { code: '+593', country: 'Equador', flag: '🇪🇨' },
  { code: '+34', country: 'Espanha', flag: '🇪🇸' },
  { code: '+33', country: 'França', flag: '🇫🇷' },
  { code: '+39', country: 'Itália', flag: '🇮🇹' },
  { code: '+49', country: 'Alemanha', flag: '🇩🇪' },
  { code: '+44', country: 'Reino Unido', flag: '🇬🇧' },
  { code: '+81', country: 'Japão', flag: '🇯🇵' },
];

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [countryCode, setCountryCode] = useState('+55');
  const navigate = useNavigate();

  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    name: '',
    whatsapp: ''
  });

  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Combinar código do país com número do WhatsApp
    const fullWhatsapp = countryCode.replace('+', '') + signUpData.whatsapp.replace(/\D/g, '');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpData.email,
        password: signUpData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            name: signUpData.name,
            whatsapp: fullWhatsapp
          }
        }
      });

      if (error) throw error;

      // ---- INÍCIO DO GATILHO DO WHATSAPP ----
      try {
        const adminPhone = process.env.REACT_APP_ADMIN_WHATSAPP;
        if (adminPhone) {
          console.log("Tentando notificar admin sobre novo cadastro:", adminPhone);
          await whatsappService.notifyNewRegistration(adminPhone, signUpData.name);
          console.log("Notificação enviada com sucesso!");
        } else {
          console.warn("Variável REACT_APP_ADMIN_WHATSAPP não configurada. Notificação ignorada.");
        }
      } catch (wppError) {
        // Logamos o erro silenciosamente para não impedir o usuário de se cadastrar
        console.error("Erro ao enviar notificação de WhatsApp:", wppError);
      }
      // ---- FIM DO GATILHO DO WHATSAPP ----

      setShowEmailSent(true);
      setSignUpData({ email: '', password: '', name: '', whatsapp: '' });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: signInData.email,
        password: signInData.password
      });

      if (error) throw error;

      toast.success('Login realizado com sucesso!');
      navigate('/');
    } catch (error) {
      toast.error('Email ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) throw error;

      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
      setShowResetPassword(false);
      setResetEmail('');
    } catch (error) {
      toast.error('Erro ao enviar email de recuperação');
    } finally {
      setLoading(false);
    }
  };

  // Modal de Recuperação de Senha
  if (showResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="bg-primary/10 p-4 rounded-full">
                <Mail className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Recuperar Senha</CardTitle>
              <CardDescription className="text-base mt-2">
                Digite seu email para receber o link de recuperação
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowResetPassword(false)}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 p-4">
      {/* Background Pattern */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHzmMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-50 pointer-events-none"></div>

      <Card className="relative w-full max-w-md shadow-xl rounded-2xl border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-6 pt-8 pb-4 px-8">
          <div className="flex justify-center">
            <img
              src={LOGO_PRO_FAMILIA}
              alt="Pró-Família Geração de Renda"
              className="h-24 sm:h-28 w-auto object-contain"
            />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">Pró-Família Conecta</CardTitle>
            <CardDescription className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              A beneficência do ensinar a pescar — gerando renda e valorizando talentos
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-10">
          {/* Mensagem de Email Enviado */}
          {showEmailSent && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Cadastro realizado com sucesso!</strong>
                <br />
                Enviamos um email de confirmação para <strong>{signUpData.email || 'seu email'}</strong>.
                <br />
                Por favor, verifique sua caixa de entrada e clique no link para ativar sua conta.
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100/80 p-1">
              <TabsTrigger value="signin" data-testid="tab-signin" className="rounded-lg">Entrar</TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-signup" className="rounded-lg">Cadastrar</TabsTrigger>
            </TabsList>

            {/* Login */}
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    data-testid="input-signin-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      data-testid="input-signin-password"
                      type={showSignInPassword ? "text" : "password"}
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword(!showSignInPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      data-testid="btn-toggle-signin-password"
                    >
                      {showSignInPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Button
                  data-testid="btn-signin-submit"
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>

                {/* Botão de Recuperação de Senha */}
                <button
                  type="button"
                  onClick={() => setShowResetPassword(true)}
                  className="w-full text-sm text-primary hover:underline mt-2"
                >
                  Esqueceu sua senha?
                </button>
              </form>
            </TabsContent>

            {/* Cadastro */}
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome Completo</Label>
                  <Input
                    id="signup-name"
                    data-testid="input-signup-name"
                    type="text"
                    placeholder="João Silva"
                    value={signUpData.name}
                    onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-whatsapp">WhatsApp (com DDD)</Label>
                  <div className="flex gap-2">
                    <Select value={countryCode} onValueChange={setCountryCode}>
                      <SelectTrigger className="w-28 flex-shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {COUNTRY_CODES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            <span className="flex items-center gap-2">
                              <span>{country.flag}</span>
                              <span>{country.code}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="signup-whatsapp"
                      data-testid="input-signup-whatsapp"
                      type="tel"
                      placeholder="95999999999"
                      value={signUpData.whatsapp}
                      onChange={(e) => setSignUpData({ ...signUpData, whatsapp: e.target.value.replace(/\D/g, '') })}
                      className="flex-1"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Digite apenas os números (DDD + número)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    data-testid="input-signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha (mínimo 6 caracteres)</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      data-testid="input-signup-password"
                      type={showSignUpPassword ? "text" : "password"}
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      data-testid="btn-toggle-signup-password"
                    >
                      {showSignUpPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Button
                  data-testid="btn-signup-submit"
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    'Criar Conta'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}