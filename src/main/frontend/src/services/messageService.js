import api from './api';

export const sendMessage = async (receiverId, content) => {
    const response = await api.post('/messages', { receiverId, content });
    return response.data;
};

export const getConversation = async (userId) => {
    const response = await api.get(`/messages/conversation/${userId}`);
    return response.data;
};

export const getConversationPartners = async () => {
    const response = await api.get('/messages/conversations');
    return response.data;
};

export const getUnreadMessageCount = async () => {
    const response = await api.get('/messages/unread-count');
    return response.data.count;
};

export const markMessagesAsRead = async (senderId) => {
    const response = await api.post(`/messages/read/${senderId}`);
    return response.data;
};

// Companies
export const createCompany = async (data) => {
    const response = await api.post('/companies', data);
    return response.data;
};

export const updateCompany = async (id, data) => {
    const response = await api.put(`/companies/${id}`, data);
    return response.data;
};

export const getMyCompanies = async () => {
    const response = await api.get('/companies/my');
    return response.data;
};

export const getCompanyById = async (id) => {
    const response = await api.get(`/companies/${id}`);
    return response.data;
};

export const getAllCompanies = async () => {
    const response = await api.get('/companies');
    return response.data;
};
