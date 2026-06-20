-- Migration: add menu_type and text_content columns to menus table
-- Run this in the Supabase SQL editor (https://supabase.com/dashboard)
-- Project: Gestionale Menu (spwyryxoqsiahfwnpaoo)

ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS menu_type text NOT NULL DEFAULT 'dishes'
    CHECK (menu_type IN ('dishes', 'text')),
  ADD COLUMN IF NOT EXISTS text_content jsonb;
