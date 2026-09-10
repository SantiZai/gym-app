import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

// Definir el tipo Exercise localmente
interface Exercise {
    id?: string;
    name: string;
    muscle: string | null;
    type: string | null;
    equipment: string | null;
    instructions: string | null;
    origin: string | null;
    created_at: string;
}

// Verificar que las variables de entorno estén disponibles
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Error: Variables de entorno de Supabase no encontradas');
    console.error('Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env.local');
    process.exit(1);
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const API_BASE = "https://api.api-ninjas.com";
const ENDPOINT = "/v1/exercises"

/* const generateOptions = (textToTranslate: string) => {
    return {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.EDENAI_API_KEY}`
        },
        body: JSON.stringify({
            providers: "google",
            text: textToTranslate,
            source_language: "en",
            target_language: "es"
        })
    }
} */

const generateOptions = (textToTranslate: string) => {
    return {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            q: textToTranslate,
            source: "en",
            target: "es",
            format: "text"
        })
    }
}

const muscles = [
    "abdominals",
    "abductors",
    "adductors",
    "biceps",
    "calves",
    "chest",
    "forearms",
    "glutes",
    "hamstrings",
    "lats",
    "lower_back",
    "middle_back",
    "neck",
    "quadriceps",
    "traps",
    "triceps"
]

interface ApiNinjaExercise {
    name: string;
    muscle: string;
    type: string;
    equipment: string;
    difficulty: string;
    instructions: string;
}

function formatExercises(exercises: ApiNinjaExercise[]) {
    return exercises.map((exercise: ApiNinjaExercise) => {
        return {
            name: exercise.name,
            muscle: exercise.muscle,
            type: exercise.type,
            equipment: exercise.equipment,
            instructions: `${exercise.difficulty} - ${exercise.instructions}`,
            origin: "api-ninjas",
            created_at: new Date().toISOString()
        } as Exercise
    })
}

async function translateExercises(exercises: Exercise[]) {
    const translatedExercises: Exercise[] = [];

    for (let i = 0; i < exercises.length; i++) {
        const exercise = exercises[i];

        // Limpiar y validar el texto a traducir
        const textToTranslate = `${exercise.name || ''} - ${exercise.muscle || ''} - ${exercise.type || ''} - ${exercise.equipment || ''} - ${exercise.instructions || ''}`;

        // Limitar la longitud del texto (EdenAI tiene límites)
        const cleanText = textToTranslate.substring(0, 1000);

        console.log(`Traduciendo ejercicio ${i + 1}/${exercises.length}: ${exercise.name}`);

        const options = generateOptions(cleanText);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Aumentar delay para evitar rate limiting

        try {
            const response = await fetch("http://127.0.0.1:5000/translate", options);

            if (!response.ok) {
                console.error(`HTTP Error ${response.status}: ${response.statusText}`);
                const errorText = await response.text();
                console.error('Error response:', errorText);
                translatedExercises.push(exercise);
                continue;
            }

            const data = await response.json();

            // Verificar si hay error en la respuesta
            if (data.error) {
                console.error(`API Error para ${exercise.name}:`, data.error);
                translatedExercises.push(exercise);
                continue;
            }

            // Verificar si hay datos de traducción válidos
            if (data && data.google && data.google.text) {
                const translatedText = data.google.text;
                const parts = translatedText.split(' - ');

                if (parts.length >= 5) {
                    const translatedExercise = {
                        ...exercise,
                        name: parts[0].trim(),
                        muscle: parts[1].trim(),
                        type: parts[2].trim(),
                        equipment: parts[3].trim(),
                        instructions: parts.slice(4).join(' - ').trim()
                    };
                    translatedExercises.push(translatedExercise);
                    console.log(`✓ Traducido: ${exercise.name} -> ${translatedExercise.name}`);
                } else {
                    console.warn(`Formato de traducción inesperado para ${exercise.name}`);
                    translatedExercises.push(exercise);
                }
            } else {
                console.warn(`No se encontró traducción válida para ${exercise.name}`);
                console.log('Respuesta completa:', JSON.stringify(data, null, 2));
                translatedExercises.push(exercise);
            }

        } catch (error) {
            console.error(`Error traduciendo ejercicio ${exercise.name}:`, error);
            translatedExercises.push(exercise);
        }
    }

    return translatedExercises;
}

async function saveExercises(exercises: Exercise[]) {
    let translatedExercises: Exercise[] = [];

    translatedExercises = await translateExercises(exercises);
    
    const chunkSize = 50;
    for (let i = 0; i < translatedExercises.length; i += chunkSize) {
        const chunk = translatedExercises.slice(i, i + chunkSize);
        const { data } = await supabase
            .from('exercises')
            .select('name')
            .in('name', chunk.map(exercise => exercise.name))
        const existingExercises = data && data.map(exercise => exercise.name)
        const exercisesToInsert = chunk.filter(exercise => !existingExercises?.includes(exercise.name))
        if (exercisesToInsert.length > 0) {
            const { error: insertError } = await supabase.from('exercises').insert(exercisesToInsert);
            if (insertError) {
                console.error('Error insertando ejercicios:', insertError);
            } else {
                console.log(`Insertados ${exercisesToInsert.length} ejercicios nuevos`);
            }
        } else {
            console.log('No hay ejercicios nuevos para insertar en este lote');
        }
    }
    console.log("Exercises saved successfully")
}

async function main() {
    console.log('Iniciando descarga de ejercicios desde API Ninjas...');
    const allExercises: ApiNinjaExercise[] = [];

    for (const muscle of muscles) {
        console.log(`Descargando ejercicios para: ${muscle}`);
        const res = await fetch(
            `${API_BASE}${ENDPOINT}?muscle=${muscle}`,
            {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "X-Api-Key": `${process.env.API_NINJAS_API_KEY}`
                }
            }
        )
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Error fetch API: ${res.status} ${res.statusText} - ${text}`);
        }
        const body = await res.json();
        console.log(`  - Encontrados ${body.length} ejercicios para ${muscle}`);
        allExercises.push(...body);
    }

    if (allExercises.length === 0) {
        console.log("No se encontraron ejercicios");
        return
    }

    const formattedExercises = formatExercises(allExercises);
    console.log(`\nTotal de ejercicios descargados: ${formattedExercises.length}`);

    // Comentado: traducción de ejercicios (sin créditos disponibles)
    // console.log('Iniciando traducción de ejercicios...');
    // const translatedExercises = await translateExercises(formattedExercises);
    // console.log(`\nEjercicios traducidos: ${translatedExercises.length}`);

    console.log('Guardando ejercicios en la base de datos (sin traducir)...');
    await saveExercises(formattedExercises);
}

main().catch(error => {
    console.error('Error ejecutando el script:', error);
    process.exit(1);
});