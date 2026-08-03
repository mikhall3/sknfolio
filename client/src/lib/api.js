export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, options = {}) {
  const url = `/api${path}`
  let res
  try {
    res = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    })
  } catch (networkErr) {
    console.error('[api] network-level failure calling', options.method || 'GET', url, networkErr)
    throw networkErr
  }

  if (res.status === 204) return null

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json().catch(() => null) : null

  if (!res.ok) {
    console.error('[api]', options.method || 'GET', url, '->', res.status, body)
    throw new ApiError(body?.error || res.statusText || 'Request failed.', res.status)
  }
  return body
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
}
