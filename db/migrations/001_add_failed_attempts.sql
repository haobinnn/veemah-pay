-- Migration: add failed_attempts column to accounts
-- Run once against existing environments created before this change.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;