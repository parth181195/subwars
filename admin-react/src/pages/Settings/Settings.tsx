import { useEffect, useState } from 'react';
import { Button } from '@primer/react';
import { TrashIcon } from '@primer/octicons-react';
import { adminAuthService } from '../../services/auth';
import { environment } from '../../config/environment';
import './Settings.scss';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  isBuiltIn?: boolean;
}

export default function Settings() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [upiId, setUpiId] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  useEffect(() => {
    loadAdminUsers();
    loadPaymentConfig();
  }, []);

  const loadAdminUsers = async () => {
    setLoading(true);
    const client = adminAuthService.supabaseClient;

    if (!client) {
      setLoading(false);
      return;
    }

    try {
      // Fetch admin users from database
      const { data, error } = await client
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const dbAdminUsers: AdminUser[] = (data || []).map(user => ({
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

  const addAdminUser = async () => {
    if (!newAdminEmail || !newAdminEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      alert('Please enter a valid email address');
      return;
    }

    const client = adminAuthService.supabaseClient;
    if (!client) {
      alert('Database connection not available');
      return;
    }

    // Check if user is in built-in list
    if (environment.allowedAdminEmails.includes(newAdminEmail)) {
      alert('This email is already a built-in admin.');
      return;
    }

    setLoading(true);

    try {
      // Check if user already exists in DB
      const { data: existingDbUser, error: checkError } = await client
        .from('admin_users')
        .select('id')
        .eq('email', newAdminEmail)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is okay
        throw checkError;
      }

      if (existingDbUser) {
        alert('This email is already an admin in the database.');
        setLoading(false);
        return;
      }

      // Add new admin user
      const { error } = await client
        .from('admin_users')
        .insert({
          email: newAdminEmail,
          role: 'admin',
          password_hash: '', // Password will be set via Supabase Auth
        });

      if (error) {
        throw error;
      }

      setNewAdminEmail('');
      await loadAdminUsers();
    } catch (error: unknown) {
      const err = error as { message?: string };
      alert('Failed to add admin user: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const removeAdminUser = async (email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} as an admin?`)) {
      return;
    }

    const client = adminAuthService.supabaseClient;
    if (!client) {
      alert('Database connection not available');
      return;
    }

    setLoading(true);

    try {
      const { error } = await client
        .from('admin_users')
        .delete()
        .eq('email', email);

      if (error) {
        throw error;
      }

      await loadAdminUsers();
    } catch (error: unknown) {
      const err = error as { message?: string };
      alert('Failed to remove admin user: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentConfig = async () => {
    const client = adminAuthService.supabaseClient;
    if (!client) return;

    try {
      // Fetch payment config from a settings/config table
      // For now, we'll check if there's a config table or use a simple key-value store
      const { data, error } = await client
        .from('app_config')
        .select('*')
        .eq('key', 'payment_config')
        .single();

      if (!error && data?.value) {
        const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        setStreamUrl(config.streamUrl || '');
        setUpiId(config.upiId || '');
      }
    } catch (error) {
      console.error('Failed to load payment config:', error);
      // Config table might not exist yet, that's okay
    }
  };

  const savePaymentConfig = async () => {
    setPaymentError('');
    setPaymentSuccess('');
    setPaymentLoading(true);

    const client = adminAuthService.supabaseClient;
    if (!client) {
      setPaymentError('Database connection not available');
      setPaymentLoading(false);
      return;
    }

    try {
      const config = {
        streamUrl: streamUrl.trim(),
        upiId: upiId.trim(),
      };

      // Upsert payment config
      const { error } = await client
        .from('app_config')
        .upsert({
          key: 'payment_config',
          value: config,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key'
        });

      if (error) {
        throw error;
      }

      setPaymentSuccess('Payment configuration saved successfully!');
      setTimeout(() => setPaymentSuccess(''), 3000);
    } catch (error: unknown) {
      const err = error as { message?: string };
      setPaymentError('Failed to save payment configuration: ' + (err.message || 'Unknown error'));
    } finally {
      setPaymentLoading(false);
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
          <div className="admin-input-group">
            <label htmlFor="new-admin-email">Email Address</label>
            <input
              id="new-admin-email"
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="newadmin@example.com"
              className="admin-email-input"
            />
          </div>
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
            <div className="loading-container">
              <p>Loading admin users...</p>
            </div>
          ) : adminUsers.length === 0 ? (
            <div className="empty-state">
              <p>No admin users found. Add one above to get started.</p>
            </div>
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
                        <span className="role-badge">{user.role}</span>
                        {user.isBuiltIn && (
                          <span className="built-in-badge">Built-in</span>
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
                          <button
                            className="delete-button"
                            onClick={() => removeAdminUser(user.email)}
                            disabled={loading}
                            title="Remove Admin"
                          >
                            <TrashIcon size={16} />
                          </button>
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

      {/* Payment Configuration Section */}
      <section className="settings-section">
        <h2 className="section-title">Payment Configuration</h2>
        <p className="section-description">
          Configure stream URL and UPI ID for payment QR codes.
        </p>

        {paymentError && (
          <div className="error-message">
            {paymentError}
          </div>
        )}

        {paymentSuccess && (
          <div className="success-message">
            {paymentSuccess}
          </div>
        )}

        <div className="payment-config-form">
          <div className="config-input-group">
            <label htmlFor="stream-url">Stream URL</label>
            <input
              id="stream-url"
              type="url"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="https://example.com/stream"
              className="config-input"
            />
            <p className="input-help">The stream URL that will be displayed in payment QR codes</p>
          </div>

          <div className="config-input-group">
            <label htmlFor="upi-id">UPI ID</label>
            <input
              id="upi-id"
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@upi"
              className="config-input"
            />
            <p className="input-help">Your UPI ID for receiving payments</p>
          </div>

          <Button
            variant="primary"
            onClick={savePaymentConfig}
            disabled={paymentLoading}
            className="save-config-button"
          >
            {paymentLoading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </section>
    </div>
  );
}

