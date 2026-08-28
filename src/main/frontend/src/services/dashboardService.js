import api from './api';

export const getEmployerDashboard = async () => {
    const response = await api.get('/dashboard/employer');
    return response.data;
};
