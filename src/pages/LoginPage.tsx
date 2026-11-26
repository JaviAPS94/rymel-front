import LoginForm from "../components/auth/LoginForm";

export const LoginPage = () => {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-rymel-blue">
      <div className="h-[3px] bg-rymel-yellow" />
      <div
        aria-hidden="true"
        className="rm-dots pointer-events-none fixed inset-y-0 right-0 w-[46%]"
      />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-2">
          <div className="space-y-8 text-white lg:pr-12">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-rymel-yellow text-2xl font-extrabold text-rymel-blue"
              >
                R
              </span>
              <span className="text-3xl font-bold tracking-[-0.01em]">
                Rymel
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] lg:text-5xl">
                Gestión de normas simplificada
              </h1>
              <p className="max-w-md text-lg leading-relaxed text-white/80 lg:text-xl">
                Accede a tu plataforma de gestión normativa y mantén todo
                organizado en un solo lugar
              </p>
            </div>

            <div className="hidden grid-cols-2 gap-4 lg:grid">
              <div className="rounded-2xl border border-white/15 bg-white/[.07] p-5">
                <div className="text-3xl font-extrabold text-rymel-yellow">
                  500+
                </div>
                <div className="text-sm text-white/70">Normas activas</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/[.07] p-5">
                <div className="text-3xl font-extrabold text-rymel-yellow">
                  24/7
                </div>
                <div className="text-sm text-white/70">Disponibilidad</div>
              </div>
            </div>

            <p className="hidden text-sm text-white/70 lg:block">
              © 2025 Rymel. Todos los derechos reservados.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-[0_32px_80px_rgba(0,0,0,.35)] lg:p-12">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
};
