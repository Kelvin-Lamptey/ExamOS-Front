import { QueryClient, queryOptions, useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../api/client'
import type { Session } from '../api/contracts'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, networkMode: 'always', refetchOnWindowFocus: false, staleTime: 3000 },
    mutations: { retry: false, networkMode: 'always' },
  },
})

export function replaceSession(session: Session | null) {
  // Retain active session/health observers while removing the previous student's data.
  queryClient.removeQueries({ predicate: query => !['session', 'health'].includes(String(query.queryKey[0])) })
  queryClient.setQueryData(['session'], session)
}

export const sessionOptions = queryOptions({
  queryKey: ['session'],
  queryFn: async () => {
    try { return await api.session() }
    catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error }
  },
  staleTime: Infinity,
})

export const examOptions = (id: string) => queryOptions({ queryKey: ['exam', id], queryFn: () => api.exam(id), staleTime: 0 })
export const examsOptions = queryOptions({ queryKey: ['exams'], queryFn: api.exams })
export function useSystemStatus() {
  return useQuery({ queryKey: ['system-status'], queryFn: api.systemStatus, refetchInterval: 3000, refetchIntervalInBackground: true })
}
