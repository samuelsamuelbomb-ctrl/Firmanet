
ALTER TABLE public.signals
  ADD COLUMN lat double precision NOT NULL DEFAULT 6.6018,
  ADD COLUMN lng double precision NOT NULL DEFAULT 3.3515;
