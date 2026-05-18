import api from './api';

export const getAdminStats = async () => {
    const response = await api.get('/admin/stats');
    return response.data;
};

export const getAllUsers = async () => {
    const response = await api.get('/admin/users');
    return response.data;
};

export const searchUsers = async (keyword) => {
    const response = await api.get('/admin/users/search', { params: { keyword } });
    return response.data;
};

export const banUser = async (id) => {
    const response = await api.patch(`/admin/users/${id}/ban`);
    return response.data;
};

export const unbanUser = async (id) => {
    const response = await api.patch(`/admin/users/${id}/unban`);
    return response.data;
};

export const deleteUser = async (id) => {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
};

export const getPendingJobs = async () => {
    const response = await api.get('/admin/jobs/pending');
    return response.data;
};

export const approveJob = async (id) => {
    const response = await api.patch(`/admin/jobs/${id}/approve`);
    return response.data;
};

export const rejectJob = async (id) => {
    const response = await api.patch(`/admin/jobs/${id}/reject`);
    return response.data;
};

export const getEmployerDashboard = async () => {
    const response = await api.get('/dashboard/employer');
    return response.data;
};
