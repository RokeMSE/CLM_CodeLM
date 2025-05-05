import React, { useState } from "react";
import { toast } from "react-hot-toast";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { X, FileUp, Loader2 } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface GeneratedContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  notebookId: string;
  onSourceSaved: () => void;
}

const GeneratedContentModal: React.FC<GeneratedContentModalProps> = ({
  isOpen,
  onClose,
  title,
  content,
  notebookId,
  onSourceSaved,
}) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAsSource = async () => {
    setIsSaving(true);
    const formData = new FormData();
    formData.append("notebookID", notebookId);
    formData.append("content", content);
    formData.append("title", title); // Use the generated title
    formData.append("source_type", "generated"); // Indicate type

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
        toast.success(`"${title}" saved as source!`);
        onSourceSaved();
        onClose();
      } else {
        toast.error(response.data.detail || "Failed to save as source.");
      }
    } catch (err: unknown) {
      console.error("Error saving generated content as source:", err);
      const errorMsg = "An unexpected error occurred.";
      toast.error(`Error: ${errorMsg}`);
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
        className="bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-3xl flex flex-col max-h-[85vh] transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modal-appear"
        onClick={(e) => e.stopPropagation()}
        style={{ animationFillMode: "forwards" }}
      >
        <div className="flex justify-between items-center mb-4 text-white border-b border-zinc-700 pb-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </Button>
        </div>

        <div className="flex-grow overflow-y-auto mb-4 pr-2 scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-zinc-800">
          <div className="markdown-content prose prose-invert max-w-none prose-pre:whitespace-pre-wrap prose-pre:break-words text-zinc-200">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        </div>
        <div className="flex justify-end space-x-3 border-t border-zinc-700 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="bg-zinc-700 hover:bg-zinc-600 border-zinc-600 text-white"
          >
            Close
          </Button>
          <Button
            onClick={handleSaveAsSource}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
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
            /* Ensure prose styles apply correctly if needed */
            .markdown-content p { margin-bottom: 0.8em; }
            .markdown-content ul, .markdown-content ol { margin-left: 1.5em; margin-bottom: 0.8em; }
            .markdown-content code { background-color: rgba(200, 200, 200, 0.1); padding: 0.2em 0.4em; border-radius: 3px; }
            .markdown-content pre { background-color: rgba(0,0,0, 0.3); padding: 0.8em; border-radius: 4px; overflow-x: auto;}
            .markdown-content pre code { background-color: transparent; padding: 0; }
        `}
      </style>
    </div>
  );
};

export default GeneratedContentModal;
