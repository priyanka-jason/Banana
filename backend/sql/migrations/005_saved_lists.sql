-- Banana migration 005: saved shopping lists the website can use.
--
-- Run once in the Supabase SQL Editor, after accounts-setup.sql (which created
-- banana.shopping_lists and banana.shopping_list_items with owner-only access).
-- One transaction: if any line fails, nothing changes.
--
-- What it adds:
--   1. shopping_list_items.snapshot: what the shopper saved (product name, size,
--      store, product details), so a saved list can be shown and re-priced later
--      even if that exact offer has gone.
--   2. At most 20 lists per person.
--   3. banana.save_shopping_list(): saves a list and all its items in one step,
--      so a save never half-finishes. It runs as the signed-in person, so the
--      existing owner-only rules still decide what they can touch.
--
-- Nothing here stores a location or a price the shopper can't already see.

begin;

alter table banana.shopping_list_items
  add column if not exists snapshot jsonb
  check (snapshot is null or (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) <= 4000));

-- At most 20 lists per person.
create or replace function banana.limit_shopping_lists() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from banana.shopping_lists where user_id = new.user_id) >= 20 then
    raise exception 'You can keep up to 20 saved lists. Delete one to save another.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists shopping_lists_limit on banana.shopping_lists;
create trigger shopping_lists_limit before insert on banana.shopping_lists
  for each row execute function banana.limit_shopping_lists();

-- Save a list: a new one when p_list_id is null, otherwise rename it and replace
-- its items. p_items is a JSON array (up to 50) of
--   {"offerId": "...", "quantity": 1-99, ...the rest of the saved item...}
-- Returns the list's id.
create or replace function banana.save_shopping_list(
  p_list_id uuid,
  p_name    text,
  p_items   jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_list_id;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'A list holds up to 50 items.' using errcode = 'check_violation';
  end if;

  if v_id is null then
    insert into banana.shopping_lists (name) values (btrim(p_name)) returning id into v_id;
  else
    update banana.shopping_lists
       set name = btrim(p_name), updated_at = now()
     where id = v_id
    returning id into v_id;
    if v_id is null then
      raise exception 'List not found.' using errcode = 'no_data_found';
    end if;
    delete from banana.shopping_list_items where list_id = v_id;
  end if;

  insert into banana.shopping_list_items (list_id, position, item_id, quantity, snapshot)
  select v_id,
         (e.ord - 1)::int,
         e.item ->> 'offerId',
         (e.item ->> 'quantity')::int,
         e.item - 'quantity'
    from jsonb_array_elements(p_items) with ordinality as e(item, ord);

  return v_id;
end;
$$;

revoke all on function banana.save_shopping_list(uuid, text, jsonb) from public, anon;
grant execute on function banana.save_shopping_list(uuid, text, jsonb) to authenticated;
revoke all on function banana.limit_shopping_lists() from public, anon, authenticated;

commit;

-- Tell the Data API about the new column and function.
notify pgrst, 'reload schema';
