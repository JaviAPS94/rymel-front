import { Route, Routes } from "react-router-dom";
import NormListPage from "./pages/NormListPage";
import Navbar from "./components/core/Navbar";
import NormPage from "./pages/NormPage";
import DesignPage from "./pages/DesignPage";
import ElementsDesignPage from "./pages/ElementsDesignPage";
import DesignsListPage from "./pages/DesignsListPage";
import DesignDetailsPage from "./pages/DesignDetailsPage";
import { ProtectedRoute } from "./components/core/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { useAuth } from "./context/AuthContext";
import { ForbiddenPage } from "./pages/ForbiddenPage";

const App: React.FC = () => {
  const { token } = useAuth();

  return (
    <>
      {token && <Navbar />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute roles={["ADMIN", "NORM"]}>
              <NormListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/norms/new"
          element={
            <ProtectedRoute roles={["ADMIN", "NORM"]}>
              <NormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/norms/edit/:normId"
          element={
            <ProtectedRoute roles={["ADMIN", "NORM"]}>
              <NormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/design"
          element={
            <ProtectedRoute roles={["ADMIN", "DESIGN"]}>
              <DesignPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/elements/design"
          element={
            <ProtectedRoute roles={["ADMIN", "DESIGN"]}>
              <ElementsDesignPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/design/list"
          element={
            <ProtectedRoute roles={["ADMIN", "DESIGN"]}>
              <DesignsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/design/:designId/details"
          element={
            <ProtectedRoute roles={["ADMIN", "DESIGN"]}>
              <DesignDetailsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
};

export default App;
