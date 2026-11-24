const fs = require('node:fs');
const path = require('node:path');

const outputPath = path.join(process.cwd(), 'public', 'runtime-config.json');

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NG_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NG_SUPABASE_KEY;

if (supabaseUrl && supabaseKey) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ supabaseUrl, supabaseKey }, null, 2),
    'utf8'
  );
  console.log('Generated public/runtime-config.json from environment variables.');
} else if (!fs.existsSync(outputPath)) {
  console.error(
    'Missing Supabase runtime configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY or create public/runtime-config.json.'
  );
  process.exit(1);
}
