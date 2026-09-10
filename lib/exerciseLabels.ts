// Etiquetas en español para los códigos en inglés del catálogo
// (muscle/type/equipment vienen de API Ninjas y se guardan así en DB).

const EQUIPMENT_ES: Record<string, string> = {
  dumbbell: "Mancuernas",
  dumbbells: "Mancuernas",
  barbell: "Barra",
  machine: "Máquina",
  cable: "Polea",
  cables: "Polea",
  kettlebell: "Kettlebell",
  kettlebells: "Kettlebell",
  bands: "Bandas",
  band: "Banda",
  ball: "Pelota",
  bench: "Banco",
  "body only": "Peso corporal",
  bodyweight: "Peso corporal",
  other: "Otro",
  none: "Sin equipo",
};

export function equipmentLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return EQUIPMENT_ES[key] ?? raw;
}
