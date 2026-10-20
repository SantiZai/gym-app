import type { Exercise } from "@/types/db"
import { createClient } from "./supabase/client"

export const getExerciseById = async (id: string) => {
    const supabase = await createClient()

    const { data, error } = await supabase.from("exercises").select("*").eq("id", id)

    if (error) {
        console.error(error)
        return null
    }

    return data[0]
}

export const getExerciseByName = async (name: string) => {
    const supabase = await createClient()
    const { data, error } = await supabase.from("exercises").select("*").eq("name", name)

    if (error) {
        console.error(error)
        return null
    }

    return data[0]
}

export const getExercises = async () => {
    const supabase = await createClient()

    const { data, error } = await supabase.from("exercises").select("*")

    if (error) {
        console.error(error)
        return []
    }

    return data
}

let exercisesCache: Exercise[] | null = null

export const getExercisesCached = async (force = false): Promise<Exercise[]> => {
    if (!force && exercisesCache) return exercisesCache
    const data = (await getExercises()) as Exercise[]
    if (data.length > 0) exercisesCache = data
    return data
}

export const getExercisesByIds = async (ids: string[]) => {
    const supabase = await createClient()

    const { data, error } = await supabase.from("exercises").select("*").in("id", ids)

    if (error) {
        console.error(error)
        return []
    }

    return data
}