/* ==============================================================
   PIXEL DUKA — shared config
   Fill in your own Supabase project values below.
   Find them in: Supabase Dashboard → Project Settings → API
   ============================================================== */

const SUPABASE_URL = "https://vfraxdbhsswzdxdjiupc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_eSD9VC4LBSRLd2TtWc7Ydw_KoNKy-Xz";

// This client is safe to expose in frontend code — the anon key
// only grants what your Row Level Security policies allow
// (public read of games; writes require an admin session).
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------------------------------------------
// Contact + social links — edit to match your real accounts.
// Icons render automatically in the footer / mobile menu.
// ------------------------------------------------------------
const SOCIAL_LINKS = [
  { name: "Facebook",  url: "https://facebook.com/pixelduka",  icon: "facebook"  },
  { name: "Instagram", url: "https://instagram.com/pixelduka", icon: "instagram" },
  { name: "X",         url: "https://x.com/pixelduka",         icon: "x"         },
  { name: "TikTok",    url: "https://tiktok.com/@pixelduka",   icon: "tiktok"    },
  { name: "YouTube",   url: "https://youtube.com/@pixelduka",  icon: "youtube"   },
  { name: "Discord",   url: "https://discord.gg/pixelduka",    icon: "discord"   }
];

// Simple monochrome path data for each social icon (24x24 viewBox)
const SOCIAL_ICON_PATHS = {
  facebook:  '<path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H9v3h2v7h3v-7h3l1-3h-4V9c0-.6.4-1 1-1z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.1"/>',
  x:         '<path d="M4 4l16 16M20 4L4 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  tiktok:    '<path d="M14 3v10.5a2.5 2.5 0 1 1-2-2.45V9a4.5 4.5 0 1 0 4 4.47V8.2a6 6 0 0 0 3 .8V7a4 4 0 0 1-3-1.6A4 4 0 0 1 15.3 3H14z"/>',
  youtube:   '<rect x="2.5" y="6" width="19" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 9.5l5 2.5-5 2.5z"/>',
  discord:   '<path d="M8 6.5C6.5 7 5 8 4.5 10c-.6 2.5-.7 5-.4 7.3 1.4 1 3 1.6 4.6 1.9l.7-1.3M16 6.5c1.5.5 3 1.5 3.5 3.5.6 2.5.7 5 .4 7.3-1.4 1-3 1.6-4.6 1.9l-.7-1.3M8 6.5c1.2-.4 2.6-.6 4-.6s2.8.2 4 .6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="9" cy="13.2" rx="1.3" ry="1.6"/><ellipse cx="15" cy="13.2" rx="1.3" ry="1.6"/>'
};
