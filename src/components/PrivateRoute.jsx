import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function PrivateRoute({ children, adminOnly = false, allowedRoles = null }) {
  const { signed, loading, isAdmin, usuario } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!signed) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !isAdmin()) {
    return <Navigate to="/" />;
  }

  // Se allowedRoles foi especificado, verificar se o usuário tem uma das roles permitidas
  if (allowedRoles && !allowedRoles.includes(usuario?.role)) {
    return <Navigate to="/" />;
  }

  return children;
}
