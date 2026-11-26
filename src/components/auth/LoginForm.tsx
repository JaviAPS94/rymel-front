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

  const [login, { isLoading }] = useLoginMutation();

  // Verificar si hay una redirección por sesión expirada (solo al montar)
  useEffect(() => {
    const redirectPath = sessionStorage.getItem("redirectAfterLogin");
    if (redirectPath) {
      setSessionExpired(true);
    }
  }, []);

  // Redirigir cuando el usuario ya está autenticado
  useEffect(() => {
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
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="mb-2 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rymel-blue">
          <RiAdminFill className="h-8 w-8 text-rymel-yellow" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-[-0.02em] text-gray-900">
          Bienvenido de nuevo
        </h2>
        <p className="text-gray-600">
          Ingresa tus credenciales para acceder a tu cuenta
        </p>
      </div>

      {sessionExpired && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Tu sesión ha expirado. Por favor, inicia sesión nuevamente.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="flex items-center gap-2 text-sm font-medium text-gray-700"
          >
            <HiMail className="h-4 w-4" />
            Correo electrónico
          </label>
          <CustomInput
            id="email"
            type="email"
            placeholder="tu@correo.com"
            size="lg"
            required
            value={email}
            onChange={handleOnChangeEmail}
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="password"
            className="flex items-center gap-2 text-sm font-medium text-gray-700"
          >
            <HiLockClosed className="h-4 w-4" />
            Contraseña
          </label>
          <CustomInput
            id="password"
            type="password"
            placeholder="••••••••"
            size="lg"
            showPasswordToggle={true}
            required
            value={password}
            onChange={handleOnChangePassword}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button
          primary
          type="submit"
          disabled={isLoading}
          size="lg"
          className="group w-full font-semibold"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Iniciando sesión...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              Iniciar sesión
              <HiArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </div>
          )}
        </Button>
      </form>
    </div>
  );
}
