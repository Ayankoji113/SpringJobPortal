import api from './api';

export const getCurrentProfile = async () => {
    const response = await api.get('/users/me');
    return response.data;
};

export const getUserById = async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
};

export const updateProfile = async (data) => {
    const response = await api.put('/users/me', data);
    return response.data;
};

export const uploadProfilePhoto = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/users/me/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const uploadResume = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/users/me/resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const toggleVisibility = async (isPublic) => {
    const response = await api.patch('/users/me/visibility', { isPublic });
    return response.data;
};
