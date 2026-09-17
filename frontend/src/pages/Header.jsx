import { Link } from "react-router-dom";
import {logout} from "../utils/auth.js";

export default function Header() {
    const token = localStorage.getItem("token");

    const handleLogout = () => {
        logout();
    };

    return (
        <nav className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
            <h1 className="text-lg font-bold">CleanerApp</h1>
            <div className="space-x-4">
                {token ? (
                    <>
                        <Link to="/cleaners">Home</Link>
                        <button onClick={handleLogout} className="bg-red-600 px-3 py-1 rounded">
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login">Login</Link>
                        <Link to="/register">Register</Link>
                    </>
                )}
            </div>
        </nav>
    );
}