const SUPABASE_URL = 'https://lwvjytsjaafplrmmhmvo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Q6VitIp1cxFnmJfkNWw1ZQ_qOXI5Lcb';

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
