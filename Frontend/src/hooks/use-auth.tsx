import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { login as loginApi, logout as logoutApi, signup as signupApi, me } from '@/services/auth';
import type { AuthResult, LoginInput, PublicUser, SignupInput } from '@/types';

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [bootstrapped, setBootstrapped] = useState(false);
  const token = localStorage.getItem('accessToken');

  const { data: user, isLoading } = useQuery<PublicUser | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      if (!localStorage.getItem('accessToken')) return null;
      return me();
    },
    enabled: !!token || bootstrapped,
    staleTime: Infinity,
  });

  useEffect(() => {
    setBootstrapped(true);
  }, []);

  const loginMutation = useMutation<AuthResult, Error, LoginInput>({
    mutationFn: loginApi,
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });

  const signupMutation = useMutation<AuthResult, Error, SignupInput>({
    mutationFn: signupApi,
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });

  const logoutMutation = useMutation<void, Error>({
    mutationFn: logoutApi,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
    },
  });

  const login = useCallback(
    async (input: LoginInput) => {
      await loginMutation.mutateAsync(input);
    },
    [loginMutation],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      await signupMutation.mutateAsync(input);
    },
    [signupMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const value = useMemo(
    () => ({
      user: user ?? null,
      isLoading: isLoading || !bootstrapped,
      isAuthenticated: !!user,
      login,
      signup,
      logout,
    }),
    [user, isLoading, bootstrapped, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
