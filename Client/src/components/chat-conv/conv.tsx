import { useRef, useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import axios from "axios";

// --- Interface Definitions ---
interface ChatMessage {
  role: "user" | "model";
  text: string;
}

// Define the expected structure of the request body for the backend
interface BackendRequestBody {
  user_text: string;
  history: ChatMessage[]; // Send the message history
}

// Define the expected structure of the successful response
interface BackendSuccessResponse {
  reply: string;
}

// --- Function to Call Backend API ---
async function fetchBotResponse(
  userText: string,
  currentHistory: ChatMessage[],
): Promise<string> {
  try {
    // Create the request body according to expected format
    const requestBody: BackendRequestBody = {
      user_text: userText,
      history: currentHistory,
    };

    // Make the POST request to your backend API
    const response = await axios.post<BackendSuccessResponse>(
      "http://localhost:8000/api/chat",
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      },
    );

    // Return the reply text from the successful response
    return response.data.reply;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      // If there's a specific error message from the server, use it
      throw new Error(
        error.response.data.error || "Failed to get response from the model",
      );
    }
    // Otherwise, throw a generic error
    throw new Error("Error communicating with the server");
  }
}

// --- React Component ---
export default function ChatConversation() {
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      // Slight delay to ensure rendering is complete
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight;
        }
      }, 0);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // --- Handle sending a message ---
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      setError(null);

      const userMessage: ChatMessage = { role: "user", text };

      // Important: Send the history before adding the latest user message
      const historyForBackend = [...messages];

      setMessages((prevMessages) => [...prevMessages, userMessage]);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      setIsLoading(true);

      try {
        const replyText = await fetchBotResponse(text, historyForBackend);
        const modelMessage: ChatMessage = {
          role: "model",
          text: replyText,
        };
        setMessages((prevMessages) => [...prevMessages, modelMessage]);
      } catch (err) {
        console.error("Error in handleSendMessage:", err);
        let errorMessage = "Sorry, an error occurred while contacting the bot.";
        if (err instanceof Error) {
          errorMessage = err.message;
        }
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, scrollToBottom],
  );

  return (
    <>
      <div
        className="w-full h-screen bg-zinc-900 flex flex-col items-center transition-all duration-500 ease-in-out"
        ref={chatContainerRef}
      >
        {/* Chat Messages Area */}
        <div
          className="w-full flex-grow bg-zinc-900 rounded-xl flex flex-col overflow-y-auto p-4 space-y-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none][scrollbar-width:none]"
          ref={messagesContainerRef}
        >
          {/* Welcome Message */}
          {messages.length === 0 && !isLoading && (
            <div className="flex justify-center text-gray-400 text-sm">
              Start the conversation by typing below.
            </div>
          )}

          {/* Message Bubbles */}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] h-fit text-white p-3 rounded-xl mb-2 text-pretty whitespace-pre-wrap break-words shadow-md ${
                  message.role === "user" ? "bg-blue-700" : "bg-zinc-700"
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[70%] h-fit text-white p-3 rounded-xl mb-2 text-pretty whitespace-pre-wrap break-words bg-zinc-700 animate-pulse">
                Thinking...
              </div>
            </div>
          )}

          {/* Error Message */}
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
                  if (inputValue.trim() !== "") {
                    handleSendMessage(inputValue);
                  }
                }
              }}
            />
            <button
              onClick={() => {
                if (inputRef.current) {
                  const inputValue = inputRef.current.value;
                  if (inputValue.trim() !== "") {
                    handleSendMessage(inputValue);
                  }
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
