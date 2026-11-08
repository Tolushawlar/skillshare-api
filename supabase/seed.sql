insert into public.trades (slug, name, icon, sort_order) values
  ('mechanic', 'Mechanic', 'wrench', 1),
  ('electrician', 'Electrician', 'bolt', 2),
  ('plumber', 'Plumber', 'pipe', 3),
  ('carpenter', 'Carpenter', 'hammer', 4),
  ('painter', 'Painter', 'brush', 5),
  ('ac-technician', 'AC Technician', 'wind', 6),
  ('tailor', 'Tailor', 'scissors', 7),
  ('generator-repair', 'Generator Repair', 'engine', 8),
  ('welder', 'Welder', 'flame', 9),
  ('tiler', 'Tiler', 'grid', 10)
on conflict (slug) do update set
  name = excluded.name,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true;
