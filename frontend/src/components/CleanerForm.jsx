import { useState } from "react";

export default function CleanerForm({ onSubmit, initialData, setPhotoFile }) {
    const [name, setName] = useState(initialData?.name ?? "");
    const [surname, setSurname] = useState(initialData?.surname ?? "");
    const [price, setPrice] = useState(initialData?.pricePerHour ?? "");

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ name, surname, pricePerHour: parseFloat(price) });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto p-4">
            <input
                type="text"
                className="w-full border p-2"
                placeholder="Name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
            />
            <input
                type="text"
                className="w-full border p-2"
                placeholder="Surname"
                value={surname}
                onChange={e => setSurname(e.target.value)}
                required
            />
            <input
                type="number"
                className="w-full border p-2"
                placeholder="Price Per Hour"
                value={price}
                onChange={e => setPrice(e.target.value)}
                step="0.01"
                required
            />
            <input
                type="file"
                accept="image/*"
                onChange={e => setPhotoFile(e.target.files[0])}
            />
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
                Submit
            </button>
        </form>
    );
}
