import type React from "react";

import { useEffect, useState } from "react";
import { HiMail, HiLockClosed, HiArrowRight } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLoginMutation } from "../../store/apis/authApi";
import Button from "../core/Button";
import CustomInput from "../core/CustomInput";
import { RiAdminFill } from "react-icons/ri";

export default function LoginForm() {
  const { setToken, token } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  const [login, { isLoading, error: loginError }] = useLoginMutation();

  console.log(
    "LoginForm render - error:",
    error,
    "token:",
    token,
    "loginError:",
    loginError
  );

  // Verificar si hay una redirección por sesión expirada (solo al montar)
  useEffect(() => {
    const redirectPath = sessionStorage.getItem("redirectAfterLogin");
    if (redirectPath) {
      setSessionExpired(true);
    }
  }, []);

  // Redirigir cuando el usuario ya está autenticado
  useEffect(() => {
    console.log("Token effect running - token:", token);
    if (token) {
      const redirectPath = sessionStorage.getItem("redirectAfterLogin");
      if (redirectPath) {
        sessionStorage.removeItem("redirectAfterLogin");
        navigate(redirectPath, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setError("");

    try {
      const res = await login({ email, password }).unwrap();
      setToken(res.access_token);
    } catch (err: any) {
      console.error("Login error:", err);
      setError("Correo o contraseña inválidos");
      setSessionExpired(false);
    }
  };

  const handleOnChangeEmail = (value: string) => {
    setEmail(value);
    if (error) setError("");
  };

  const handleOnChangePassword = (value: string) => {
    setPassword(value);
    if (error) setError("");
  };

  return (
    <div className="space-y-8">
      <div className="inline-flex items-center justify-center w-full">
        <RiAdminFill className="h-16 w-16 text-rymel-blue" />
      </div>
      <div className="space-y-2 text-center lg:text-left">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {"Bienvenido de nuevo"}
        </h2>
        <p className="text-muted-foreground">
          {"Ingresa tus credenciales para acceder a tu cuenta"}
        </p>
        {sessionExpired && (
          <div className="mb-3 rounded bg-yellow-100 px-3 py-2 text-sm text-yellow-800 border border-yellow-300">
            Tu sesión ha expirado. Por favor, inicia sesión nuevamente.
          </div>
        )}
        {error && (
          <div className="mb-3 rounded bg-red-100 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-foreground font-semibold">
              {"Correo electrónico"}
            </label>
            <CustomInput
              id="email"
              type="email"
              placeholder="tu@correo.com"
              className="h-12 border-input bg-background text-foreground"
              leftIcon={<HiMail className="h-5 w-5 text-muted-foreground" />}
              required
              value={email}
              onChange={handleOnChangeEmail}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-foreground font-semibold">
              {"Contraseña"}
            </label>
            <CustomInput
              id="password"
              type="password"
              placeholder="••••••••"
              className="h-12 border-input bg-background text-foreground w-full"
              leftIcon={
                <HiLockClosed className="h-5 w-5 text-muted-foreground" />
              }
              showPasswordToggle={true}
              required
              value={password}
              onChange={handleOnChangePassword}
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 bg-rymel-blue text-white hover:bg-rymel-blue/95 font-medium text-base group"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              {"Iniciando sesión..."}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {"Iniciar sesión"}
              <HiArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </Button>
      </form>
    </div>
  );
}
