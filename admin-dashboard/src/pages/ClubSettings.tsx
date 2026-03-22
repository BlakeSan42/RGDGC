import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Settings,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Megaphone,
} from 'lucide-react';
import { clearCache, createAnnouncement } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

export default function ClubSettings() {
  const { isSuperAdmin } = useAuth();
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const clearCacheMutation = useMutation({
    mutationFn: clearCache,
    onSuccess: (data) => {
      setSuccessMsg(data.message || 'Cache cleared successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: () => {
      setErrorMsg('Failed to clear cache.');
      setTimeout(() => setErrorMsg(''), 3000);
    },
  });

  const announcementMutation = useMutation({
    mutationFn: () => createAnnouncement(announcementTitle, announcementBody),
    onSuccess: () => {
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setSuccessMsg('Announcement published.');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: () => {
      setErrorMsg('Failed to publish announcement.');
      setTimeout(() => setErrorMsg(''), 3000);
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Club configuration and system tools</p>
      </div>

      {/* Status messages */}
      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* Announcements */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="w-5 h-5 text-forest-900" />
          <h2 className="font-semibold text-gray-900">Club Announcement</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Publish an announcement visible to all club members.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              value={announcementTitle}
              onChange={(e) => setAnnouncementTitle(e.target.value)}
              className="input"
              placeholder="League update, course changes, etc."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={announcementBody}
              onChange={(e) => setAnnouncementBody(e.target.value)}
              className="input min-h-[100px] resize-y"
              placeholder="Write your announcement here..."
            />
          </div>
          <button
            onClick={() => announcementMutation.mutate()}
            disabled={!announcementTitle || !announcementBody || announcementMutation.isPending}
            className="btn-primary"
          >
            {announcementMutation.isPending ? 'Publishing...' : 'Publish Announcement'}
          </button>
        </div>
      </div>

      {/* System Tools */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-forest-900" />
          <h2 className="font-semibold text-gray-900">System Tools</h2>
        </div>

        <div className="space-y-4">
          {/* Cache */}
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="text-sm font-medium text-gray-900">Clear Redis Cache</p>
              <p className="text-xs text-gray-500">
                Force refresh of all cached data (leaderboards, stats, etc.)
              </p>
            </div>
            <button
              onClick={() => clearCacheMutation.mutate()}
              disabled={clearCacheMutation.isPending}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {clearCacheMutation.isPending ? 'Clearing...' : 'Clear Cache'}
            </button>
          </div>

          {/* Event Fee Config */}
          <div className="py-3 border-b">
            <p className="text-sm font-medium text-gray-900 mb-2">Default Event Fee</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">USD</label>
                <input type="number" min="0" step="0.01" defaultValue="5.00" className="input" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">$RGDG</label>
                <input type="number" min="0" defaultValue="50" className="input" />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Push Notifications</p>
              <p className="text-xs text-gray-500">
                Send event reminders and result notifications to players
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-forest-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-forest-900" />
            </label>
          </div>
        </div>
      </div>

      {/* Danger Zone (super admin only) */}
      {isSuperAdmin && (
        <div className="card border-red-200">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-red-700">Danger Zone</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Reset Season Data</p>
                <p className="text-xs text-gray-500">
                  Clear all standings and start a fresh season. This cannot be undone.
                </p>
              </div>
              <button className="btn-danger text-sm">Reset Season</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
