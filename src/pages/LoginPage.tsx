import LoginForm from "../components/auth/LoginForm";

export const LoginPage = () => {
  return (
    <div className="fixed inset-0 flex overflow-hidden">
      <div className="hidden lg:flex lg:w-1/2 bg-rymel-blue relative overflow-hidden text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-rymel-blue via-rymel-blue to-accent opacity-90" />
        <div className="absolute top-20 left-20 w-32 h-32 bg-rymel-yellow rounded-full opacity-20 blur-3xl" />
        <div className="absolute bottom-32 right-20 w-40 h-40 bg-accent rounded-full opacity-30 blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-rymel-yellow rounded-full opacity-15 blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full text-primary-foreground">
          <div>
            <img
              className="h-12 w-auto"
              src="https://rymel.com.co/wp-content/uploads/2024/07/Logo-Rymel-Oscuro.png"
            />
          </div>

          <div className="space-y-6">
            <h1 className="text-5xl font-bold leading-tight text-balance">
              {"Gestión de normas simplificada"}
            </h1>
            <p className="text-lg text-primary-foreground/90 leading-relaxed max-w-md">
              {
                "Accede a tu plataforma de gestión normativa y mantén todo organizado en un solo lugar"
              }
            </p>

            <div className="flex gap-8 pt-6">
              <div>
                <div className="text-3xl font-bold text-rymel-yellow">
                  {"500+"}
                </div>
                <div className="text-sm text-primary-foreground/80">
                  {"Normas activas"}
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-rymel-yellow">
                  {"24/7"}
                </div>
                <div className="text-sm text-primary-foreground/80">
                  {"Disponibilidad"}
                </div>
              </div>
            </div>
          </div>

          <div className="text-sm text-primary-foreground/70">
            {"© 2025 Rymel. Todos los derechos reservados."}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background overflow-y-auto">
        <div className="w-full max-w-md my-auto">
          <div className="lg:hidden mb-8 flex justify-center">
            <img
              className="h-12 w-auto"
              src="https://rymel.com.co/wp-content/uploads/2024/07/Logo-Rymel-Oscuro.png"
            />
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
};
