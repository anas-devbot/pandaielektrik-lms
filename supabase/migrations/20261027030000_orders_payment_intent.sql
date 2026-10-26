-- Slice 4: simpan payment intent Bayarcash pada order (untuk papar pautan bayaran semula).
alter table public.orders add column payment_intent_id text, add column payment_url text;
