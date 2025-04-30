import "./App.css";
import { Toaster } from "react-hot-toast";
import Register from "./pages/register/page.tsx";
import Reset from "./pages/reset-password/page.tsx";
import Chat from "./pages/chat/page.tsx";
import Chats from "./pages/chats/page.tsx";
import Login from "./pages/login/page.tsx";
import RequireAuth from "./auth/authentication.tsx";
import { PublicAuth } from "./auth/authentication.tsx";
import { BrowserRouter, Route, Routes } from "react-router";

function App() {
  return (
    <>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route element={<PublicAuth />}>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset" element={<Reset />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:id" element={<Chat />} />
            <Route path="/chats" element={<Chats />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
