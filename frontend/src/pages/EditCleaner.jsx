import CleanerForm from "../components/CleanerForm";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function EditCleaner() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [cleaner, setCleaner] = useState(null);
    const [photoFile, setPhotoFile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");

        fetch(`http://localhost:8080/cleaners/${id}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then(res => {
                if (res.status === 403) throw new Error("Unauthorized. Please log in.");
                if (!res.ok) throw new Error("Cleaner not found");
                return res.json();
            })
            .then(data => setCleaner(data))
            .catch(err => {
                alert(err.message);
                navigate("/cleaners");
            })
            .finally(() => setLoading(false));
    }, [id, navigate]);

    const handleUpdate = async (updatedCleaner) => {
        const token = localStorage.getItem("token");

        const params = new URLSearchParams();
        params.append("name", updatedCleaner.name);
        params.append("surname", updatedCleaner.surname);
        params.append("pricePerHour", updatedCleaner.pricePerHour);

        const response = await fetch(`http://localhost:8080/cleaners/update/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Bearer ${token}`,
            },
            body: params.toString(),
        });

        if (response.ok) {
            if (photoFile) {
                const formData = new FormData();
                formData.append("file", photoFile);

                await fetch(`http://localhost:8080/cleaners/${id}/upload-photo`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    body: formData,
                });
            }

            navigate("/cleaners");
        } else {
            alert("Failed to update cleaner");
        }
    };

    if (loading) return <p className="text-center mt-8">Loading cleaner data...</p>;

    return (
        <div>
            <h2 className="text-2xl font-bold text-center my-4">Edit Cleaner</h2>
            <CleanerForm
                onSubmit={handleUpdate}
                initialData={cleaner}
                setPhotoFile={setPhotoFile}
            />
        </div>
    );
}