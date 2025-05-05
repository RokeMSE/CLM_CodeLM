import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, FileUp } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

interface MarkdownEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  notebookId: string;
  onNoteSaved: () => void;
}

const MarkdownEditorModal: React.FC<MarkdownEditorModalProps> = ({
  isOpen,
  onClose,
  notebookId,
  onNoteSaved,
}) => {
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setContent("");
      setError(null);
    }
  }, [isOpen]);

  const handleSaveNoteAsSource = async () => {
    if (!content.trim()) {
      setError("Note content cannot be empty.");
      return;
    }
    setError(null);
    setIsSaving(true);

    const formData = new FormData();
    formData.append("notebookID", notebookId);
    formData.append("content", content);
    formData.append("title", "My Note"); // Default title for the note
    formData.append("source_type", "note");

    try {
      const response = await axios.post(
        "http://localhost:8000/api/save-generated-source",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
        },
      );

      if (response.status === 200 || response.status === 201) {
        toast.success("Note saved as source successfully!");
        setContent("");
        onNoteSaved();
        onClose();
      } else {
        toast.error(response.data.detail || "Failed to save note.");
        setError(response.data.detail || "Failed to save note.");
      }
    } catch (error: unknown) {
      console.error("Error saving note as source:", error);
      const errorMsg = "An unexpected error occurred.";
      toast.error(`Error: ${errorMsg}`);
      setError(`Error: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4 transition-opacity duration-300 ease-in-out"
      onClick={onClose}
    >
      <div
        className="bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-2xl flex flex-col max-h-[80vh] transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modal-appear"
        onClick={(e) => e.stopPropagation()}
        style={{ animationFillMode: "forwards" }}
      >
        <div className="flex justify-between items-center mb-4 text-white">
          <h2 className="text-xl font-semibold">My Notes</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </Button>
        </div>
        <textarea
          className="flex-grow w-full bg-zinc-900 text-white p-3 rounded border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4 scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-zinc-800"
          placeholder="Start typing your notes in Markdown..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={15}
          disabled={isSaving}
        />
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="bg-zinc-700 hover:bg-zinc-600 border-zinc-600 text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveNoteAsSource}
            disabled={isSaving || !content.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? (
              "Saving..."
            ) : (
              <>
                <FileUp className="mr-2 h-4 w-4" />
                Save as Source
              </>
            )}
          </Button>
        </div>
      </div>
      <style>
        {`
            @keyframes modal-appear {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
            .animate-modal-appear {
                animation: modal-appear 0.3s ease-out;
            }
        `}
      </style>
    </div>
  );
};

export default MarkdownEditorModal;
