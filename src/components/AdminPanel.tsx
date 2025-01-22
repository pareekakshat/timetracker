import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Users, AlertCircle, Clock, Monitor, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';

interface User {
  id: string;
  full_name: string;
  role: 'employee' | 'manager' | 'admin';
  manager_id: string | null;
  email: string;
  time_entries_count: number;
  screenshots_count: number;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        // Get profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, role, manager_id, email')
          .order('full_name');

        if (profilesError) throw profilesError;

        // Get time entries count
        const { data: timeEntries, error: timeError } = await supabase
          .from('time_entries')
          .select('id, user_id');

        if (timeError) throw timeError;

        // Get screenshots count
        const { data: screenshots, error: screenshotsError } = await supabase
          .from('screenshots')
          .select('id, time_entry_id');

        if (screenshotsError) throw screenshotsError;

        // Process and combine the data
        const processedUsers = profiles?.map(user => {
          const userTimeEntries = timeEntries?.filter(entry => entry.user_id === user.id) || [];
          const userScreenshots = screenshots?.filter(screenshot => {
            const timeEntry = timeEntries?.find(entry => entry.id === screenshot.time_entry_id);
            return timeEntry?.user_id === user.id;
          }) || [];

          return {
            ...user,
            time_entries_count: userTimeEntries.length,
            screenshots_count: userScreenshots.length
          };
        }) || [];

        const managersData = processedUsers.filter(user => 
          user.role === 'manager' || user.role === 'admin'
        );
        
        setUsers(processedUsers);
        setManagers(managersData);
      } catch (error) {
        console.error('Error fetching users:', error);
        setError('Failed to load users. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole as User['role'] } : user
      ));

      if (newRole === 'manager' || newRole === 'admin') {
        const updatedUser = users.find(u => u.id === userId);
        if (updatedUser && !managers.find(m => m.id === userId)) {
          setManagers([...managers, { ...updatedUser, role: newRole as User['role'] }]);
        }
      } else {
        setManagers(managers.filter(m => m.id !== userId));
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      setError('Failed to update user role. Please try again.');
    }
  };

  const handleManagerChange = async (userId: string, newManagerId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ manager_id: newManagerId === 'none' ? null : newManagerId })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user =>
        user.id === userId ? { ...user, manager_id: newManagerId === 'none' ? null : newManagerId } : user
      ));
    } catch (error) {
      console.error('Error updating manager:', error);
      setError('Failed to update manager. Please try again.');
    }
  };

  const exportTimeReport = async () => {
    try {
      const { data: timeEntries, error } = await supabase
        .from('time_entries')
        .select('*, profiles(full_name)')
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Settings className="h-8 w-8 text-indigo-600" />
            <h2 className="ml-3 text-2xl font-bold text-gray-900">Admin Panel</h2>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={exportTimeReport}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Download className="h-4 w-4 mr-2" />
              Export All Reports
            </button>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
              {users.length} Users
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Manager
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activity
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.full_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.manager_id || 'none'}
                      onChange={(e) => handleManagerChange(user.id, e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                      disabled={user.role === 'admin'}
                    >
                      <option value="none">No Manager</option>
                      {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.full_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-4 w-4 mr-2" />
                        {user.time_entries_count} Time Entries
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Monitor className="h-4 w-4 mr-2" />
                        {user.screenshots_count} Screenshots
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}