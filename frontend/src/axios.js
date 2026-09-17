import axios from "axios";
import { API_BASE } from "./lib/apiBase";

const instance = axios.create({
    baseURL: `${API_BASE}/api`,
});

instance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default instance;
