import api from './api';

export const getNotifications = async () => {
    const response = await api.get('/notifications');
    return response.data;
};

export const getUnreadNotifications = async () => {
    const response = await api.get('/notifications/unread');
    return response.data;
};

export const getUnreadCount = async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data.count;
};

export const markAsRead = async (id) => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
};

export const markAllAsRead = async () => {
    const response = await api.post('/notifications/mark-all-read');
    return response.data;
};

export const deleteNotification = async (id) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
};
