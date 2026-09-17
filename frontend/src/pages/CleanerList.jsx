import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import jwtDecode from "jwt-decode";  // Changed this line

export default function CleanerList() {
    const [cleaners, setCleaners] = useState([]);
    const [selectedCleaner, setSelectedCleaner] = useState(null);
    const navigate = useNavigate();
    const defaultImage =
        "https://st4.depositphotos.com/14953852/24787/v/450/depositphotos_247872612-stock-illustration-no-image-available-icon-vector.jpg";

    const isAdmin = () => {
        const token = localStorage.getItem("token");
        if (!token) return false;
        try {
            const decoded = jwtDecode(token);  // Changed this line
            return decoded.role === "ADMIN";
        } catch (error) {
            console.error("Error decoding token:", error);
            return false;
        }
    };

    useEffect(() => {
        fetch("http://localhost:8080/cleaners")
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch cleaners");
                return res.json();
            })
            .then(setCleaners)
            .catch(console.error);
    }, []);

    const removeCleaner = async (id) => {
        if (!isAdmin()) {
            alert("Unauthorized action");
            return;
        }

        if (!window.confirm("Delete this cleaner?")) return;

        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`http://localhost:8080/cleaners/delete/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                setCleaners((prev) => prev.filter((c) => c.id !== id));
            } else {
                alert("Failed to delete cleaner");
            }
        } catch (error) {
            console.error("Error removing cleaner:", error);
        }
    };

    return (
        <div
            className="min-h-screen bg-cover bg-center px-4 py-10"
            style={{ backgroundImage: "url('/images/index.jpg')" }}
        >
            <div className="bg-white bg-opacity-80 p-6 rounded-lg max-w-6xl mx-auto shadow-md">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">Cleaners</h1>
                    {isAdmin() && (
                        <button
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                            onClick={() => navigate("/cleaners/add")}
                        >
                            + Add Cleaner
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {cleaners.length > 0 ? (
                        cleaners.map((c) => (
                            <div
                                key={c.id}
                                onClick={() => setSelectedCleaner(c)}
                                className="bg-white rounded-lg shadow flex flex-col items-center text-center p-4 cursor-pointer hover:scale-105 transition-transform"
                            >
                                <img
                                    src={c.imageUrl ? `http://localhost:8080${c.imageUrl}?v=${c.id}` : defaultImage}
                                    alt={`${c.name} ${c.surname}`}
                                    className="w-20 h-20 object-cover rounded-full mb-2"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = defaultImage;
                                    }}
                                />
                                <h5 className="text-md font-semibold text-gray-800">{c.name} {c.surname}</h5>
                                <p className="text-sm text-gray-500 mb-3">${c.pricePerHour.toFixed(2)} / hr</p>
                                {isAdmin() && (
                                    <div className="flex gap-2">
                                        <button
                                            className="bg-sky-500 text-white text-sm px-3 py-1 rounded hover:bg-sky-600"
                                            onClick={() => navigate(`/cleaners/edit/${c.id}`)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="bg-red-600 text-white text-sm px-3 py-1 rounded hover:bg-red-700"
                                            onClick={() => removeCleaner(c.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-gray-600 col-span-full">No cleaners found!</p>
                    )}
                </div>
            </div>
            {selectedCleaner && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 animate-fadeIn"
                    onClick={() => setSelectedCleaner(null)}
                >
                    <div
                        className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setSelectedCleaner(null)}
                            className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl font-bold"
                        >
                            ×
                        </button>

                        {/* Content */}
                        <div className="flex flex-col items-center text-center">
                            <img
                                src={
                                    selectedCleaner.imageUrl
                                        ? `http://localhost:8080${selectedCleaner.imageUrl}?v=${selectedCleaner.id}`
                                        : defaultImage
                                }
                                alt={`${selectedCleaner.name} ${selectedCleaner.surname}`}
                                className="w-40 h-40 object-cover rounded-full mb-4"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = defaultImage;
                                }}
                            />
                            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                                {selectedCleaner.name} {selectedCleaner.surname}
                            </h2>
                            <p className="text-gray-600 mb-2">
                                ${selectedCleaner.pricePerHour.toFixed(2)} / hr
                            </p>
                            <p className="text-gray-500 text-sm">
                                {selectedCleaner.description || "No description available."}
                            </p>

                            {isAdmin() && (
                                <div className="flex gap-3 mt-4">
                                    <button
                                        className="bg-sky-500 text-white text-sm px-4 py-2 rounded hover:bg-sky-600"
                                        onClick={() => {
                                            navigate(`/cleaners/edit/${selectedCleaner.id}`);
                                            setSelectedCleaner(null);
                                        }}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="bg-red-600 text-white text-sm px-4 py-2 rounded hover:bg-red-700"
                                        onClick={() => {
                                            removeCleaner(selectedCleaner.id);
                                            setSelectedCleaner(null);
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}