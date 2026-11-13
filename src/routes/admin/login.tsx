import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Login — SetMyStay" },
      { name: "description", content: "Secure admin sign-in for SetMyStay." },
      { property: "og:title", content: "Admin Login — SetMyStay" },
      { property: "og:description", content: "Secure admin sign-in for SetMyStay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminLoginPage,
});

import { useState, useEffect } from 'react';
import { useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, ShieldQuestion, Lock, LogIn, HelpCircle, Home } from 'lucide-react';
import { LoadingSpinner } from '@/components/icons';
import { adminLogin, adminLoginStep, getAdminQuestion } from '@/lib/api';
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Admin sign-in is checked by the server (/api/auth/admin-login/).
// No password, PIN or answer is stored in this file or in the browser any more.

function AdminLoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<'password' | 'otp' | 'question' | 'forgot_password'>('password');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordRevealed, setIsPasswordRevealed] = useState(false);
  const [adminQuestion, setAdminQuestion] = useState('');

  useEffect(() => {
    setIsMounted(true);
    if (localStorage.getItem('admin_authenticated') === 'true' && localStorage.getItem('access_token')) {
      navigate({ to: '/admin', replace: true });
    }
    // remove secrets older versions of the site saved in this browser
    ['admin_password', 'admin_otp', 'admin_answer'].forEach((k) => localStorage.removeItem(k));
    getAdminQuestion().then(setAdminQuestion).catch(() => setAdminQuestion('Security question'));
  }, [navigate]);

  const fail = (msg: string, err?: any) => {
    const throttled = err?.response?.status === 429;
    toast({
      title: throttled ? 'Too many attempts' : 'Authentication Error',
      description: throttled ? 'Please wait an hour before trying again.' : msg,
      variant: 'destructive',
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await adminLoginStep('password', password);
      toast({ title: 'Step 1 Complete', description: 'Password correct. Please enter your PIN.' });
      setStep('otp');
    } catch (err) {
      fail('Incorrect password.', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await adminLoginStep('pin', password, otp);
      toast({ title: 'Step 2 Complete', description: 'PIN correct. Please answer the security question.' });
      setStep('question');
    } catch (err) {
      fail('Incorrect PIN.', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await adminLogin(password, otp, answer);
      localStorage.setItem('admin_authenticated', 'true');
      localStorage.setItem('panel_user_name', res.name || 'Admin');
      toast({ title: 'Welcome back!', description: 'Opening your dashboard...' });
      navigate({ to: '/admin' });
    } catch (err) {
      fail('Incorrect answer.', err);
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPasswordRevealed(true);
  };

  if (!isMounted) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100">
            <LoadingSpinner className="w-12 h-12 text-primary" />
        </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Admin Panel Access</CardTitle>
          <CardDescription>
            {step === 'password' && 'Factor 1: Enter your password.'}
            {step === 'otp' && 'Factor 2: Enter your PIN.'}
            {step === 'question' && 'Factor 3: Answer your security question.'}
            {step === 'forgot_password' && 'Answer your security question to see how to reset your password.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                  <Checkbox id="show-password" onCheckedChange={() => setShowPassword(!showPassword)} />
                  <Label htmlFor="show-password" className="text-sm font-normal">Show Password</Label>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                Continue
              </Button>
               <div className="text-center flex justify-center items-center gap-4">
                 <Button variant="link" type="button" onClick={() => setStep('forgot_password')}>Forgot Password?</Button>
                 <Button variant="link" asChild>
                    <Link to="/"><Home className="w-4 h-4 mr-2"/>Go to Main Site</Link>
                 </Button>
               </div>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">PIN</Label>
                <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="otp"
                        type="password"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Enter PIN"
                        maxLength={8}
                        required
                        className="pl-10"
                    />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                Verify PIN
              </Button>
            </form>
          )}

          {step === 'question' && (
            <form onSubmit={handleQuestionSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="answer">Security Question: {adminQuestion}</Label>
                <div className="relative">
                    <ShieldQuestion className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="answer"
                        type="text"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Your answer"
                        required
                        className="pl-10"
                    />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <LoadingSpinner className="w-4 h-4" /> : <LogIn className="w-4 h-4 mr-2" />}
                {isLoading ? 'Verifying...' : 'Login'}
              </Button>
            </form>
          )}

          {step === 'forgot_password' && (
             <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="answer-forgot">Security Question: {adminQuestion}</Label>
                    <div className="relative">
                        <ShieldQuestion className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="answer-forgot"
                            type="text"
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder="Your answer"
                            required
                            className="pl-10"
                        />
                    </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Continue
                </Button>
                <Button variant="link" type="button" onClick={() => setStep('password')} className="w-full">
                  Back to Login
                </Button>
             </form>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isPasswordRevealed} onOpenChange={setIsPasswordRevealed}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Forgot your password?</AlertDialogTitle>
                <AlertDialogDescription>
                    For security, passwords are stored scrambled and can't be shown. Ask the site owner
                    (the person with access to the server) to reset it from the Django admin
                    (<span className="font-mono">/admin/management/adminpanelcredential/</span>), or sign in and change it under Settings.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => {
                    setIsPasswordRevealed(false);
                    setStep('password');
                }}>
                    Back to Login
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}