import "./App.css";
import { Toaster } from "react-hot-toast";
import Register from "./pages/register/page.tsx";
import Reset from "./pages/reset-password/page.tsx";
import Chat from "./pages/chat/page.tsx";
import Chats from "./pages/chats/page.tsx";
import { BrowserRouter, Route, Routes } from "react-router";

function App() {
	return (
		<>
			<Toaster />
			<BrowserRouter>
				<Routes>
					<Route path="/" element={<App />} />
					<Route path="/login" element={<App />} />
					<Route path="/register" element={<Register />} />
					<Route path="/reset" element={<Reset />} />
					<Route path="/chat" element={<Chat />} />
					<Route path="/chat/:id" element={<Chat />} />
					<Route path="/chats" element={<Chats />} />
				</Routes>
			</BrowserRouter>
		</>
	);
}

export default App;
