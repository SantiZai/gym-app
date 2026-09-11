import Link from "next/link";
import { HomeCTA } from "@/components/home-cta";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6">
            Bienvenido a <span className="text-blue-600">Habitus</span>
          </h1>
          <p className="text-lg sm:text-xl font-medium text-blue-600 mb-2">
            Entrenamiento con propósito
          </p>
          <p className="text-lg sm:text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Tu compañero perfecto para alcanzar tus objetivos. Gestiona rutinas, registra sesiones de entrenamiento y monitorea tu progreso.
          </p>
          <HomeCTA />
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-5xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            Características principales
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Rutinas personalizadas",
                description: "Crea y gestiona rutinas adaptadas a tus objetivos",
                href: "/rutinas",
              },
              {
                title: "Seguimiento de progreso",
                description: "Visualiza tu evolución con gráficos detallados",
                href: "/progreso",
              },
              {
                title: "Tu constancia",
                description: "Calendario de entrenos y racha semanal en tu perfil",
                href: "/perfil",
              },
            ].map((feature) => (
              <Link
                key={feature.href}
                href={feature.href}
                className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 border border-slate-200"
              >
                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-slate-600">{feature.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-12 sm:px-6 lg:px-8 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-slate-400">
            © {new Date().getFullYear()} Habitus. Todos los derechos reservados.
          </p>
          <Link
            href="/privacidad"
            className="mt-2 inline-block text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
          >
            Política de Privacidad
          </Link>
        </div>
      </footer>
    </div>
  );
}
