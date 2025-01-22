import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { Play, Square, Camera, Clock, Monitor, AlertCircle, Download } from 'lucide-react';
import Webcam from 'react-webcam';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';

interface Screenshot {
  id: string;
  time_entry_id: string;
  storage_path: string;
  taken_at: string;
  type: 'screen' | 'webcam';
  url?: string;
  user?: {
    full_name: string;
  };
}

interface TimeEntry {
  id: string;
  start_time: string;
  end_time: string | null;
  user_id: string;
}

const WEBCAM_CONFIG = {
  width: 1280,
  height: 720,
  facingMode: "user",
  screenshotQuality: 1,
  screenshotFormat: "image/jpeg"
};

export default function TimeTracker() {
  const user = useStore((state) => state.user);
  const [currentTimeEntry, setCurrentTimeEntry] = useState<TimeEntry | null>(null);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const webcamRef = useRef<Webcam>(null);
  const intervalRef = useRef<number | null>(null);
  const [hasScreenPermission, setHasScreenPermission] = useState(false);
  const [hasWebcamPermission, setHasWebcamPermission] = useState(false);

  useEffect(() => {
    async function checkExistingTimeEntry() {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('time_entries')
          .select('*')
          .eq('user_id', user.id)
          .is('end_time', null)
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setCurrentTimeEntry(data);
          checkPermissions();
        }
      } catch (error) {
        console.error('Error checking time entry:', error);
        setError('Failed to check existing time entry');
      }
    }

    checkExistingTimeEntry();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id]);

  const checkPermissions = async () => {
    try {
      // Check screen capture permission
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setHasScreenPermission(true);
      } catch {
        setHasScreenPermission(false);
      }

      // Check webcam permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setHasWebcamPermission(true);
      } catch {
        setHasWebcamPermission(false);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  useEffect(() => {
    fetchScreenshots();
  }, [currentTimeEntry, user]);

  useEffect(() => {
    if (currentTimeEntry) {
      updateElapsedTime();
      intervalRef.current = window.setInterval(updateElapsedTime, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentTimeEntry]);

  const updateElapsedTime = () => {
    if (!currentTimeEntry) return;
    
    const start = new Date(currentTimeEntry.start_time).getTime();
    const now = Date.now();
    const diff = Math.floor((now - start) / 1000);
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    
    setElapsedTime(
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    );
  };

  const fetchScreenshots = async () => {
    if (!user) return;
    
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

      if (user.role === 'employee') {
        query = query.eq('time_entries.user_id', user.id);
      } else if (user.role === 'manager') {
        query = query.in('time_entries.user_id', 
          supabase
            .from('profiles')
            .select('id')
            .eq('manager_id', user.id)
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      const screenshotsWithUrls = await Promise.all((data || []).map(async (screenshot) => {
        const { data: urlData } = await supabase.storage
          .from('screenshots')
          .createSignedUrl(screenshot.storage_path, 3600);

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
      setError('Failed to load screenshots');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTracking = async () => {
    try {
      // Create time entry first
      const { data: entry, error: entryError } = await supabase
        .from('time_entries')
        .insert({
          user_id: user?.id,
          start_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (entryError) throw entryError;
      setCurrentTimeEntry(entry);

      // Check permissions after starting tracking
      await checkPermissions();

      // Start screenshot interval if permissions are granted
      if (hasScreenPermission || hasWebcamPermission) {
        intervalRef.current = window.setInterval(captureScreenshots, 5 * 60 * 1000);
        captureScreenshots(); // Take initial screenshots
      }
    } catch (error) {
      console.error('Error starting tracking:', error);
      setError('Failed to start tracking');
    }
  };

  const handleStopTracking = async () => {
    if (!currentTimeEntry) return;

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({ end_time: new Date().toISOString() })
        .eq('id', currentTimeEntry.id);

      if (error) throw error;

      setCurrentTimeEntry(null);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } catch (error) {
      console.error('Error stopping tracking:', error);
      setError('Failed to stop tracking');
    }
  };

  const captureScreenshots = async () => {
    if (!currentTimeEntry) return;

    try {
      const timestamp = new Date().toISOString();
      const insertData: any[] = [];

      // Capture screen if permission granted
      if (hasScreenPermission) {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          const track = stream.getVideoTracks()[0];
          const imageCapture = new ImageCapture(track);
          const screenBlob = await imageCapture.grabFrame().then(bitmap => {
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(bitmap, 0, 0);
            return new Promise<Blob>((resolve) => {
              canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.9);
            });
          });

          const screenPath = `${user?.id}/${currentTimeEntry.id}/screen_${timestamp}.jpg`;
          await supabase.storage.from('screenshots').upload(screenPath, screenBlob);
          
          insertData.push({
            time_entry_id: currentTimeEntry.id,
            storage_path: screenPath,
            type: 'screen',
            taken_at: timestamp
          });

          stream.getTracks().forEach(track => track.stop());
        } catch (error) {
          console.error('Screen capture failed:', error);
          setHasScreenPermission(false);
        }
      }

      // Capture webcam if permission granted
      if (hasWebcamPermission && webcamRef.current) {
        try {
          const webcamShot = webcamRef.current.getScreenshot();
          if (webcamShot) {
            const webcamBlob = base64ToBlob(webcamShot);
            const webcamPath = `${user?.id}/${currentTimeEntry.id}/webcam_${timestamp}.jpg`;
            await supabase.storage.from('screenshots').upload(webcamPath, webcamBlob);
            
            insertData.push({
              time_entry_id: currentTimeEntry.id,
              storage_path: webcamPath,
              type: 'webcam',
              taken_at: timestamp
            });
          }
        } catch (error) {
          console.error('Webcam capture failed:', error);
          setHasWebcamPermission(false);
        }
      }

      // Insert screenshot records if any were captured
      if (insertData.length > 0) {
        await supabase.from('screenshots').insert(insertData);
        await fetchScreenshots();
      }
    } catch (error) {
      console.error('Error capturing screenshots:', error);
      setError('Failed to capture screenshots');
    }
  };

  const exportTimeReport = async () => {
    try {
      const { data: timeEntries, error } = await supabase
        .from('time_entries')
        .select('*, profiles(full_name)')
        .eq('user_id', user?.id)
        .order('start_time', { ascending: false });

      if (error) throw error;

      const reportData = timeEntries.map(entry => ({
        'Employee Name': entry.profiles.full_name,
        'Date': format(parseISO(entry.start_time), 'yyyy-MM-dd'),
        'Start Time': format(parseISO(entry.start_time), 'HH:mm:ss'),
        'End Time': entry.end_time ? format(parseISO(entry.end_time), 'HH:mm:ss') : 'Ongoing',
        'Hours': entry.end_time 
          ? ((new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)).toFixed(2)
          : 'Ongoing'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(reportData);
      XLSX.utils.book_append_sheet(wb, ws, 'Time Report');
      XLSX.writeFile(wb, `time_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } catch (error) {
      console.error('Failed to export report:', error);
      setError('Failed to export time report');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-indigo-600" />
            <h2 className="ml-3 text-2xl font-bold text-gray-900">Time Tracker</h2>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={exportTimeReport}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </button>
            {!currentTimeEntry ? (
              <button
                onClick={handleStartTracking}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Tracking
              </button>
            ) : (
              <button
                onClick={handleStopTracking}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Tracking
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {currentTimeEntry && (
          <div className="mb-6 bg-indigo-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-indigo-600 mr-2" />
                <span className="text-indigo-900 font-medium">Time Elapsed:</span>
              </div>
              <span className="text-2xl font-bold text-indigo-600">{elapsedTime}</span>
            </div>
            <div className="mt-2 text-sm text-indigo-600">
              {!hasScreenPermission && !hasWebcamPermission && (
                <p>Note: No screen or webcam permissions granted. Only tracking time.</p>
              )}
              {(hasScreenPermission || hasWebcamPermission) && (
                <p>
                  Capturing: {[
                    hasScreenPermission && 'Screen',
                    hasWebcamPermission && 'Webcam'
                  ].filter(Boolean).join(' & ')}
                </p>
              )}
            </div>
          </div>
        )}

        {hasWebcamPermission && (
          <div className="hidden">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={WEBCAM_CONFIG}
              screenshotQuality={1}
            />
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading screenshots...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {screenshots.map((screenshot) => (
              <div key={screenshot.id} className="bg-gray-50 rounded-lg overflow-hidden shadow-sm">
                {screenshot.url ? (
                  <img
                    src={screenshot.url}
                    alt={`${screenshot.type} capture at ${format(parseISO(screenshot.taken_at), 'PPp')}`}
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
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="h-4 w-4 mr-1" />
                    {format(parseISO(screenshot.taken_at), 'PPp')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}