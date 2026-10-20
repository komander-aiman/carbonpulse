-- Seed reference data: township, subzones, factor versions, model version.
-- Safe to re-run: every insert is keyed and uses on conflict do nothing.

insert into township (slug, name, region, boundary_source, is_boundary_official)
values ('elmina', 'City of Elmina', 'peninsular', 'OSM way 866543395', false)
on conflict (slug) do nothing;

insert into subzone (township_id, slug, name, geojson)
select t.id, s.slug, s.name, s.geojson
from township t
cross join (values
  ('elmina-north', 'Elmina North', '{"type":"Polygon","coordinates":[[[101.4925,3.1872],[101.5104,3.1872],[101.5104,3.2135],[101.4925,3.2135],[101.4925,3.1872]]]}'::jsonb),
  ('elmina-central', 'Elmina Central', '{"type":"Polygon","coordinates":[[[101.5104,3.1872],[101.5289,3.1872],[101.5289,3.2135],[101.5104,3.2135],[101.5104,3.1872]]]}'::jsonb),
  ('elmina-west', 'Elmina West', '{"type":"Polygon","coordinates":[[[101.4925,3.1738],[101.5104,3.1738],[101.5104,3.1872],[101.4925,3.1872],[101.4925,3.1738]]]}'::jsonb),
  ('elmina-east', 'Elmina East', '{"type":"Polygon","coordinates":[[[101.5104,3.1738],[101.5289,3.1738],[101.5289,3.1872],[101.5104,3.1872],[101.5104,3.1738]]]}'::jsonb),
  ('elmina-south', 'Elmina South', '{"type":"Polygon","coordinates":[[[101.4925,3.1603],[101.5104,3.1603],[101.5104,3.1738],[101.4925,3.1738],[101.4925,3.1603]]]}'::jsonb),
  ('elmina-lake', 'Elmina Lake', '{"type":"Polygon","coordinates":[[[101.5104,3.1603],[101.5289,3.1603],[101.5289,3.1738],[101.5104,3.1738],[101.5104,3.1603]]]}'::jsonb)
) as s(slug, name, geojson)
where t.slug = 'elmina'
on conflict (township_id, slug) do nothing;

insert into factor_version
  (id, region, year, kg_per_kwh, status, basis, source_id, source_url, published_on)
values
  ('00000000-0000-4000-8000-000000000001', 'peninsular', 2024, 0.7400, 'provisional',
   'Generation-weighted average, main activity producers, Tier 1 factors, net generation',
   'S1', 'https://www.st.gov.my/', '2026-02-23'),
  ('00000000-0000-4000-8000-000000000002', 'peninsular', 2023, 0.7600, 'provisional',
   'Generation-weighted average, main activity producers', 'S1', 'https://www.st.gov.my/', '2025-02-01'),
  ('00000000-0000-4000-8000-000000000003', 'peninsular', 2022, 0.7690, 'provisional',
   'Generation-weighted average, main activity producers', 'S1', 'https://www.st.gov.my/', '2024-02-01'),
  ('00000000-0000-4000-8000-000000000004', 'sabah', 2024, 0.5390, 'provisional',
   'Generation-weighted average, main activity producers', 'S1', 'https://www.st.gov.my/', '2026-02-23'),
  ('00000000-0000-4000-8000-000000000005', 'sarawak', 2024, 0.1990, 'provisional',
   'Generation-weighted average, main activity producers', 'S1', 'https://www.st.gov.my/', '2026-02-23')
on conflict do nothing;

update factor_version
  set supersedes_id = '00000000-0000-4000-8000-000000000002'
  where id = '00000000-0000-4000-8000-000000000001';
update factor_version
  set supersedes_id = '00000000-0000-4000-8000-000000000003'
  where id = '00000000-0000-4000-8000-000000000002';

insert into model_version
  (id, description, calibration_date, coeffs, annual_mean, min_value, max_value, changelog)
values (
  'diurnal-1.0.0+2026-10',
  'Demand-driven diurnal shape with solar suppression, annual mean anchored to the published Peninsular factor.',
  '2026-10-01',
  '{"solarCoeff":0.34,"baseload":0.5,"smoothingPasses":5,"iMin":0.45,"iMax":1.0}'::jsonb,
  0.739996, 0.4500, 1.0000,
  'Initial calibration. Clamping avoided by smoothing the circular hourly cycle; max adjacent-hour jump 0.069.'
)
on conflict (id) do nothing;

insert into action_evidence
  (action_id, evidence_version, title, category, kwh_low, kwh_high, effort, applies_to, confidence, source)
values
  ('temperature', 'actions-1.0.0', 'Keep cooling at 24–26°C', 'cooling', 12, 18, 1,
   array['ac_evening','ac_all_day','mixed'], 'high', 'Malaysian household cooling field studies, 2023 range'),
  ('timer', 'actions-1.0.0', 'Use a 2-hour sleep timer', 'cooling', 8, 12, 1,
   array['ac_evening','ac_all_day','mixed'], 'medium', 'Cooling duty-cycle assumption, 2024'),
  ('standby', 'actions-1.0.0', 'Switch off one entertainment zone', 'standby', 3, 5, 1,
   array['ac_evening','ac_all_day','workday_absent','mixed'], 'medium', 'Standby power measurements, 2022 range'),
  ('led', 'actions-1.0.0', 'Replace the most-used bulbs with LEDs', 'lighting', 4, 8, 2,
   array['ac_evening','ac_all_day','workday_absent','mixed'], 'high', 'Lighting wattage comparison, 2023'),
  ('water-heater', 'actions-1.0.0', 'Shorten water-heating time', 'hot_water', 6, 14, 2,
   array['ac_evening','workday_absent','mixed'], 'medium', 'Water heater duty-cycle estimate, 2023'),
  ('appliance-schedule', 'actions-1.0.0', 'Shift laundry and dishwashing', 'appliance_scheduling', 3, 7, 1,
   array['ac_evening','ac_all_day','workday_absent','mixed'], 'medium', 'Appliance load scheduling, 2024'),
  ('fridge-clearance', 'actions-1.0.0', 'Give the fridge room to breathe', 'appliance_scheduling', 2, 4, 1,
   array['ac_evening','ac_all_day','workday_absent','mixed'], 'low', 'Refrigeration clearance guidance, 2022'),
  ('ac-servicing', 'actions-1.0.0', 'Service the air conditioner filter', 'cooling', 2, 6, 2,
   array['ac_evening','ac_all_day'], 'medium', 'Air-conditioner maintenance guidance, 2023')
on conflict (action_id, evidence_version) do nothing;
