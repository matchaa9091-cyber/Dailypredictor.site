"use server";

import { supabase } from "../lib/supabaseClient";

export async function saveSingleAccumAction(tier, acc) {
  // Save a single tier's accumulator
  const { data: accumData, error: accumError } = await supabase
    .from('daily_accums')
    .insert({ 
        tier, 
        total_odds: acc.totalOdds, 
        date: new Date().toISOString().slice(0, 10), 
        first_kickoff: acc.firstKick 
    })
    .select()
    .single();

  if (accumError) return null;

  const matchesToInsert = acc.matches.map(m => ({
    accum_id: accumData.id,
    home_team: m.h,
    away_team: m.a,
    league: m.lg,
    flag: m.fl,
    kickoff: m.kickoff,
    market: m.mkt,
    pick: m.pick,
    odds: m.odds,
    confidence: m.conf,
    analysis: m.analysis,
    is_hot: m.hot
  }));

  await supabase.from('match_details').insert(matchesToInsert);
  return accumData;
}

export async function getLatestAccumsAction() {
  const tiers = ["free", "vip", "premium"];
  const results = {};

  for (const tier of tiers) {
    const { data, error } = await supabase
      .from('daily_accums')
      .select(`
        *,
        matches:match_details(*)
      `)
      .eq('tier', tier)
      .eq('date', new Date().toISOString().slice(0, 10))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data && data.matches) {
      // Map DB fields to UI fields
      data.matches = data.matches.map(m => ({
        id: m.id,
        h: m.home_team,
        a: m.away_team,
        lg: m.league,
        fl: m.flag,
        kickoff: m.kickoff,
        mkt: m.market,
        pick: m.pick,
        odds: m.odds,
        conf: m.confidence,
        analysis: m.analysis,
        hot: m.is_hot
      }));
      results[tier] = data;
    }
  }

  return results;
}

export async function checkUnlockStatusAction(phoneNumber, tier) {
    const { data } = await supabase
        .from('unlocked_tickets')
        .select('*')
        .eq('phone_number', phoneNumber)
        .eq('tier', tier)
        .eq('date', new Date().toISOString().slice(0, 10))
        .maybeSingle();
    
    return !!data;
}
