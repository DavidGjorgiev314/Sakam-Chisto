import axios from "axios";
import { API_BASE } from "./apiBase";

export const api = axios.create({
    baseURL: API_BASE,
});

api.interceptors.request.use((cfg) => {
    const jwt = localStorage.getItem("jwt");
    if (jwt) cfg.headers.Authorization = `Bearer ${jwt}`;
    return cfg;
});
