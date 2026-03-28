import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xxx.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'xxx'
// Actually we need the service role key to list users, or just query profiles
// Let's read from .env if possible

import * as fs from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function run() {
    const { data, error } = await supabase.from('profiles').select('email, id, role')
    console.log(data, error)
}

run()
