export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Bienvenido a <span className="text-blue-600">GymApp</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Tu compañero perfecto para alcanzar tus objetivos. Gestiona rutinas, registra sesiones de entrenamiento y monitorea tu progreso.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl">
              Comenzar ahora
            </button>
            <button className="px-8 py-3 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors duration-200 border-2 border-gray-200">
              Ver rutinas
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Características principales
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Rutinas personalizadas",
                description: "Crea y gestiona rutinas adaptadas a tus objetivos",
              },
              {
                title: "Seguimiento de progreso",
                description: "Visualiza tu evolución con gráficos detallados",
              },
              {
                title: "Base de ejercicios",
                description: "Accede a una amplia biblioteca de ejercicios",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200"
              >
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-12 sm:px-6 lg:px-8 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-400">
            © {new Date().getFullYear()} GymApp. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
