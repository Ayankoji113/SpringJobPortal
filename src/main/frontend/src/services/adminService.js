import api from './api';

/** Page<JobResponse>, oldest first. */
export const getPendingJobs = async (page = 0, size = 20) => {
    const response = await api.get('/admin/jobs/pending', { params: { page, size } });
    return response.data;
};

/** { pendingReview } */
export const getStats = async () => {
    const response = await api.get('/admin/stats');
    return response.data;
};

/** status: PUBLISHED | REJECTED | SUSPENDED. A reason is required for anything but PUBLISHED. */
export const decide = async (postId, status, reason) => {
    const response = await api.post(`/admin/jobs/${postId}/decision`, { status, reason });
    return response.data;
};

/** Only a published posting can be featured. */
export const setFeatured = async (postId, featured) => {
    const response = await api.patch(`/admin/jobs/${postId}/featured`, { featured });
    return response.data;
};

export const setBanned = async (userId, banned, reason) => {
    const response = await api.patch(`/admin/users/${userId}/banned`, { banned, reason });
    return response.data;
};

/** Page<AdminActionResponse>, newest first. */
export const getActions = async (page = 0, size = 50) => {
    const response = await api.get('/admin/actions', { params: { page, size } });
    return response.data;
};
