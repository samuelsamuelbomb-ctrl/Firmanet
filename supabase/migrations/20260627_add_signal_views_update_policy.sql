
-- Add UPDATE and DELETE policies for signal_views table
CREATE POLICY "Users can update their own view records" ON public.signal_views FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own view records" ON public.signal_views FOR DELETE USING (auth.uid() = user_id);
