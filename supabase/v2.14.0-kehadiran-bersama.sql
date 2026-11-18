-- =============================================================================
-- DrillKit v2.14.0 — Kehadiran bersama (Supabase)
--
-- Jalankan SEKALI di Supabase › SQL Editor › New query › tempel › Run.
-- Aman dijalankan ulang: semua perintah memakai IF NOT EXISTS / OR REPLACE.
--
-- Yang disimpan di server HANYA yang dibutuhkan untuk mengisi dan memutus
-- kehadiran bersama-sama:
--   tim        nama tim
--   staf_tim   email Google staf + perannya (pemilik/danlat/pencatat/pengamat)
--   kerangka   daftar anggota (nama, panggilan, section, status aktif),
--              daftar sesi (judul, tanggal, jam, isian Form presensi), dan
--              aturan program latihan
--   kehadiran  satu baris per anggota per sesi (status, jam datang/pulang,
--              izin, bukti, putusan danlat)
-- Data lain (drill, musik, evaluasi, kartu medis, kas, nomor HP, dsb.) TIDAK
-- pernah dikirim; tetap di perangkat masing-masing.
--
-- Peran:
--   pemilik   semua; mengundang staf; satu-satunya yang mengirim kerangka
--   danlat    mengisi kehadiran + memutus izin/sakit/telat/pulang awal
--   pencatat  mengisi kehadiran; putusan yang ia kirim diabaikan server
--   pengamat  PH & asisten — hanya melihat
-- =============================================================================

-- ---------------------------------------------------------------- tabel ----

create table if not exists public.tim (
  id         uuid primary key default gen_random_uuid(),
  nama       text not null check (char_length(nama) between 1 and 80),
  dibuat_at  timestamptz not null default now()
);

create table if not exists public.staf_tim (
  tim_id        uuid not null references public.tim (id) on delete cascade,
  email         text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  peran         text not null check (peran in ('pemilik', 'danlat', 'pencatat', 'pengamat')),
  nama          text check (char_length(nama) <= 60),
  user_id       uuid references auth.users (id) on delete set null,
  masuk_at      timestamptz,
  dibuat_at     timestamptz not null default now(),
  primary key (tim_id, email)
);

create table if not exists public.kerangka (
  tim_id      uuid not null references public.tim (id) on delete cascade,
  jenis       text not null check (jenis in ('anggota', 'sesi', 'konfig')),
  id          text not null check (char_length(id) between 1 and 80),
  data        jsonb not null default '{}'::jsonb check (pg_column_size(data) < 200000),
  dihapus     boolean not null default false,
  diubah_at   timestamptz not null default clock_timestamp(),
  diubah_oleh uuid,
  primary key (tim_id, jenis, id)
);
create index if not exists kerangka_tim_diubah on public.kerangka (tim_id, diubah_at);

create table if not exists public.kehadiran (
  tim_id      uuid not null references public.tim (id) on delete cascade,
  sesi_id     text not null check (char_length(sesi_id) between 1 and 80),
  anggota_id  text not null check (char_length(anggota_id) between 1 and 80),
  data        jsonb not null check (pg_column_size(data) < 16000),
  dihapus     boolean not null default false,
  diubah_at   timestamptz not null default clock_timestamp(),
  diubah_oleh uuid,
  primary key (tim_id, sesi_id, anggota_id)
);
create index if not exists kehadiran_tim_diubah on public.kehadiran (tim_id, diubah_at);

-- --------------------------------------------------------------- fungsi ----

-- Email akun yang sedang masuk — hanya bila emailnya sudah terverifikasi.
-- Google selalu memverifikasi; pendaftaran email biasa yang belum dikonfirmasi
-- tidak bisa menyamar sebagai staf.
create or replace function public.email_saya()
returns text
language sql stable security definer
set search_path = public, auth
as $$
  select lower(u.email) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null
$$;

-- Peran akun ini di sebuah tim (NULL = bukan staf).
create or replace function public.peran_di(t uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select s.peran from public.staf_tim s
  where s.tim_id = t and s.email = public.email_saya()
$$;

-- Daftar tim milik akun ini + menandai undangan sudah dipakai.
create or replace function public.tim_saya()
returns table (tim_id uuid, nama_tim text, peran text, nama text)
language plpgsql volatile security definer
set search_path = public
as $$
declare e text := public.email_saya();
begin
  if e is null then return; end if;
  update public.staf_tim s
     set user_id = auth.uid(), masuk_at = coalesce(s.masuk_at, now())
   where s.email = e and (s.user_id is distinct from auth.uid() or s.masuk_at is null);
  return query
    select s.tim_id, t.nama, s.peran, s.nama
      from public.staf_tim s join public.tim t on t.id = s.tim_id
     where s.email = e
     order by t.dibuat_at;
end
$$;

-- ------------------------------------------------------------- pemicu ----

-- Cap waktu & pengubah selalu diisi server, bukan perangkat (jam HP bisa salah).
create or replace function public.cap_ubahan()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.diubah_at := clock_timestamp();
  new.diubah_oleh := auth.uid();
  return new;
end
$$;

-- Kehadiran: isi data diselaraskan dengan kuncinya, dan putusan dari pencatat
-- dibuang (putusan tetap milik danlat/pemilik).
create or replace function public.jaga_kehadiran()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  p text := public.peran_di(new.tim_id);
  kunci_putusan text[] := array['putusanIzin', 'putusanOleh', 'putusanAt', 'putusanCatatan'];
  k text;
begin
  new.data := new.data || jsonb_build_object('sessionId', new.sesi_id, 'memberId', new.anggota_id);
  if p = 'pencatat' then
    foreach k in array kunci_putusan loop
      if tg_op = 'UPDATE' and old.data ? k then
        new.data := jsonb_set(new.data, array[k], old.data -> k);
      else
        new.data := new.data - k;
      end if;
    end loop;
  end if;
  return new;
end
$$;

-- Staf: pemilik terakhir tidak bisa dihapus atau diturunkan perannya.
create or replace function public.jaga_pemilik()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.peran = 'pemilik' and (tg_op = 'DELETE' or new.peran <> 'pemilik' or new.email <> old.email) then
    if (select count(*) from public.staf_tim where tim_id = old.tim_id and peran = 'pemilik') <= 1 then
      raise exception 'Tim harus punya minimal satu pemilik.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

drop trigger if exists kerangka_cap on public.kerangka;
create trigger kerangka_cap before insert or update on public.kerangka
  for each row execute function public.cap_ubahan();

drop trigger if exists kehadiran_cap on public.kehadiran;
create trigger kehadiran_cap before insert or update on public.kehadiran
  for each row execute function public.cap_ubahan();

drop trigger if exists kehadiran_jaga on public.kehadiran;
create trigger kehadiran_jaga before insert or update on public.kehadiran
  for each row execute function public.jaga_kehadiran();

drop trigger if exists staf_jaga_pemilik on public.staf_tim;
create trigger staf_jaga_pemilik before update or delete on public.staf_tim
  for each row execute function public.jaga_pemilik();

-- ----------------------------------------------------- hak akses (RLS) ----

alter table public.tim       enable row level security;
alter table public.staf_tim  enable row level security;
alter table public.kerangka  enable row level security;
alter table public.kehadiran enable row level security;

revoke all on public.tim, public.staf_tim, public.kerangka, public.kehadiran from anon;
grant select, update on public.tim to authenticated;
grant select, insert, update, delete on public.staf_tim to authenticated;
grant select, insert, update on public.kerangka to authenticated;
grant select, insert, update on public.kehadiran to authenticated;
revoke execute on function public.email_saya(), public.peran_di(uuid), public.tim_saya() from anon, public;
grant execute on function public.email_saya(), public.peran_di(uuid), public.tim_saya() to authenticated;

drop policy if exists tim_baca on public.tim;
create policy tim_baca on public.tim for select to authenticated
  using (public.peran_di(id) is not null);
drop policy if exists tim_ubah on public.tim;
create policy tim_ubah on public.tim for update to authenticated
  using (public.peran_di(id) = 'pemilik') with check (public.peran_di(id) = 'pemilik');

drop policy if exists staf_baca on public.staf_tim;
create policy staf_baca on public.staf_tim for select to authenticated
  using (email = public.email_saya() or public.peran_di(tim_id) = 'pemilik');
drop policy if exists staf_tambah on public.staf_tim;
create policy staf_tambah on public.staf_tim for insert to authenticated
  with check (public.peran_di(tim_id) = 'pemilik');
drop policy if exists staf_ubah on public.staf_tim;
create policy staf_ubah on public.staf_tim for update to authenticated
  using (public.peran_di(tim_id) = 'pemilik') with check (public.peran_di(tim_id) = 'pemilik');
drop policy if exists staf_hapus on public.staf_tim;
create policy staf_hapus on public.staf_tim for delete to authenticated
  using (public.peran_di(tim_id) = 'pemilik');

drop policy if exists kerangka_baca on public.kerangka;
create policy kerangka_baca on public.kerangka for select to authenticated
  using (public.peran_di(tim_id) is not null);
drop policy if exists kerangka_tambah on public.kerangka;
create policy kerangka_tambah on public.kerangka for insert to authenticated
  with check (public.peran_di(tim_id) = 'pemilik');
drop policy if exists kerangka_ubah on public.kerangka;
create policy kerangka_ubah on public.kerangka for update to authenticated
  using (public.peran_di(tim_id) = 'pemilik') with check (public.peran_di(tim_id) = 'pemilik');

drop policy if exists kehadiran_baca on public.kehadiran;
create policy kehadiran_baca on public.kehadiran for select to authenticated
  using (public.peran_di(tim_id) is not null);
drop policy if exists kehadiran_tambah on public.kehadiran;
create policy kehadiran_tambah on public.kehadiran for insert to authenticated
  with check (public.peran_di(tim_id) in ('pemilik', 'danlat', 'pencatat'));
drop policy if exists kehadiran_ubah on public.kehadiran;
create policy kehadiran_ubah on public.kehadiran for update to authenticated
  using (public.peran_di(tim_id) in ('pemilik', 'danlat', 'pencatat'))
  with check (public.peran_di(tim_id) in ('pemilik', 'danlat', 'pencatat'));

-- =============================================================================
-- LANGKAH TERAKHIR — tim pertama & pemiliknya.
--
-- Ganti  email-pemilik@gmail.com  dengan email Google pemilik (huruf kecil),
-- lalu jalankan dua baris di bawah ini. Cukup sekali; staf lain diundang dari
-- DrillKit › Pengaturan › Kehadiran bersama.
-- =============================================================================

-- insert into public.tim (id, nama)
--   values ('00000000-0000-4000-8000-000000000001', 'Tim DrillKit') on conflict (id) do nothing;
-- insert into public.staf_tim (tim_id, email, peran, nama)
--   values ('00000000-0000-4000-8000-000000000001', 'email-pemilik@gmail.com', 'pemilik', 'Pemilik')
--   on conflict (tim_id, email) do nothing;
