import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PencilIcon, CheckIcon } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

interface ChatTitleProps {
  initialTitle: string;
  logo?: string;
  onTitleChange?: (title: string) => void;
}

export default function ChatTitle({ logo, onTitleChange }: ChatTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const handleSave = () => {
    if (!title || title.trim() === "") {
      toast.error("Title cannot be empty");
      return;
    }
    if (title.trim().length > 50) {
      toast.error("Title cannot exceed 50 characters");
      return;
    }
    setIsEditing(false);
    const notebookID = window.location.pathname.split("/").pop();
    if (!notebookID) {
      console.error("Notebook ID not found");
      return;
    }
    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("notebookID", notebookID);
    axios
      .post("http://localhost:8000/api/update-title", formData)
      .then((response) => {
        console.log("Title updated successfully:", response.data);
        toast.success("Title updated successfully");
        if (onTitleChange) {
          onTitleChange(title);
        }
      })
      .catch((error) => {
        toast.error("Error updating title");
        console.error("Error updating title:", error);
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    }
    if (e.key === "Escape") {
      setIsEditing(false);
    }
    setTitle(inputRef.current?.value || title);
  };

  useEffect(() => {
    const formData = new FormData();
    const notebookID = window.location.pathname.split("/").pop();
    if (!notebookID) {
      toast.error("Notebook ID not found");
      setTitle("Notebook ID not found");
      console.error("Notebook ID not found");
      return;
    }
    formData.append("notebookID", notebookID);
    axios
      .post("http://localhost:8000/api/get-notebook-metadata", formData)
      .then((response) => {
        const title = response.data.metadata.metadata.name;
        setTitle(title);
      })
      .catch((error) => {
        console.error("Error fetching title:", error);
        toast.error("Error fetching title");
      });
  }, []);

  return (
    <div className="flex flex-col w-full bg-zinc-950 text-white">
      <div className="flex items-center w-full p-2">
        {logo && (
          <div className="flex-shrink-0 w-12 h-12 mx-2 border rounded-full overflow-hidden cursor-pointer">
            <img
              src={logo}
              alt="Logo"
              className="w-full h-full object-contain"
              onClick={() => {
                window.location.href = "/chats";
              }}
            />
          </div>
        )}

        <div className="flex-grow flex items-center">
          {isEditing ? (
            <div className="flex w-full items-center gap-2">
              <Input
                type="text"
                ref={inputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="h-9"
              />
              <Button size="sm" variant="ghost" onClick={handleSave}>
                <CheckIcon className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between">
              <h2 className="text-lg font-semibold truncate">{title}</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
                className="ml-2 h-8 w-8 p-0 cursor-pointer"
              >
                <PencilIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="w-4/5 h-px bg-zinc-700/60 mx-auto"></div>
    </div>
  );
}
