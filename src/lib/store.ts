import { create } from 'zustand';
import { supabase } from './supabase';
import { Profile, TimeEntry } from './database.types';

interface AuthState {
  user: Profile | null;
  timeEntries: TimeEntry[];
  currentTimeEntry: TimeEntry | null;
  setUser: (user: Profile | null) => void;
  setTimeEntries: (entries: TimeEntry[]) => void;
  setCurrentTimeEntry: (entry: TimeEntry | null) => void;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  captureScreenshot: () => Promise<void>;
}

export const useStore = create<AuthState>((set, get) => ({
  user: null,
  timeEntries: [],
  currentTimeEntry: null,
  
  setUser: (user) => set({ user }),
  setTimeEntries: (entries) => set({ timeEntries: entries }),
  setCurrentTimeEntry: (entry) => set({ currentTimeEntry: entry }),
  
  startTracking: async () => {
    const { data: entry, error } = await supabase
      .from('time_entries')
      .insert({
        user_id: get().user?.id,
        start_time: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    set({ currentTimeEntry: entry });
  },

  stopTracking: async () => {
    const currentEntry = get().currentTimeEntry;
    if (!currentEntry) return;

    const { error } = await supabase
      .from('time_entries')
      .update({
        end_time: new Date().toISOString(),
      })
      .eq('id', currentEntry.id);

    if (error) throw error;
    set({ currentTimeEntry: null });
  },

  captureScreenshot: async () => {
    const currentEntry = get().currentTimeEntry;
    if (!currentEntry) return;

    // Handle screenshot capture and upload logic
    // This will be implemented in the TimeTracker component
  },
}));