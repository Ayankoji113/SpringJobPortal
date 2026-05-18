import api from './api';

export const getAllJobs = async () => {
    const response = await api.get('/jobs');
    return response.data;
};

export const getJobById = async (id) => {
    const response = await api.get(`/jobs/${id}`);
    return response.data;
};

export const searchJobs = async (keyword) => {
    const response = await api.get(`/jobs/keyword/${keyword}`);
    return response.data;
};

export const searchJobsAdvanced = async (params) => {
    const response = await api.get('/jobs/search', { params });
    return response.data;
};

export const getJobsPaginated = async (page = 0, size = 10) => {
    const response = await api.get('/jobs/paginated', { params: { page, size } });
    return response.data;
};

export const getFeaturedJobs = async () => {
    const response = await api.get('/jobs/featured');
    return response.data;
};

export const getMyJobs = async () => {
    const response = await api.get('/jobs/my');
    return response.data;
};

export const createJob = async (jobData) => {
    const response = await api.post('/jobs', jobData);
    return response.data;
};

export const updateJob = async (id, jobData) => {
    const response = await api.put(`/jobs/${id}`, jobData);
    return response.data;
};

export const deleteJob = async (id) => {
    const response = await api.delete(`/jobs/${id}`);
    return response.data;
};

// Applications
export const applyToJob = async (jobId, coverLetter) => {
    const response = await api.post(`/applications/job/${jobId}`, { coverLetter });
    return response.data;
};

export const getMyApplications = async () => {
    const response = await api.get('/applications/my');
    return response.data;
};

export const getApplicationsForJob = async (jobId) => {
    const response = await api.get(`/applications/job/${jobId}`);
    return response.data;
};

export const updateApplicationStatus = async (applicationId, status) => {
    const response = await api.patch(`/applications/${applicationId}/status`, { status });
    return response.data;
};

// Saved Jobs
export const saveJob = async (jobId) => {
    const response = await api.post(`/jobs/${jobId}/save`);
    return response.data;
};

export const unsaveJob = async (jobId) => {
    const response = await api.delete(`/jobs/${jobId}/save`);
    return response.data;
};

export const getSavedJobs = async () => {
    const response = await api.get('/jobs/saved');
    return response.data;
};

export const isJobSaved = async (jobId) => {
    const response = await api.get(`/jobs/${jobId}/is-saved`);
    return response.data.saved;
};
