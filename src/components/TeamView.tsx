import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Users, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface TeamMember {
  id: string;
  full_name: string;
  current_status: 'online' | 'offline';
  latest_activity?: string;
}

export default function TeamView() {
  const user = useStore((state) => state.user);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeamMembers() {
      try {
        const { data: members, error: membersError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('manager_id', user?.id);

        if (membersError) throw membersError;

        const membersWithStatus = await Promise.all(
          (members || []).map(async (member) => {
            const { data: latestEntry } = await supabase
              .from('time_entries')
              .select('*')
              .eq('user_id', member.id)
              .order('start_time', { ascending: false })
              .limit(1)
              .single();

            return {
              ...member,
              current_status: latestEntry && !latestEntry.end_time ? 'online' : 'offline',
              latest_activity: latestEntry?.start_time,
            };
          })
        );

        setTeamMembers(membersWithStatus);
      } catch (error) {
        console.error('Error fetching team members:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTeamMembers();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-indigo-600" />
            <h2 className="ml-3 text-2xl font-bold text-gray-900">Team Overview</h2>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
            {teamMembers.length} Team Members
          </span>
        </div>

        {loading ? (
          <div className="text-center text-gray-500">Loading team data...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamMembers.map((member) => (
              <div key={member.id} className="bg-white border rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">{member.full_name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    member.current_status === 'online' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {member.current_status === 'online' ? 'Currently Working' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="h-4 w-4 mr-2" />
                  {member.latest_activity ? (
                    <span>Last active: {format(parseISO(member.latest_activity), 'PPp')}</span>
                  ) : (
                    <span>No recent activity</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}