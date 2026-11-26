// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter, Link } from "react-router-dom";
import { RymelUIProvider } from "@rymel/ui";
import { Provider } from "react-redux";
import { store } from "./store/index.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";

createRoot(document.getElementById("root")!).render(
  // <StrictMode>
  <BrowserRouter>
    {/* Los enlaces de @rymel/ui navegan con react-router. */}
    <RymelUIProvider
      linkComponent={({ href, ...props }) => <Link to={href} {...props} />}
    >
      <Provider store={store}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </Provider>
    </RymelUIProvider>
  </BrowserRouter>
  // </StrictMode>
);
