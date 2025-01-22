import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Camera, Monitor, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Screenshot {
  id: string;
  time_entry_id: string;
  storage_path: string;
  taken_at: string;
  type: 'screen' | 'webcam';
  user: {
    full_name: string;
  };
}

export default function Screenshots() {
  const user = useStore((state) => state.user);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchScreenshots() {
      try {
        let query = supabase
          .from('screenshots')
          .select(`
            *,
            time_entries!inner(
              user_id,
              profiles!inner(full_name)
            )
          `)
          .order('taken_at', { ascending: false });

        // If not admin, only fetch own screenshots
        if (user?.role !== 'admin') {
          if (user?.role === 'manager') {
            // Managers can see their team's screenshots
            query = query.in('time_entries.user_id', 
              supabase
                .from('profiles')
                .select('id')
                .eq('manager_id', user.id)
            );
          } else {
            // Regular users can only see their own screenshots
            query = query.eq('time_entries.user_id', user?.id);
          }
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        const screenshotsWithUrls = await Promise.all((data || []).map(async (screenshot) => {
          const { data: urlData } = await supabase.storage
            .from('screenshots')
            .createSignedUrl(screenshot.storage_path, 3600); // 1 hour expiry

          return {
            ...screenshot,
            url: urlData?.signedUrl,
            user: {
              full_name: screenshot.time_entries.profiles.full_name
            }
          };
        }));

        setScreenshots(screenshotsWithUrls);
      } catch (error) {
        console.error('Error fetching screenshots:', error);
        setError('Failed to load screenshots. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchScreenshots();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading screenshots...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Camera className="h-8 w-8 text-indigo-600" />
            <h2 className="ml-3 text-2xl font-bold text-gray-900">Screenshots</h2>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
            {screenshots.length} Screenshots
          </span>
        </div>

        {error && (
          <div className="mb-6 flex items-center p-4 text-red-800 bg-red-50 rounded-lg">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {screenshots.map((screenshot) => (
            <div key={screenshot.id} className="bg-gray-50 rounded-lg overflow-hidden shadow-sm">
              {screenshot.url ? (
                <img
                  src={screenshot.url}
                  alt={`${screenshot.type} capture from ${format(new Date(screenshot.taken_at), 'PPp')}`}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 flex items-center justify-center bg-gray-100">
                  <span className="text-gray-400">Image not available</span>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    {screenshot.type === 'webcam' ? (
                      <Camera className="h-4 w-4 text-indigo-600 mr-1" />
                    ) : (
                      <Monitor className="h-4 w-4 text-indigo-600 mr-1" />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {screenshot.type === 'webcam' ? 'Webcam' : 'Screen'} Capture
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-500 mb-1">
                  By: {screenshot.user.full_name}
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="h-4 w-4 mr-1" />
                  {format(new Date(screenshot.taken_at), 'PPp')}
                </div>
              </div>
            </div>
          ))}
        </div>

        {screenshots.length === 0 && (
          <div className="text-center py-12">
            <Camera className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No screenshots</h3>
            <p className="mt-1 text-sm text-gray-500">
              No screenshots have been captured yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}