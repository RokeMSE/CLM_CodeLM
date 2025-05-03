import { useRef, useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import axios from "axios";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";

// --- Interface Definitions ---
interface Message {
  role: "user" | "model";
  text: string;
}

// Define the expected structure of the request body for your backend
interface BackendRequestBody {
  user_text: string;
  history: Message[]; // Send the simple message history
  notebookID: string; // Send the notebook ID
}

// Define the expected structure of the successful response
interface BackendSuccessResponse {
  reply: string;
}

// --- Function to Call Backend API ---
async function getBotResponseFromBackend(
  userText: string,
  currentHistory: Message[],
): Promise<string> {
  const backendUrl = `${
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
  }/api/chat`; // No idea if this is correct

  console.log(`Calling backend API at: ${backendUrl}`);
  const notebookID = window.location.pathname.split("/").pop();
  if (!notebookID) {
    toast.error("Notebook ID not found");
    throw new Error("Notebook ID not found");
  }
  const requestBody: BackendRequestBody = {
    user_text: userText,
    history: currentHistory,
    notebookID: notebookID,
  };

  try {
    const response = await axios.post<BackendSuccessResponse>(
      backendUrl,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true, // Include credentials if needed
      },
    ); // Use axios.post

    if (response.status === 200 && response.data && response.data.reply) {
      console.log("Backend Response Text:", response.data.reply);
      return response.data.reply;
    } else {
      // Handle cases where backend returned success status but invalid data
      console.error("Invalid response structure from backend:", response.data);
      throw new Error("Received an invalid response from the server.");
    }
  } catch (error) {
    console.error("Error calling backend API:", error);
    let errorMessage = "Failed to get response from the bot.";
    if (axios.isAxiosError(error)) {
      // Extract more specific error info from Axios error if available
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Backend Error Data:", error.response.data);
        console.error("Backend Error Status:", error.response.status);
        // Try to use error message from backend response if available
        errorMessage =
          error.response.data?.detail ||
          error.response.data?.error ||
          `Backend Error: ${error.response.status}`;
      } else if (error.request) {
        // The request was made but no response was received
        console.error("No response received from backend:", error.request);
        errorMessage = "The server did not respond. Please try again later.";
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("Error during request setup:", error.message);
        errorMessage = `Request setup error: ${error.message}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
}

// --- React Component ---
export default function ChatWindow() {
  const inputRef = useRef<HTMLInputElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollToBottom = useCallback(() => {
    if (chatBodyRef.current) {
      // Slight delay ensure rendering is complete
      setTimeout(() => {
        if (chatBodyRef.current) {
          chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
      }, 0);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    // Get messages
    const notebookID = window.location.pathname.split("/").pop();
    if (!notebookID) {
      toast.error("Notebook ID not found");
      return;
    }
    const formData = new FormData();
    formData.append("notebookID", notebookID);
    axios
      .post("http://localhost:8000/api/fetch-messages", formData)
      .then((response) => {
        const initialMessages: Message[] = response.data.messages;
        console.log("Fetched messages:", initialMessages);
        setMessages(initialMessages);
      })
      .catch((error) => {
        console.error("Error fetching messages:", error);
        toast.error("Error fetching messages");
      });
  }, []);

  // --- Handle sending a message ---
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      setError(null);

      const userMessage: Message = { role: "user", text };
      // Important: Send the history *before* adding the latest user message, matching what the previous getBotResponse expected.
      const historyForBackend = [...messages];

      setMessages((prevMessages) => [...prevMessages, userMessage]);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      setIsLoading(true);

      try {
        // --- Call the NEW Backend function ---
        const replyText = await getBotResponseFromBackend(
          text,
          historyForBackend,
        ); // Pass history
        const modelMessage: Message = {
          role: "model",
          text: replyText,
        };
        setMessages((prevMessages) => [...prevMessages, modelMessage]);
      } catch (err) {
        console.error("Error in handleSendMessage:", err);
        let errorMessage = "Sorry, an error occurred while contacting the bot.";
        if (err instanceof Error) {
          errorMessage = err.message; // Use the detailed error message from getBotResponseFromBackend
        }
        setError(errorMessage);
        // Remove the user's message if the API call fails
        // setMessages(prev => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages],
  ); // Add scrollToBottom if needed inside finally/catch

  return (
    <>
      <div
        className="w-full h-screen bg-zinc-900 flex flex-col items-center transition-all duration-500 ease-in-out"
        ref={chatWindowRef}
      >
        {/* Chat Body */}
        <div
          className="w-full flex-grow bg-zinc-900 rounded-xl flex flex-col overflow-y-auto p-4 space-y-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none][scrollbar-width:none]"
          ref={chatBodyRef}
        >
          {/* Initial Message Example */}
          {messages.length === 0 && !isLoading && (
            <div className="flex justify-center text-gray-400 text-sm">
              Start the conversation by typing below.
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[60%] text-white p-3 rounded-xl mb-3 shadow-md ${
                  message.role === "user" ? "bg-blue-700" : "bg-zinc-700"
                }`}
              >
                <div className="markdown-content prose prose-invert max-w-none prose-pre:whitespace-pre-wrap prose-pre:break-words">
                  <Markdown 
                    remarkPlugins={[remarkGfm]}
                  >
                    {message.text}
                  </Markdown>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[70%] h-fit text-white p-3 rounded-xl mb-2 text-pretty whitespace-pre-wrap break-words bg-zinc-700 animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          {/* Display Error Message */}
          {error && (
            <div className="flex justify-center text-red-500 text-sm p-2">
              Error: {error}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="w-full max-w-4xl px-4 pb-4 pt-2 bg-zinc-900 flex flex-col justify-center items-center border-t border-zinc-700">
          <div className="w-full flex items-center space-x-2">
            <Input
              type="text"
              placeholder="Type your message here..."
              className="flex-grow text-white bg-zinc-800 border border-zinc-700 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
              ref={inputRef}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && inputRef.current) {
                  e.preventDefault();
                  const inputValue = inputRef.current.value;
                  handleSendMessage(inputValue);
                }
              }}
            />
            <button
              onClick={() => {
                if (inputRef.current) {
                  handleSendMessage(inputRef.current.value);
                }
              }}
              disabled={isLoading}
              className="px-4 py-2 cursor-pointer bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
