import { createClient } from "./supabase/client"

export const getExercises = async () => {
    const supabase = await createClient()

    const { data, error } = await supabase.from("exercises").select("*")

    if (error) {
        console.error(error)
        return []
    }

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