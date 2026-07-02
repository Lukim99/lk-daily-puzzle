-- CASE 05 is solved by a verified collection of interaction proofs, not a player-entered answer.
create or replace function public.complete_interactive_puzzle(p_proof jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_round public.daily_rounds;
  v_required constant jsonb := '{
    "pollution_zero": true,
    "center_false_scar": true,
    "edge_memory_trace": true,
    "four_moth_stamps": true,
    "moths_clear_of_corners": true,
    "cursor_gone": true,
    "input_refusal_trace": true,
    "frame_not_closed": true,
    "frame_gap_trace": true,
    "last_input_blank": true,
    "idle_complete": true
  }'::jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_round := private.ensure_today_round();

  if v_round.puzzle_id <> 5
    or jsonb_typeof(p_proof) <> 'object'
    or not coalesce(p_proof @> v_required, false)
  then
    return jsonb_build_object(
      'correct', false,
      'state', public.get_game_state()
    );
  end if;

  -- Reuse the established, transaction-safe prize settlement after proof validation.
  -- This token is an internal compatibility bridge for the existing answer hash, not a UI answer.
  return public.submit_solution('1207');
end;
$$;

revoke execute on function public.complete_interactive_puzzle(jsonb) from public;
revoke execute on function public.complete_interactive_puzzle(jsonb) from anon;
grant execute on function public.complete_interactive_puzzle(jsonb) to authenticated;
