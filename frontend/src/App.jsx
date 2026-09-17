import { BrowserRouter, Routes, Route } from "react-router-dom";
import CleanerList from "./pages/CleanerList";
import AddCleaner from "./pages/AddCleaner";
import EditCleaner from "./pages/EditCleaner";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import Header from "./pages/Header.jsx";
import PrivateRoute from "./utils/PrivateRoute";

export default function App() {
    return (
        <BrowserRouter>
            <Header />
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/cleaners" element={<CleanerList />} />

                <Route
                    path="/cleaners/add"
                    element={
                        <PrivateRoute>
                            <AddCleaner />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/cleaners/edit/:id"
                    element={
                        <PrivateRoute>
                            <EditCleaner />
                        </PrivateRoute>
                    }
                />

                <Route path="*" element={<CleanerList />} />
            </Routes>
        </BrowserRouter>
    );
}