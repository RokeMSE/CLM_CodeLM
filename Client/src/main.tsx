import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";
import App from "./App.tsx";
import Register from "./pages/register/page.tsx";
import Reset from "./pages/reset-password/page.tsx";

createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<Routes>
			<Route path="/" element={<App />} />
			<Route path="/login" element={<App />} />
			<Route path="/register" element={<Register />} />
			<Route path="/reset" element={<Reset />} />
		</Routes>
	</BrowserRouter>
);
