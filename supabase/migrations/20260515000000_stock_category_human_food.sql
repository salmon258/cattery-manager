-- Split stock_category 'food' (meant for cats) from a new 'human_food' bucket
-- so staff can track pantry items for people separately from cat supplies.
-- Existing 'food' rows stay put and keep meaning cat food — only the display
-- label shifts in the UI. Adds the enum value after 'food' so ordering in the
-- category picker keeps the two food buckets next to each other.

alter type public.stock_category add value if not exists 'human_food' after 'food';
