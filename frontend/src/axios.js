import axios from "axios";

// Create an axios instance
const instance = axios.create({
    baseURL: "http://localhost:8080/api", // or wherever your backend is
});

// Add token to all requests automatically
instance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default instance;