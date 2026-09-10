import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad - DiaUno",
  description: "Cómo DiaUno recolecta, usa y protege tus datos.",
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Responsable",
    body: [
      "DiaUno es una aplicación de seguimiento de entrenamiento. Para consultas sobre privacidad escribinos a diaunosoporte@gmail.com.",
    ],
  },
  {
    title: "2. Qué datos recolectamos",
    body: [
      "Cuenta: cuando iniciás sesión con Google recibimos tu nombre, dirección de email y foto de perfil.",
      "Entrenamiento: las rutinas que creás o copiás, tus sesiones (series, pesos, repeticiones), marcas personales, y los datos físicos que cargues (peso, altura, objetivo).",
      "Técnicos: preferencia de tema claro/oscuro (guardada solo en tu dispositivo) y datos de sesión necesarios para mantenerte logueado.",
    ],
  },
  {
    title: "3. Para qué los usamos",
    body: [
      "Prestar el servicio: mostrar tus rutinas, registrar sesiones y calcular tu progreso, rachas y estadísticas.",
      "No usamos tus datos para publicidad, no los vendemos ni los compartimos con terceros con fines comerciales.",
    ],
  },
  {
    title: "4. Con quién se procesan",
    body: [
      "Supabase: aloja y procesa la base de datos y la autenticación.",
      "Google: solo interviene en el inicio de sesión (OAuth). No accedemos a ningún otro dato de tu cuenta de Google.",
    ],
  },
  {
    title: "5. Conservación y eliminación",
    body: [
      "Conservamos tus datos mientras mantengas tu cuenta. Si querés que eliminemos todo (cuenta y entrenamientos), escribinos a diaunosoporte@gmail.com y lo procesamos.",
    ],
  },
  {
    title: "6. Tus derechos",
    body: [
      "Podés pedir acceso, rectificación, portabilidad o eliminación de tus datos escribiendo a diaunosoporte@gmail.com.",
    ],
  },
  {
    title: "7. Menores",
    body: ["El servicio está dirigido a mayores de 13 años."],
  },
  {
    title: "8. Cambios",
    body: [
      "Si cambiamos esta política, publicaremos la versión actualizada en esta misma página con su fecha de vigencia.",
    ],
  },
];

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Política de Privacidad</h1>
          <p className="mt-2 text-sm text-slate-500">Última actualización: septiembre 2026</p>
        </div>

        <div className="space-y-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-semibold text-slate-900">{s.title}</h2>
              <div className="mt-2 space-y-2">
                {s.body.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-slate-600">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <Link
          href="/"
          className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
