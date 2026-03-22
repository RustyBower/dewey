import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { Lock, User, Check, AlertCircle } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const changePassword = useMutation({
    mutationFn: async () => {
      await client.post('/users/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
    },
    onSuccess: () => {
      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: () => {
      setPasswordMsg({ type: 'error', text: 'Failed. Check your current password.' });
    },
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      await client.patch('/users/me', { display_name: displayName, email });
    },
    onSuccess: () => {
      setProfileMsg({ type: 'success', text: 'Profile updated.' });
    },
    onError: () => {
      setProfileMsg({ type: 'error', text: 'Failed to update profile.' });
    },
  });

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    changePassword.mutate();
  }

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    updateProfile.mutate();
  }

  const inputClass =
    'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500';

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h1>

      {/* Profile */}
      <form onSubmit={handleProfileSubmit} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium">
          <User size={18} />
          Profile
        </div>

        {profileMsg && (
          <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${profileMsg.type === 'success' ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>
            {profileMsg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            {profileMsg.text}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Display Name</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>

        <button type="submit" disabled={updateProfile.isPending} className="rounded-md bg-rose-600 hover:bg-rose-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors">
          {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      {/* Change Password */}
      <form onSubmit={handlePasswordSubmit} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium">
          <Lock size={18} />
          Change Password
        </div>

        {passwordMsg && (
          <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${passwordMsg.type === 'success' ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>
            {passwordMsg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            {passwordMsg.text}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Current Password</label>
          <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">New Password</label>
          <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Confirm New Password</label>
          <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
        </div>

        <button type="submit" disabled={changePassword.isPending} className="rounded-md bg-rose-600 hover:bg-rose-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors">
          {changePassword.isPending ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
