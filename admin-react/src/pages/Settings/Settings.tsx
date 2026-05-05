import { useEffect, useState } from 'react';
import { Button, FormControl, TextInput, Label, IconButton, Checkbox } from '@primer/react';
import { TrashIcon, ArrowUpIcon, ArrowDownIcon } from '@primer/octicons-react';
import { environment } from '../../config/environment';
import { authenticatedFetch } from '../../utils/api-client';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../components/EmptyState/EmptyState';
import ConfirmationDialog from '../QuizDetail/ConfirmationDialog';
import ToastContainer, { useToast } from '../../components/Toast/ToastContainer';
import './Settings.scss';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  isBuiltIn?: boolean;
}

interface Sponsor {
  name: string;
  order: number;
}

export default function Settings() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [showStream, setShowStream] = useState(false);
  const [prizePool, setPrizePool] = useState('');
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [newSponsorName, setNewSponsorName] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<string | null>(null);

  useEffect(() => {
    loadAdminUsers();
    loadPaymentConfig();
  }, []);

  const loadAdminUsers = async () => {
    setLoading(true);

    try {
      // Fetch admin users from backend
      const response = await authenticatedFetch(`${environment.apiBaseUrl}/api/admin/users`);
      
      if (!response.ok) {
        throw new Error(`Failed to load admin users: ${response.statusText}`);
      }

      const responseData = await response.json();
      const dbAdminUsers: AdminUser[] = (Array.isArray(responseData) ? responseData : []).map((user: any) => ({
        ...user,
        isBuiltIn: false
      }));

      // Add built-in allowed emails (from environment)
      const builtInEmails = environment.allowedAdminEmails || [];
      const builtInAdmins: AdminUser[] = builtInEmails.map(email => ({
        id: `built-in-${email}`,
        email: email,
        role: 'admin',
        created_at: new Date().toISOString(),
        isBuiltIn: true
      }));

      // Combine both lists, avoiding duplicates
      const allAdmins = [
        ...builtInAdmins,
        ...dbAdminUsers.filter(u => !builtInEmails.includes(u.email))
      ];

      // Sort by created_at (built-ins first, then by date)
      const sorted = allAdmins.sort((a, b) => {
        if (a.isBuiltIn && !b.isBuiltIn) return -1;
        if (!a.isBuiltIn && b.isBuiltIn) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setAdminUsers(sorted);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Failed to load admin users:', err);
    } finally {
      setLoading(false);
    }
  };

  const [addAdminError, setAddAdminError] = useState('');

  const addAdminUser = async () => {
    setAddAdminError('');
    
    if (!newAdminEmail || !newAdminEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setAddAdminError('Please enter a valid email address');
      return;
    }

    // Check if user is in built-in list
    if (environment.allowedAdminEmails.includes(newAdminEmail)) {
      setAddAdminError('This email is already a built-in admin.');
      return;
    }

    setLoading(true);

    try {
      // Invite admin user via backend
      const response = await authenticatedFetch(`${environment.apiBaseUrl}/api/admin/users/invite`, {
        method: 'POST',
        body: JSON.stringify({
          email: newAdminEmail,
          role: 'admin',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Failed to invite admin: ${response.statusText}`);
      }

      const result = await response.json();
      
      setNewAdminEmail('');
      setAddAdminError('');
      
      // Show success message (if available)
      if (result.message) {
        // You could show a success toast here
        console.log('Success:', result.message);
      }
      
      await loadAdminUsers();
    } catch (error: unknown) {
      const err = error as { message?: string };
      setAddAdminError('Failed to invite admin user: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const removeAdminUser = async (email: string) => {
    // Cannot delete built-in admins
    if (environment.allowedAdminEmails.includes(email)) {
      console.error('Cannot delete built-in admin');
      return;
    }

    setLoading(true);

    try {
      // Delete admin user via backend
      const response = await authenticatedFetch(`${environment.apiBaseUrl}/api/admin/users/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Failed to remove admin: ${response.statusText}`);
      }

      await loadAdminUsers();
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Failed to remove admin user:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentConfig = async () => {
    try {
      const response = await authenticatedFetch(`${environment.apiBaseUrl}/api/admin/settings/config`);
      
      if (response.ok) {
        const data = await response.json();
        setStreamUrl(data.streamUrl || '');
        setShowStream(data.showStream ?? false);
        setPrizePool(data.prizePool || '');
        setSponsors(data.sponsors || []);
      } else if (response.status === 404) {
        // Config doesn't exist yet, that's okay
        console.log('Config not found, using defaults');
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const handleAddSponsor = () => {
    if (!newSponsorName.trim()) return;
    
    const maxOrder = sponsors.length > 0 
      ? Math.max(...sponsors.map(s => s.order)) 
      : 0;
    
    const newSponsor: Sponsor = {
      name: newSponsorName.trim(),
      order: maxOrder + 1,
    };
    
    setSponsors([...sponsors, newSponsor]);
    setNewSponsorName('');
  };

  const handleRemoveSponsor = (index: number) => {
    const sorted = [...sponsors].sort((a, b) => a.order - b.order);
    const updated = sorted.filter((_, i) => i !== index);
    // Reorder remaining sponsors
    const reordered = updated.map((sponsor, i) => ({
      ...sponsor,
      order: i + 1,
    }));
    setSponsors(reordered);
  };

  const handleMoveSponsor = (index: number, direction: 'up' | 'down') => {
    const sorted = [...sponsors].sort((a, b) => a.order - b.order);
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sorted.length - 1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = sorted[index].order;
    sorted[index].order = sorted[newIndex].order;
    sorted[newIndex].order = temp;
    
    setSponsors(sorted);
  };

  const saveConfig = async () => {
    setConfigLoading(true);

    try {
      const config = {
        streamUrl: streamUrl.trim(),
        showStream: showStream,
        prizePool: prizePool.trim(),
        sponsors: sponsors,
      };

      console.log('[AdminSettings] Saving config:', config);
      console.log('[AdminSettings] Sponsors count:', sponsors.length);
      console.log('[AdminSettings] Sponsors data:', JSON.stringify(sponsors, null, 2));

      const response = await authenticatedFetch(`${environment.apiBaseUrl}/api/admin/settings/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      console.log('[AdminSettings] Save response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save configuration');
      }

      addToast({
        type: 'success',
        title: 'Configuration Saved',
        message: 'App configuration has been saved successfully.',
        duration: 4000,
      });
      
      // Reload config to get the saved data
      await loadPaymentConfig();
    } catch (error: unknown) {
      const err = error as { message?: string };
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Failed to save configuration. Please try again.',
        duration: 5000,
      });
    } finally {
      setConfigLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <h1 className="settings-title">Settings</h1>

      {/* Admin Users Section */}
      <section className="settings-section">
        <h2 className="section-title">Admin Users</h2>
        <p className="section-description">
          Manage admin access. Only invited admins can sign up and log in.
        </p>

        <div className="add-admin-section">
          <FormControl>
            <FormControl.Label htmlFor="new-admin-email">Email Address</FormControl.Label>
            <TextInput
              id="new-admin-email"
              type="email"
              value={newAdminEmail}
              onChange={(e) => {
                setNewAdminEmail(e.target.value);
                setAddAdminError('');
              }}
              placeholder="newadmin@example.com"
              block
              className="admin-email-input"
              style={{ maxWidth: '400px' }}
            />
            {addAdminError && (
              <FormControl.Validation variant="error">{addAdminError}</FormControl.Validation>
            )}
          </FormControl>
          <Button
            variant="primary"
            onClick={addAdminUser}
            disabled={!newAdminEmail || loading}
            className="add-admin-button"
          >
            Add Admin
          </Button>
        </div>

        <div className="admin-users-list">
          <h3 className="list-title">Current Admin Users</h3>
          {loading ? (
            <LoadingSpinner message="Loading admin users..." />
          ) : adminUsers.length === 0 ? (
            <EmptyState
              message="No admin users found. Add one above to get started."
            />
          ) : (
            <div className="admin-users-table">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Added On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.email}</td>
                      <td>
                        <Label variant="default">{user.role}</Label>
                        {user.isBuiltIn && (
                          <Label variant="default">Built-in</Label>
                        )}
                      </td>
                      <td>
                        {user.isBuiltIn ? (
                          <span className="built-in-text">Environment Config</span>
                        ) : (
                          new Date(user.created_at).toLocaleDateString()
                        )}
                      </td>
                      <td>
                        {!user.isBuiltIn && (
                          <>
                            <IconButton
                              icon={TrashIcon}
                              aria-label="Remove Admin"
                              onClick={() => setDeleteConfirmOpen(user.email)}
                              disabled={loading}
                              variant="danger"
                            />
                            {deleteConfirmOpen === user.email && (
                              <ConfirmationDialog
                                isOpen={true}
                                title="Remove Admin"
                                message={`Are you sure you want to remove ${user.email} as an admin?`}
                                confirmText="Remove"
                                cancelText="Cancel"
                                variant="danger"
                                onConfirm={async () => {
                                  await removeAdminUser(user.email);
                                  setDeleteConfirmOpen(null);
                                }}
                                onCancel={() => setDeleteConfirmOpen(null)}
                              />
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* App Configuration Section */}
      <section className="settings-section">
        <h2 className="section-title">App Configuration</h2>
        <p className="section-description">
          Configure stream URL and prize pool for the website.
        </p>

        <div className="payment-config-form">
          <FormControl>
            <FormControl.Label htmlFor="stream-url">Stream URL</FormControl.Label>
            <TextInput
              id="stream-url"
              type="url"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="https://example.com/stream"
              block
              className="config-input"
              style={{ maxWidth: '500px' }}
            />
            <FormControl.Caption>The YouTube stream URL (e.g., https://www.youtube.com/embed/VIDEO_ID or full YouTube URL)</FormControl.Caption>
          </FormControl>

          <FormControl>
            <FormControl.Label>
              <Checkbox
                checked={showStream}
                onChange={(e) => setShowStream(e.target.checked)}
              />
              <span style={{ marginLeft: '8px' }}>Show Live Stream on Home Page</span>
            </FormControl.Label>
            <FormControl.Caption>Enable this to display the YouTube stream embed above the hero section on the home page</FormControl.Caption>
          </FormControl>

          <FormControl>
            <FormControl.Label htmlFor="prize-pool">Prize Pool</FormControl.Label>
            <TextInput
              id="prize-pool"
              type="text"
              value={prizePool}
              onChange={(e) => setPrizePool(e.target.value)}
              placeholder="₹4,00,000+"
              block
              className="config-input"
              style={{ maxWidth: '500px' }}
            />
            <FormControl.Caption>The current prize pool amount displayed in the hero header (e.g., "₹4,00,000+")</FormControl.Caption>
          </FormControl>

          <Button
            variant="primary"
            onClick={saveConfig}
            disabled={configLoading}
            className="save-config-button"
          >
            {configLoading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </section>

      {/* Sponsors Section */}
      <section className="settings-section">
        <h2 className="section-title">Sponsors</h2>
        <p className="section-description">
          Manage sponsors for SUB WARS. Sponsors will be displayed on the home page and sponsors page.
        </p>

        <div className="sponsors-form">
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <TextInput
              type="text"
              value={newSponsorName}
              onChange={(e) => setNewSponsorName(e.target.value)}
              placeholder="Sponsor name"
              style={{ flexGrow: 1, maxWidth: '400px' }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddSponsor();
                }
              }}
            />
            <Button onClick={handleAddSponsor} disabled={!newSponsorName.trim()}>
              Add Sponsor
            </Button>
          </div>

          {sponsors.length > 0 && (
            <div className="sponsors-list">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Order</th>
                    <th style={{ textAlign: 'left' }}>Name</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sponsors.sort((a, b) => a.order - b.order).map((sponsor, index) => (
                    <tr key={index}>
                      <td>{sponsor.order}</td>
                      <td>{sponsor.name}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                          <IconButton
                            icon={ArrowUpIcon}
                            aria-label="Move Up"
                            onClick={() => handleMoveSponsor(index, 'up')}
                            disabled={index === 0}
                            variant="invisible"
                          />
                          <IconButton
                            icon={ArrowDownIcon}
                            aria-label="Move Down"
                            onClick={() => handleMoveSponsor(index, 'down')}
                            disabled={index === sponsors.length - 1}
                            variant="invisible"
                          />
                          <IconButton
                            icon={TrashIcon}
                            aria-label="Remove Sponsor"
                            onClick={() => handleRemoveSponsor(index)}
                            variant="danger"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sponsors.length === 0 && (
            <EmptyState message="No sponsors added yet. Add one above to get started." />
          )}

          <Button
            variant="primary"
            onClick={saveConfig}
            disabled={configLoading}
            className="save-config-button"
            style={{ marginTop: '20px' }}
          >
            {configLoading ? 'Saving...' : 'Save Sponsors'}
          </Button>
        </div>
      </section>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
