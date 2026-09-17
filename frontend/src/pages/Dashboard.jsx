import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
    const nav = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    // redirect to /login if there is no JWT
    useEffect(() => {
        if (!localStorage.getItem("jwt")) {
            nav("/login");
        }
    }, [nav]);

    useEffect(() => {
        api.get("/api/cleaning")        // your secured endpoint
            .then((res) => setRequests(res.data))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <p>Loading…</p>;

    return (
        <>
            <h1>Cleaning Requests</h1>
            <ul>
                {requests.map((r) => (
                    <li key={r.id}>{r.customerName} — {r.status}</li>
                ))}
            </ul>
            <button onClick={() => { localStorage.removeItem("jwt"); nav("/login"); }}>
                Log out
            </button>
        </>
    );
}