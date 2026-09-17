import React, { useState } from "react";
import { addCleaner } from "../lib/api";

export default function AddCleanerForm({ onAdded }) {
    const [form, setForm] = useState({
        name: "",
        surname: "",
        pricePerHour: ""
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = e => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async e => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            await addCleaner({
                name: form.name,
                surname: form.surname,
                pricePerHour: parseFloat(form.pricePerHour)
            });
            setForm({ name: "", surname: "", pricePerHour: "" });
            if (onAdded) onAdded();
        } catch (err) {
            setError("Failed to add cleaner");
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>Add Cleaner</h2>

            <input
                name="name"
                placeholder="Name"
                value={form.name}
                onChange={handleChange}
                required
            />
            <input
                name="surname"
                placeholder="Surname"
                value={form.surname}
                onChange={handleChange}
                required
            />
            <input
                name="pricePerHour"
                type="number"
                step="0.01"
                placeholder="Price per hour"
                value={form.pricePerHour}
                onChange={handleChange}
                required
            />

            <button type="submit" disabled={submitting}>
                {submitting ? "Adding..." : "Add Cleaner"}
            </button>

            {error && <p style={{ color: "red" }}>{error}</p>}
        </form>
    );
}
