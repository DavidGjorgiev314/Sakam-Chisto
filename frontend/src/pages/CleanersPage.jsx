import React, { useState } from "react";
import CleanerList from "./CleanerList";
import AddCleanerForm from "./AddCleanerForm";

export default function CleanersPage() {
    const [refresh, setRefresh] = useState(false);

    return (
        <div>
            <AddCleanerForm onAdded={() => setRefresh(r => !r)} />
            {/* Passing `refresh` as a key forces CleanerList to reload when a cleaner is added */}
            <CleanerList key={refresh} />
        </div>
    );
}