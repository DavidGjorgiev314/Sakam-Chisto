import CleanerForm from "../components/CleanerForm";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { API_BASE } from "../lib/apiBase";

export default function AddCleaner() {
    const navigate = useNavigate();
    const [photoFile, setPhotoFile] = useState(null); // New


    const handleAdd = async (cleaner) => {
        const token = localStorage.getItem("token");  // Get the token

        const response = await fetch(`${API_BASE}/cleaners`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`  // Add authorization
            },
            body: JSON.stringify(cleaner),
        });

        if (response.ok) {
            const createdCleaner = await response.json();

            if (photoFile) {
                console.log("Uploading file:", photoFile);
                const formData = new FormData();
                formData.append("file", photoFile);

                const uploadResponse = await fetch(`${API_BASE}/cleaners/${createdCleaner.id}/upload-photo`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`  // Add authorization
                    },
                    body: formData,
                    // Don't set Content-Type header - let the browser set it automatically for FormData
                });

                if (!uploadResponse.ok) {
                    console.error("Failed to upload photo");
                    alert("Cleaner was created but photo upload failed");
                    navigate("/cleaners");
                    return;
                }
            }

            navigate("/cleaners");
        } else {
            alert("Failed to add cleaner");
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-center my-4">Add Cleaner</h2>
            <CleanerForm onSubmit={handleAdd} setPhotoFile={setPhotoFile} />
        </div>
    );
}
