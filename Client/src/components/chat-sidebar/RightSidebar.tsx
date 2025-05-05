import React, { useState } from "react";
import { toast } from "react-hot-toast";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  HelpCircle,
  BookOpen,
  FileText,
  StickyNote,
} from "lucide-react";
import MarkdownEditorModal from "@/components/chat-sidebar/MarkdownEditorModal";

interface RightSidebarProps {
  notebookId: string;
  onSourceListChange: () => void;
  onGeneratedContent: (type: string, title: string, content: string) => void;
}

type LoadingType = null | "faq" | "study-guide" | "briefing";

const RightSidebar: React.FC<RightSidebarProps> = ({
  notebookId,
  onSourceListChange,
  onGeneratedContent,
}) => {
  const [isLoading, setIsLoading] = useState<LoadingType>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isNotesEditorOpen, setIsNotesEditorOpen] = useState(false);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  const openNotesEditor = () => setIsNotesEditorOpen(true);
  const closeNotesEditor = () => setIsNotesEditorOpen(false);

  const handleGenerateContent = async (
    type: "faq" | "study-guide" | "briefing",
  ) => {
    if (isLoading) return;
    setIsLoading(type);
    let generatedTitle = "";

    switch (type) {
      case "faq":
        generatedTitle = "Generated FAQ";
        break;
      case "study-guide":
        generatedTitle = "Generated Study Guide";
        break;
      case "briefing":
        generatedTitle = "Generated Briefing Document";
        break;
    }

    const formData = new FormData();
    formData.append("notebookID", notebookId);

    try {
      const response = await axios.post(
        `http://localhost:8000/api/generate-${type}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
        },
      );

      if (response.status === 200 && response.data.content) {
        onGeneratedContent(type, generatedTitle, response.data.content);
        toast.success(`${generatedTitle} generated successfully!`);
      } else {
        toast.error(response.data.detail || `Failed to generate ${type}.`);
      }
    } catch (error: unknown) {
      console.error(`Error generating ${type}:`, error);
      const errorMsg = "An unexpected error occurred.";
      toast.error(`Error generating ${type}: ${errorMsg}`);
    } finally {
      setIsLoading(null);
    }
  };

  const renderButtonContent = (
    type: "faq" | "study-guide" | "briefing",
    text: string,
    Icon: React.ElementType,
  ) => {
    if (isLoading === type) {
      return (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      );
    }
    return (
      <>
        <Icon className="mr-2 h-4 w-4" />
        {text}
      </>
    );
  };
  const renderIconButton = (
    type: "faq" | "study-guide" | "briefing",
    label: string,
    Icon: React.ElementType,
  ) => {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleGenerateContent(type)}
        disabled={!!isLoading}
        className="text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-50"
        aria-label={
          isLoading === type ? `Generating ${label}` : `Generate ${label}`
        }
      >
        {isLoading === type ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <Icon size={20} />
        )}
      </Button>
    );
  };

  return (
    <>
      <div
        className={`flex flex-col bg-zinc-800 text-white h-full transition-all duration-300 ease-in-out ${isCollapsed ? "w-16" : "w-64"} relative border-l border-zinc-700`}
      >
        <button
          onClick={toggleCollapse}
          className="absolute top-1/2 -left-4 transform -translate-y-1/2 bg-zinc-700 hover:bg-zinc-600 text-white p-1.5 rounded-full z-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-800 focus:ring-blue-500"
          aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>

        {!isCollapsed && (
          <div className="p-4 flex flex-col space-y-3 flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-zinc-800">
            <h3 className="font-semibold text-md mb-1 border-b border-zinc-600 pb-2 text-zinc-300">
              Assistant Tools
            </h3>
            <Button
              variant="outline"
              className="w-full justify-start bg-zinc-700 hover:bg-zinc-600 border-zinc-600 text-zinc-200 hover:text-white"
              onClick={() => handleGenerateContent("faq")}
              disabled={!!isLoading}
            >
              {renderButtonContent("faq", "Generate FAQ", HelpCircle)}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start bg-zinc-700 hover:bg-zinc-600 border-zinc-600 text-zinc-200 hover:text-white"
              onClick={() => handleGenerateContent("study-guide")}
              disabled={!!isLoading}
            >
              {renderButtonContent(
                "study-guide",
                "Generate Study Guide",
                BookOpen,
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start bg-zinc-700 hover:bg-zinc-600 border-zinc-600 text-zinc-200 hover:text-white"
              onClick={() => handleGenerateContent("briefing")}
              disabled={!!isLoading}
            >
              {renderButtonContent(
                "briefing",
                "Generate Briefing Doc",
                FileText,
              )}
            </Button>
            <div className="border-t border-zinc-600 pt-3 mt-3"></div>
            <Button
              variant="outline"
              className="w-full justify-start bg-zinc-700 hover:bg-zinc-600 border-zinc-600 text-zinc-200 hover:text-white"
              onClick={openNotesEditor}
              disabled={!!isLoading} // Optionally disable while generating other things
            >
              <StickyNote className="mr-2 h-4 w-4" />
              My Notes
            </Button>
          </div>
        )}
        {isCollapsed && (
          <div className="p-3 flex flex-col space-y-4 items-center mt-4">
            {renderIconButton("faq", "FAQ", HelpCircle)}
            {renderIconButton("study-guide", "Study Guide", BookOpen)}
            {renderIconButton("briefing", "Briefing Doc", FileText)}
            <div className="border-t border-zinc-600 w-full my-2"></div>{" "}
            <Button
              variant="ghost"
              size="icon"
              onClick={openNotesEditor}
              className="text-zinc-300 hover:text-white hover:bg-zinc-700"
              aria-label="My Notes"
              disabled={!!isLoading}
            >
              <StickyNote size={20} />
            </Button>
          </div>
        )}
      </div>
      <MarkdownEditorModal
        isOpen={isNotesEditorOpen}
        onClose={closeNotesEditor}
        notebookId={notebookId}
        onNoteSaved={onSourceListChange}
      />
    </>
  );
};

export default RightSidebar;
