import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) {
      console.error('[delete-user-account] getUser failed:', {
        userError: userError?.message,
        userErrorName: userError?.name,
        hasUser: !!user,
      });
      return new Response(
        JSON.stringify({ error: userError?.message ?? 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uid = user.id;
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const tables = [
      { table: 'saves', col: 'user_id' },
      { table: 'likes', col: 'user_id' },
      { table: 'comments', col: 'author_id' },
      { table: 'post_notification_settings', col: 'user_id' },
      { table: 'notifications', col: 'user_id' },
      { table: 'notifications', col: 'sender_id' },
      { table: 'posts', col: 'author_id' },
      { table: 'folders', col: 'user_id' },
      { table: 'follows', col: 'follower_id' },
      { table: 'follows', col: 'following_id' },
      { table: 'coffee_chat_requests', col: 'sender_id' },
      { table: 'coffee_chat_requests', col: 'receiver_id' },
      { table: 'profiles', col: 'id' },
    ] as const;

    for (const { table, col } of tables) {
      const { error: delErr } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(col, uid);
      if (delErr) {
        console.error(`[delete-user-account] delete ${table}.${col} failed:`, delErr.message);
        return new Response(
          JSON.stringify({ error: delErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { error: authDelErr } = await supabaseAdmin.rpc('delete_auth_user', {
      p_user_id: uid,
    });
    if (authDelErr) {
      console.error('[delete-user-account] delete_auth_user failed:', authDelErr.message);
      return new Response(
        JSON.stringify({ error: authDelErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[delete-user-account] unexpected error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
