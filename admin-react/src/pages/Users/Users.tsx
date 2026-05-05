import { useEffect, useState } from 'react';
import { Button, TextInput, Label } from '@primer/react';
import { SearchIcon, XIcon } from '@primer/octicons-react';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import { useToast } from '../../components/Toast/ToastContainer';
import ConfirmationDialog from '../QuizDetail/ConfirmationDialog';
import { environment } from '../../config/environment';
import { getAuthHeaders } from '../../utils/api-client';
import './Users.scss';

interface User {
  id: string;
  email: string;
  full_name: string;
  in_game_name?: string;
  is_banned: boolean;
  created_at: string;
}

const API_BASE_URL = environment.apiBaseUrl || 'http://localhost:3000';

export default function Users() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [bannedFilter, setBannedFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [banningUserId, setBanningUserId] = useState<string | null>(null);
  const [showBanConfirm, setShowBanConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm, bannedFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      if (bannedFilter !== 'all') {
        params.append('banned', bannedFilter);
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/users/list?${params.toString()}`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setTotalPages(data.totalPages || 1);
        setTotalUsers(data.total || 0);
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch users' }));
        addToast({
          type: 'error',
          title: 'Error',
          message: errorData.message || 'Failed to fetch users',
          duration: 5000,
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch users. Please try again.',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async (userId: string) => {
    try {
      setBanningUserId(userId);
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/ban`, {
        method: 'PUT',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        addToast({
          type: 'success',
          title: 'User Banned',
          message: data.message || 'User has been banned successfully',
          duration: 3000,
        });
        setShowBanConfirm(null);
        fetchUsers();
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to ban user' }));
        addToast({
          type: 'error',
          title: 'Error',
          message: errorData.message || 'Failed to ban user',
          duration: 5000,
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to ban user. Please try again.',
        duration: 5000,
      });
      setShowBanConfirm(null);
    } finally {
      setBanningUserId(null);
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      setBanningUserId(userId);
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/unban`, {
        method: 'PUT',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        addToast({
          type: 'success',
          title: 'User Unbanned',
          message: data.message || 'User has been unbanned successfully',
          duration: 3000,
        });
        fetchUsers();
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to unban user' }));
        addToast({
          type: 'error',
          title: 'Error',
          message: errorData.message || 'Failed to unban user',
          duration: 5000,
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to unban user. Please try again.',
        duration: 5000,
      });
    } finally {
      setBanningUserId(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers();
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  if (loading && users.length === 0) {
    return (
      <div className="users-page">
        <LoadingSpinner message="Loading users..." fullPage />
      </div>
    );
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1 className="page-title">Users</h1>
        <div className="page-stats">
          <span>Total: {totalUsers}</span>
        </div>
      </div>

      <div className="users-filters">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', flex: 1 }}>
          <TextInput
            type="text"
            placeholder="Search by email, name, or in-game name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leadingVisual={SearchIcon}
            style={{ flex: 1 }}
          />
          {searchTerm && (
            <Button
              variant="invisible"
              onClick={handleClearSearch}
              icon={XIcon}
              aria-label="Clear search"
            />
          )}
          <Button type="submit" variant="primary">
            Search
          </Button>
        </form>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Label>Filter:</Label>
          <Button
            variant={bannedFilter === 'all' ? 'primary' : 'default'}
            onClick={() => {
              setBannedFilter('all');
              setCurrentPage(1);
            }}
          >
            All
          </Button>
          <Button
            variant={bannedFilter === 'true' ? 'primary' : 'default'}
            onClick={() => {
              setBannedFilter('true');
              setCurrentPage(1);
            }}
          >
            Banned
          </Button>
          <Button
            variant={bannedFilter === 'false' ? 'primary' : 'default'}
            onClick={() => {
              setBannedFilter('false');
              setCurrentPage(1);
            }}
          >
            Active
          </Button>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">
          <p>No users found.</p>
        </div>
      ) : (
        <>
          <div className="users-table-container">
            <div className="users-table">
              <div className="users-table-header">
                <div className="users-table-cell">Email</div>
                <div className="users-table-cell">Full Name</div>
                <div className="users-table-cell">In-Game Name</div>
                <div className="users-table-cell">Status</div>
                <div className="users-table-cell">Created</div>
                <div className="users-table-cell">Actions</div>
              </div>
              <div className="users-table-body">
                {users.map((user) => (
                  <div key={user.id} className="users-table-row">
                    <div className="users-table-cell">{user.email}</div>
                    <div className="users-table-cell">{user.full_name || '-'}</div>
                    <div className="users-table-cell">{user.in_game_name || '-'}</div>
                    <div className="users-table-cell">
                      {user.is_banned ? (
                        <Label variant="danger">Banned</Label>
                      ) : (
                        <Label variant="success">Active</Label>
                      )}
                    </div>
                    <div className="users-table-cell">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                    <div className="users-table-cell">
                      {user.is_banned ? (
                        <Button
                          variant="default"
                          size="small"
                          onClick={() => handleUnban(user.id)}
                          disabled={banningUserId === user.id}
                        >
                          Unban
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => setShowBanConfirm(user.id)}
                          disabled={banningUserId === user.id}
                        >
                          Ban
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <Button
                variant="default"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="default"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmationDialog
        isOpen={showBanConfirm !== null}
        title="Ban User"
        message="Are you sure you want to ban this user? They will be logged out immediately."
        confirmText="Ban User"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          if (showBanConfirm) {
            handleBan(showBanConfirm);
          }
        }}
        onCancel={() => setShowBanConfirm(null)}
      />
    </div>
  );
}

