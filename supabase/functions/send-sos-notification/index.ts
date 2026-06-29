// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    );

    // Get the new SOS session from the request
    const { record } = await req.json();
    const { user_id, location, lat, lng, id: sos_id } = record;

    // 1. Get the SOS sender's display name
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("display_name")
      .eq("id", user_id)
      .single();

    const senderName = profileData?.display_name || "Someone";

    // 2. Get circle members of the SOS sender
    const { data: circleMembers } = await supabaseClient
      .from("circle_members")
      .select("member_user_id")
      .eq("owner_id", user_id);

    const circleUserIds = circleMembers
      ?.map((m) => m.member_user_id)
      .filter((id): id is string => id !== null) || [];

    // 3. Get all device tokens for those users
    const { data: tokensToNotify } = await supabaseClient
      .from("device_tokens")
      .select("token")
      .in("user_id", circleUserIds);

    const tokens = tokensToNotify?.map((t) => t.token) || [];

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No tokens to notify" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // 4. Send notifications using Expo Push API
    const messages = tokens.map((token) => ({
      to: token,
      sound: "default",
      title: `🚨 SOS from ${senderName}!`,
      body: location ? `Emergency at: ${location}` : "Emergency SOS activated!",
      data: {
        kind: "sos",
        sos_id,
        lat,
        lng,
        location,
      },
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        result,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
