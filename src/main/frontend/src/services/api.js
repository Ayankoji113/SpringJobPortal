import axios from 'axios';

/* Base URL comes from the environment so a deploy does not need a code change.
   Vite inlines VITE_* at build time; the fallback keeps local dev zero-config. */
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/** Turns any axios failure into a sentence worth showing a person. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
    if (!error) return fallback;
    if (error.code === 'ERR_NETWORK') return 'Cannot reach the server. Is the backend running?';
    const data = error.response?.data;
    return data?.message || data?.error || (typeof data === 'string' && data) || error.message || fallback;
}

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const hadToken = Boolean(localStorage.getItem('token'));

        /* Only a 401 on a request we actually authenticated is a dead session.
           A 401 from a login attempt is a wrong password and belongs to the form,
           not to a global logout — the previous version wiped storage and did a
           full page redirect for both, so any single failed call logged the user
           out and lost wherever they were. */
        if (status === 401 && hadToken) {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            window.dispatchEvent(new CustomEvent('jp:session-expired'));
        }

        return Promise.reject(error);
    },
);

export default api;
