import { HiShieldExclamation, HiArrowLeft, HiHome } from "react-icons/hi";
import { Link } from "react-router-dom";
import Button from "../components/core/Button";
import { useAuth } from "../context/AuthContext";
import { Activity } from "react";

export const ForbiddenPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex">
      {/* Right side - Error message and actions */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <img
              className="h-12 w-auto"
              src="https://rymel.com.co/wp-content/uploads/2024/07/Logo-Rymel-Oscuro.png"
            />
          </div>

          {/* Error content */}
          <div className="space-y-8">
            {/* Mobile error display */}
            <div className="lg:hidden text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full">
                <HiShieldExclamation className="w-10 h-10 text-red-600" />
              </div>
              <div>
                <h1 className="text-5xl font-bold text-gray-900">403</h1>
                <p className="text-xl text-gray-600 mt-2">Acceso Prohibido</p>
              </div>
            </div>

            <div className="space-y-4 text-center lg:text-left">
              <div className="hidden lg:block">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                  <HiShieldExclamation className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">
                  Acceso Denegado
                </h2>
              </div>
              <p className="text-gray-600 leading-relaxed">
                No tienes los permisos necesarios para acceder a esta página.
                Esta área está restringida a usuarios con autorización
                específica.
              </p>
            </div>

            {/* Possible reasons */}
            <div className="bg-gray-50 rounded-lg p-6 space-y-3">
              <h3 className="font-semibold text-gray-900">Posibles razones:</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-rymel-yellow mt-0.5">•</span>
                  <span>No has iniciado sesión o tu sesión ha expirado</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rymel-yellow mt-0.5">•</span>
                  <span>Tu cuenta no tiene los permisos requeridos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rymel-yellow mt-0.5">•</span>
                  <span>El recurso está restringido a ciertos roles</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rymel-yellow mt-0.5">•</span>
                  <span>Accediste a una URL incorrecta o desactualizada</span>
                </li>
              </ul>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <Activity mode={user ? "visible" : "hidden"}>
                <Link to="/" className="block">
                  <Button className="w-full h-12 bg-rymel-blue text-white hover:bg-[#2a1e8f] font-medium text-base group transition-all">
                    <HiHome className="h-5 w-5 mr-2" />
                    Volver al inicio
                  </Button>
                </Link>
              </Activity>

              <Activity mode={!user ? "visible" : "hidden"}>
                <Link to="/login" className="block">
                  <Button className="w-full h-12 bg-rymel-blue text-white hover:bg-[#2a1e8f] font-medium text-base group transition-all">
                    <HiArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                    Iniciar sesión
                  </Button>
                </Link>
              </Activity>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
