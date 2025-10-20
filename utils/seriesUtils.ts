import { createClient } from "./supabase/client";

export async function getSerieById(serieId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from("series")
        .select("*")
        .eq("id", serieId)
        .single()

    if (error) throw error;
    return data;
}
