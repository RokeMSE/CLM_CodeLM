import ChatSidebar from "@/components/chat-sidebar/sidebar";
import Window from "@/components/chat-conv/conv";
import Uploader from "@/components/document-uploader/uploader";
import ChatTitle from "@/components/chat-title/title";
import { useState } from "react";

export default function Chat() {
  const [showUploader, setShowUploader] = useState(false);
  const [reloadSidebar, setReloadSidebar] = useState(false);
  const [minimized, setMinimized] = useState(false);

  return (
    <>
      <div className="bg-black w-full h-screen flex flex-row relative">
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
            reloadSidebar={reloadSidebar}
            setReloadSidebar={setReloadSidebar}
            minimized={minimized}
            setMinimized={setMinimized}
          />
        </div>
        {showUploader && (
          <Uploader
            showUploader={showUploader}
            setShowUploader={setShowUploader}
            setReloadSidebar={setReloadSidebar}
          />
        )}
        <div
          className={`transition-all duration-500 ease-in-out ${
            minimized ? "w-full" : "w-4/5"
          }`}
        >
          <Window />
        </div>
      </div>
    </>
  );
}
