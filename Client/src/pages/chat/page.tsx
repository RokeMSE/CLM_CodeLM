import ChatSidebar from "@/components/chat-sidebar/sidebar";
import Window from "@/components/chat-conv/conv";
import Uploader from "@/components/document-uploader/uploader";
import ChatTitle from "@/components/chat-title/title";
import { useState } from "react";

export default function Chat() {
  const [showUploader, setShowUploader] = useState(false);
  const [reloadSidebar, setReloadSidebar] = useState(false);
  return (
    <>
      <div className="bg-black w-full h-screen flex flex-row relative">
        <div className="flex flex-col items-start w-1/5 h-screen justify-center">
          <ChatTitle
            initialTitle="Chat Title"
            logo="/CodeLM.svg"
            onTitleChange={(title) => console.log("New title:", title)}
          />
          <ChatSidebar
            showUploader={showUploader}
            setShowUploader={setShowUploader}
            reloadSidebar={reloadSidebar}
            setReloadSidebar={setReloadSidebar}
          />
        </div>
        {showUploader && (
          <Uploader
            showUploader={showUploader}
            setShowUploader={setShowUploader}
            setReloadSidebar={setReloadSidebar}
          />
        )}
        <Window />
      </div>
    </>
  );
}
