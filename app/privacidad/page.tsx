import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacidad - Habitus",
  description: "Política de privacidad de Habitus",
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
          Política de privacidad
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          En Habitus, respetamos tu privacidad. No almacenamos datos personales
          sensibles y toda la información se guarda de forma segura.
        </p>
        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2">
          <li>No compartimos tus datos con terceros sin tu consentimiento.</li>
          <li>Los datos se conservan solo el tiempo necesario para la funcionalidad de la app.</li>
          <li>Puedes solicitar la eliminación de tus datos en cualquier momento.</li>
        </ul>
        <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-900 rounded-xl">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            © 2026 Habitus. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}