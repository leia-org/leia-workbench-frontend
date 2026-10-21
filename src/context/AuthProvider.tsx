import React, { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { AuthContext, type AuthContextType } from "./AuthContext";
import type { DecodedToken } from "../models/Auth";
import axios from "axios";
import { toast } from "react-toastify";

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<DecodedToken | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const decodeToken = (token: string): DecodedToken | null => {
    try {
      return jwtDecode<DecodedToken>(token);
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  };

  const login = useCallback((newToken: string) => {
    setToken(newToken);
    const decoded = decodeToken(newToken);
    setUser(decoded);
  }, []);

  const clearLocalSession = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const syncSession = useCallback(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/users/session`,
        { credentials: "include" },
      );
      if (!response.ok) {
        clearLocalSession();
        return false;
      }

      const data = await response.json() as { token?: string };
      if (!data.token) {
        clearLocalSession();
        return false;
      }

      login(data.token);
      return true;
    } catch (error) {
      console.error("Error synchronizing Auth session:", error);
      return false;
    }
  }, [clearLocalSession, login]);

  const logout = useCallback(() => {
    void fetch(
      `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/users/logout`,
      { method: "POST", credentials: "include" },
    ).catch((error) => console.error("Error closing Auth session:", error));
    clearLocalSession();
    navigate("/login");
  }, [clearLocalSession, navigate]);

  useEffect(() => {
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 401 &&
          !error.config?.url?.includes('/login')
        ) {
          toast.error("Tu sesión ha caducado. Por favor, vuelve a iniciar sesión.");
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(responseInterceptor);
  }, [logout]);
  useEffect(() => {
    const handleUnauthorized = () => {
      console.warn("Se detectó un 401 en fetch. Cerrando sesión...");
      toast.error("Tu sesión ha caducado. Por favor, vuelve a iniciar sesión.");
      logout();
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
    };
  }, [logout]);

  useEffect(() => {
    localStorage.removeItem("token");
    void syncSession().finally(() => setIsLoading(false));
  }, [syncSession]);

  useEffect(() => {
    const refresh = () => void syncSession();
    const interval = window.setInterval(refresh, 5 * 60 * 1000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [syncSession]);

  const value: AuthContextType = {
    token,
    user,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
    setUser,
  };
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
