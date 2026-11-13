import api from './api';

export const getEmployerDashboard = async () => {
    const response = await api.get('/dashboard/employer');
    return response.data;
};

/** The companies the signed-in employer owns; a posting can be listed under one of them. */
export const getMyCompanies = async () => {
    const response = await api.get('/companies/my');
    return response.data;
};

/** The applicant's resume as a Blob. The endpoint needs the auth header, so a plain link cannot open it. */
export const getApplicantResume = async (applicationId) => {
    const response = await api.get(`/applications/${applicationId}/resume`, { responseType: 'blob' });
    return response.data;
};
