import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Local deck editing remains available until a Supabase project is configured.
export const supabase = url && key ? createClient(url, key) : null;
