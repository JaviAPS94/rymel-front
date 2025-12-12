// ProtectedRoute.tsx
import { JSX } from "react";
import { Navigate } from "react-router-dom";
import { Role } from "../../commons/types";
import { useAuth } from "../../context/AuthContext";

export const ProtectedRoute: React.FC<{
  children: JSX.Element;
  roles?: Role[];
}> = ({ children, roles }) => {
  const { user, token, hasRole } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return <div>Cargando...</div>;
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
};
