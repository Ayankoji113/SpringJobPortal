import api from './api';

export const getMatchScore = async (jobId) => {
    const response = await api.get(`/ai/match-score/${jobId}`);
    return response.data;
};

export const getSalaryEstimate = async (jobId) => {
    const response = await api.get(`/ai/salary-estimate/${jobId}`);
    return response.data;
};

export const getRecommendedJobs = async (threshold = 50) => {
    const response = await api.get('/ai/recommended-jobs', { params: { threshold } });
    return response.data;
};

export const autoApply = async (threshold = 70) => {
    const response = await api.post('/ai/auto-apply', null, { params: { threshold } });
    return response.data;
};
