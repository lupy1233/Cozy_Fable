-- Manifest numeric al bazei (fara date personale): versiune, migratii, trigger audit, randuri per tabel.
-- Numara EXACT toate tabelele din schema public, fara liste hardcodate (nu se desincronizeaza de schema).
-- Rulare: psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -At -f row-counts.sql
begin transaction isolation level repeatable read read only;
-- backup-daily.sh trimite -v snapshot=<id>: numaratoarea vede exact imaginea din pg_dump
\if :{?snapshot}
set transaction snapshot :'snapshot';
\endif

select json_build_object(
  'pg_server_version', current_setting('server_version'),
  'migrations_finished', (
    select count(*) from public._prisma_migrations
    where finished_at is not null and rolled_back_at is null
  ),
  'last_migration', (
    select migration_name from public._prisma_migrations
    where finished_at is not null and rolled_back_at is null
    order by migration_name desc
    limit 1
  ),
  'audit_trigger_present', exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'audit_logs'
      and t.tgname = 'audit_logs_no_update_delete'
      and not t.tgisinternal
  ),
  'row_counts', (
    select coalesce(json_object_agg(table_name, row_count order by table_name), '{}'::json)
    from (
      select
        t.table_name,
        (xpath('/row/c/text()', query_to_xml(
          format('select count(*) as c from %I.%I', t.table_schema, t.table_name), false, true, ''
        )))[1]::text::bigint as row_count
      from information_schema.tables t
      where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    ) counts
  )
);

commit;
