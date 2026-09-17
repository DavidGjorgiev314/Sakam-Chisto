import axios from "axios";

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE || "http://localhost:8080",
});

// attach JWT automatically
api.interceptors.request.use((cfg) => {
    const jwt = localStorage.getItem("jwt");
    if (jwt) cfg.headers.Authorization = `Bearer ${jwt}`;
    return cfg;
});
