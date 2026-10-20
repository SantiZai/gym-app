import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y condiciones - Habitus",
  description: "Términos y condiciones de uso de Habitus",
};

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Términos y condiciones</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Bienvenido a Habitus. Estos términos regulan el uso de nuestra plataforma.
        </p>
        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2">
          <li>Los usuarios deben tener al menos 16 años.</li>
          <li>El contenido debe ser apropiado y no ofensivo.</li>
          <li>Habitus se reserva el derecho de modificar estos términos en cualquier momento.</li>
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