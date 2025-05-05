import ChatSidebar from "@/components/chat-sidebar/sidebar";
import Window from "@/components/chat-conv/conv";
import Uploader from "@/components/document-uploader/uploader";
import ChatTitle from "@/components/chat-title/title";
import { useState, useEffect } from "react";
import RightSidebar from "@/components/chat-sidebar/RightSidebar";
import { useParams } from "react-router";
import GeneratedContentModal from "@/components/chat-sidebar/GeneratedContentModal";

export default function Chat() {
  const [showUploader, setShowUploader] = useState(false);

  const [reloadSidebarFlag, setReloadSidebarFlag] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [excludedFiles, setExcludedFiles] = useState<string[]>([]);
  const { id: notebookIdFromUrl } = useParams<{ id: string }>();
  const [notebookId, setNotebookId] = useState<string | null>(null);

  const [showGeneratedContentModal, setShowGeneratedContentModal] =
    useState(false);
  const [generatedContent, setGeneratedContent] = useState<{
    type: string;
    title: string;
    content: string;
  } | null>(null);

  useEffect(() => {
    if (notebookIdFromUrl) {
      setNotebookId(notebookIdFromUrl);
    } else {
      console.error("Notebook ID not found in URL");
    }
  }, [notebookIdFromUrl]);

  const handleSourceListChange = () => {
    setReloadSidebarFlag((prev) => !prev);
  };

  const handleGeneratedContent = (
    type: string,
    title: string,
    content: string,
  ) => {
    setGeneratedContent({ type, title, content });
    setShowGeneratedContentModal(true);
  };

  const closeGeneratedContentModal = () => {
    setShowGeneratedContentModal(false);
    setGeneratedContent(null);
  };

  if (!notebookId) {
    return (
      <div className="bg-black w-full h-screen flex justify-center items-center text-white">
        Loading Notebook...
      </div>
    );
  }
  return (
    <>
      <div className="bg-black w-full h-screen flex flex-row relative overflow-hidden">
        <div
          className={`flex flex-col items-start h-screen justify-center transition-all duration-500 ease-in-out ${
            minimized ? "w-0" : "w-1/5"
          }`}
        >
          <div className={`w-full ${minimized ? "invisible" : "visible"}`}>
            <ChatTitle
              initialTitle="Chat Title"
              logo="/CodeLM.svg"
              onTitleChange={(title) => console.log("New title:", title)}
            />
          </div>
          <ChatSidebar
            showUploader={showUploader}
            setShowUploader={setShowUploader}
            reloadSidebar={reloadSidebarFlag}
            setReloadSidebar={setReloadSidebarFlag}
            minimized={minimized}
            setMinimized={setMinimized}
            excludedFiles={excludedFiles}
            setExcludedFiles={setExcludedFiles}
          />
        </div>

        {showUploader && (
          <Uploader
            showUploader={showUploader}
            setShowUploader={setShowUploader}
            setReloadSidebar={setReloadSidebarFlag}
          />
        )}

        <div
          className={`transition-all duration-500 ease-in-out ${
            minimized ? "w-full" : "w-4/5"
          }`}
        >
          <Window excludedFiles={excludedFiles} />
        </div>

        <div className="flex-shrink-0 h-screen">
          <RightSidebar
            notebookId={notebookId}
            onSourceListChange={handleSourceListChange}
            onGeneratedContent={handleGeneratedContent}
          />
        </div>

        {showGeneratedContentModal && generatedContent && (
          <GeneratedContentModal
            isOpen={showGeneratedContentModal}
            onClose={closeGeneratedContentModal}
            title={generatedContent.title}
            content={generatedContent.content}
            notebookId={notebookId}
            onSourceSaved={handleSourceListChange} // Refresh left sidebar if saved
          />
        )}
      </div>
    </>
  );
}
