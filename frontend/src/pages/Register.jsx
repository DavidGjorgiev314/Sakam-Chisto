import { useState } from "react";
import axios from "axios";

export default function Register() {
    const [form, setForm] = useState({ username: "", password: "" });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post("http://localhost:8080/api/auth/register", form);
            alert("Registration successful");
        } catch (err) {
            alert("Registration failed");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md mx-auto mt-20">
            <input
                type="text"
                placeholder="Username"
                className="border p-2"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <input
                type="password"
                placeholder="Password"
                className="border p-2"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button type="submit" className="bg-green-600 text-white p-2">Register</button>
        </form>
    );
}