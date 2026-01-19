import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { API_BASE } from '../apiConfig';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Interface for email data
interface EmailData {
  id: number;
  company: string;
  purpose: string;
  tone: string;
  status: string;
  created_at: string;
}

// Interface for analytics data
interface AnalyticsData {
  total_sent: number;
  total_replied: number;
  total_bounced: number;
  reply_rate: number;
  most_popular_tone: string;
  top_purpose: string;
  recent_emails: EmailData[];
}

export default function Dashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(`${API_BASE}/api/analytics`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setAnalyticsData(data.data);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to fetch analytics data');
      }
    } catch (err: any) {
      console.error('Error fetching analytics data:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Update email status
  const updateEmailStatus = async (emailId: number, newStatus: string) => {
    try {
      setUpdatingStatus(emailId);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(`${API_BASE}/api/emails/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          emailId: emailId,
          status: newStatus,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update the local state
        setAnalyticsData(prevData => {
          if (!prevData) return null;
          
          return {
            ...prevData,
            recent_emails: prevData.recent_emails.map(email =>
              email.id === emailId ? { ...email, status: newStatus } : email
            ),
          };
        });
        
        // Show success message
        setToastMessage('Status updated successfully!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        
        // Refresh analytics data to get updated counts
        await fetchAnalyticsData();
      } else {
        throw new Error(data.error || 'Failed to update status');
      }
    } catch (err: any) {
      console.error('Error updating email status:', err);
      setToastMessage('Failed to update status. Please try again.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'replied':
        return 'bg-green-100 text-green-800';
      case 'bounced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Prepare chart data
  const getChartData = () => {
    if (!analyticsData) return [];
    
    return [
      { name: 'Sent', value: analyticsData.total_sent, fill: '#3B82F6' },
      { name: 'Replied', value: analyticsData.total_replied, fill: '#10B981' },
      { name: 'Bounced', value: analyticsData.total_bounced, fill: '#EF4444' },
    ];
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-primary-700 font-semibold">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchAnalyticsData();
            }}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {toastMessage.includes('successfully') ? (
                <div className="text-green-400">✓</div>
              ) : (
                <div className="text-red-400">✗</div>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-900">{toastMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gradient">Email Dashboard</h1>
          <p className="text-gray-600 mt-2">Track your email campaign performance and engagement</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {/* Total Sent */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-blue-600 text-xl">📧</span>
              </div>
              <div className="ml-4">
                <p className="text-gray-600 text-sm font-medium">Total Sent</p>
                <p className="text-2xl font-bold text-gray-900">{analyticsData?.total_sent || 0}</p>
              </div>
            </div>
          </div>

          {/* Total Replied */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-green-600 text-xl">✅</span>
              </div>
              <div className="ml-4">
                <p className="text-gray-600 text-sm font-medium">Total Replied</p>
                <p className="text-2xl font-bold text-gray-900">{analyticsData?.total_replied || 0}</p>
              </div>
            </div>
          </div>

          {/* Reply Rate */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <span className="text-purple-600 text-xl">📈</span>
              </div>
              <div className="ml-4">
                <p className="text-gray-600 text-sm font-medium">Reply Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData?.reply_rate ? `${analyticsData.reply_rate}%` : '0%'}
                </p>
              </div>
            </div>
          </div>

          {/* Most Popular Tone */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <span className="text-orange-600 text-xl">🎭</span>
              </div>
              <div className="ml-4">
                <p className="text-gray-600 text-sm font-medium">Most Popular Tone</p>
                <p className="text-lg font-bold text-gray-900 capitalize">
                  {analyticsData?.most_popular_tone || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Top Purpose */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-teal-500">
            <div className="flex items-center">
              <div className="p-2 bg-teal-100 rounded-lg">
                <span className="text-teal-600 text-xl">🎯</span>
              </div>
              <div className="ml-4">
                <p className="text-gray-600 text-sm font-medium">Top Purpose</p>
                <p className="text-lg font-bold text-gray-900 capitalize">
                  {analyticsData?.top_purpose || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Email Status Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Email Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Performance Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Performance Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Emails</span>
                <span className="font-semibold">{analyticsData?.total_sent || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Success Rate</span>
                <span className="font-semibold text-green-600">
                  {analyticsData?.reply_rate ? `${analyticsData.reply_rate}%` : '0%'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Bounce Rate</span>
                <span className="font-semibold text-red-600">
                  {analyticsData?.total_sent 
                    ? `${Math.round((analyticsData.total_bounced / analyticsData.total_sent) * 100)}%`
                    : '0%'
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Most Popular Tone</span>
                <span className="font-semibold capitalize">{analyticsData?.most_popular_tone || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Top Purpose</span>
                <span className="font-semibold capitalize">{analyticsData?.top_purpose || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Emails Table */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">Recent Emails</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purpose
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analyticsData?.recent_emails?.length ? (
                  analyticsData.recent_emails.map((email) => (
                    <tr key={email.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {email.company}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {email.purpose}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {email.tone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(email.status)}`}>
                          {email.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(email.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {email.status.toLowerCase() !== 'replied' && (
                            <button
                              onClick={() => updateEmailStatus(email.id, 'replied')}
                              disabled={updatingStatus === email.id}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            >
                              {updatingStatus === email.id ? '...' : 'Mark Replied'}
                            </button>
                          )}
                          {email.status.toLowerCase() !== 'bounced' && (
                            <button
                              onClick={() => updateEmailStatus(email.id, 'bounced')}
                              disabled={updatingStatus === email.id}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              {updatingStatus === email.id ? '...' : 'Mark Bounced'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No emails found. Start generating some emails!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
