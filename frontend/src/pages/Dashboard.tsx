import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/Button'
import { listVmRequests } from '../api/vm-requests'

interface RequestCounts {
  pending: number
  approved: number
  total: number
}

export function Dashboard() {
  const { user } = useAuth()
  const [counts, setCounts] = useState<RequestCounts>({ pending: 0, approved: 0, total: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadCounts()
  }, [])

  const loadCounts = async () => {
    try {
      const [pendingRes, approvedRes, allRes] = await Promise.all([
        listVmRequests({ status: 'pending' }),
        listVmRequests({ status: 'approved' }),
        listVmRequests({}),
      ])
      setCounts({
        pending: pendingRes.total,
        approved: approvedRes.total,
        total: allRes.total,
      })
    } catch {
      // Ignore errors, counts will just show 0
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Layout>
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome, {user?.full_name}!
        </h2>
        <p className="text-gray-600 mb-6">
          You are logged in as <span className="font-medium">{user?.role}</span>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to="/requests?status=pending" className="block">
            <div className="bg-yellow-50 rounded-lg p-6 hover:bg-yellow-100 transition-colors">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                Pending Requests
              </h3>
              <p className="text-yellow-700 text-sm">
                {user?.role === 'requester'
                  ? 'Your requests awaiting approval.'
                  : 'Requests awaiting review.'}
              </p>
              <p className="mt-4 text-3xl font-bold text-yellow-900">
                {isLoading ? '...' : counts.pending}
              </p>
              <p className="text-sm text-yellow-600">pending requests</p>
            </div>
          </Link>

          <Link to="/requests?status=approved" className="block">
            <div className="bg-green-50 rounded-lg p-6 hover:bg-green-100 transition-colors">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Approved
              </h3>
              <p className="text-green-700 text-sm">
                Approved requests ready for provisioning.
              </p>
              <p className="mt-4 text-3xl font-bold text-green-900">
                {isLoading ? '...' : counts.approved}
              </p>
              <p className="text-sm text-green-600">approved VMs</p>
            </div>
          </Link>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <Link to="/requests/new">
                <Button className="w-full">Request New VM</Button>
              </Link>
              <Link to="/requests" className="block">
                <Button variant="secondary" className="w-full">
                  View All Requests ({isLoading ? '...' : counts.total})
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
