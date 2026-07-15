-- ============================================================================
-- 0003_history_trigger.sql — audit trail + stamping
-- One history row per real change. Stamps created_by/updated_by/updated_at.
-- Run this THIRD, after 0002_rls.sql.
-- ============================================================================

create or replace function moments_audit()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d jsonb;
begin
  if (tg_op = 'INSERT') then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.created_at := coalesce(new.created_at, now());
    new.updated_by := coalesce(new.updated_by, auth.uid());
    new.updated_at := now();
    insert into moment_history (moment_id, actor_id, action, diff)
      values (new.id, auth.uid(), 'created', to_jsonb(new));
    return new;

  elsif (tg_op = 'UPDATE') then
    new.updated_by := auth.uid();
    new.updated_at := now();

    -- Field-level diff, ignoring the stamp columns themselves.
    select jsonb_object_agg(o.key, jsonb_build_array(o.value, n.value))
      into d
    from jsonb_each(to_jsonb(old)) o
    join jsonb_each(to_jsonb(new)) n on n.key = o.key
    where o.value is distinct from n.value
      and o.key not in ('updated_at', 'updated_by');

    -- Nothing meaningful changed (e.g. a no-op save) — don't log noise.
    if d is null then
      return new;
    end if;

    insert into moment_history (moment_id, actor_id, action, diff)
      values (new.id, auth.uid(), 'updated', d);
    return new;

  elsif (tg_op = 'DELETE') then
    insert into moment_history (moment_id, actor_id, action, diff)
      values (old.id, auth.uid(), 'deleted', to_jsonb(old));
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists moments_audit_trg on moments;
create trigger moments_audit_trg
  before insert or update or delete on moments
  for each row execute function moments_audit();
