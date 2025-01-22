import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Clock, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface TimeEntry {
  id: string;
  start_time: string;
  end_time: string | null;
  description: string | null;
}

export default function Dashboard() {
  const user = useStore((state) => state.user);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTimeEntries() {
      try {
        const { data, error } = await supabase
          .from('time_entries')
          .select('*')
          .eq('user_id', user?.id)
          .order('start_time', { ascending: false })
          .limit(10);

        if (error) throw error;
        setTimeEntries(data || []);
      } catch (error) {
        console.error('Error fetching time entries:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTimeEntries();
  }, [user]);

  const calculateDuration = (start: string, end: string | null) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = endTime - startTime;
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const calculateTodayHours = () => {
    const todayEntries = timeEntries.filter(entry => {
      const startDate = new Date(entry.start_time);
      const today = new Date();
      return startDate.toDateString() === today.toDateString();
    });

    const totalMs = todayEntries.reduce((total, entry) => {
      const duration = new Date(entry.end_time || new Date()).getTime() - new Date(entry.start_time).getTime();
      return total + duration;
    }, 0);

    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome back, {user?.full_name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-indigo-50 p-6 rounded-lg">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-indigo-600" />
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Current Status</h3>
                <p className="text-indigo-600 font-medium">
                  {timeEntries[0]?.end_time === null ? 'Currently Working' : 'Not Tracking'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-6 rounded-lg">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Today's Hours</h3>
                <p className="text-green-600 font-medium">
                  {calculateTodayHours()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Time Entries</h3>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {timeEntries.map((entry) => (
              <div key={entry.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {format(parseISO(entry.start_time), 'PPP')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(parseISO(entry.start_time), 'p')} - {entry.end_time ? format(parseISO(entry.end_time), 'p') : 'Ongoing'}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {calculateDuration(entry.start_time, entry.end_time)}
                  </span>
                </div>
                {entry.description && (
                  <p className="mt-2 text-sm text-gray-500">{entry.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}