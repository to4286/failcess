-- ============================================
-- Fix Folders Table RLS Policies
-- ============================================
-- This script fixes the 42501 error by properly configuring RLS policies
-- Run this in Supabase SQL Editor

-- Step 1: Drop all existing policies on folders table
DROP POLICY IF EXISTS "Users can insert their own folders" ON folders;
DROP POLICY IF EXISTS "Users can view their own folders" ON folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;
DROP POLICY IF EXISTS "folders_insert_policy" ON folders;
DROP POLICY IF EXISTS "folders_select_policy" ON folders;
DROP POLICY IF EXISTS "folders_update_policy" ON folders;
DROP POLICY IF EXISTS "folders_delete_policy" ON folders;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON folders;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON folders;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON folders;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON folders;

-- Step 2: Enable RLS (if not already enabled)
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Step 3: Create INSERT policy
-- Users can only insert folders where they are the owner
CREATE POLICY "Users can insert their own folders" ON folders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Step 4: Create SELECT policy
-- Users can only view their own folders
CREATE POLICY "Users can view their own folders" ON folders
  FOR SELECT
  USING (auth.uid() = user_id);

-- Step 5: Create UPDATE policy
-- Users can only update their own folders
CREATE POLICY "Users can update their own folders" ON folders
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 6: Create DELETE policy
-- Users can only delete their own folders
CREATE POLICY "Users can delete their own folders" ON folders
  FOR DELETE
  USING (auth.uid() = user_id);

-- Verification query (optional - run to check policies)
-- SELECT * FROM pg_policies WHERE tablename = 'folders';
