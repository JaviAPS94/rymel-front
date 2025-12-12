// AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { AuthUser, Role } from "../commons/types";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem("access_token")
  );
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!token) {
      setUser(null);
      localStorage.removeItem("access_token");
      return;
    }

    try {
      const decoded: any = jwtDecode(token);
      setUser({
        id: decoded.sub,
        email: decoded.email,
        roles: decoded.roles ?? [],
      });
      localStorage.setItem("access_token", token);
    } catch (err) {
      console.error("Invalid token", err);
      setUser(null);
      localStorage.removeItem("access_token");
    }
  }, [token]);

  const setToken = (t: string | null) => {
    setTokenState(t);
  };

  const logout = () => {
    setTokenState(null);
    setUser(null);
    localStorage.removeItem("access_token");
  };

  const hasRole = (...roles: Role[]) =>
    !!user && roles.some((role) => user.roles.includes(role));

  return (
    <AuthContext.Provider value={{ user, token, setToken, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
