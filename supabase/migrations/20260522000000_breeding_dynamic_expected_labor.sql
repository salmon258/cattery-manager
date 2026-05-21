-- Compute expected labor date dynamically instead of storing it.
--
-- `mating_records.expected_labor_date` was a generated column defined as
-- `mating_date + 63`, which baked the gestation interval into the schema and
-- ignored the user-configurable `system_settings.gestation_days`. A generated
-- column can only reference columns of its own row, so it can never read the
-- setting. Drop it; the API now derives the date at read time as
-- `mating_date + system_settings.gestation_days`.

alter table public.mating_records drop column if exists expected_labor_date;
