import axios from 'axios';

// Use env variable for production, fallback to /api for dev (Vite proxy)
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  withCredentials: true, // Ensure server CORS allows credentials from the client domain
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;
