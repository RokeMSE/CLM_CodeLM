import ChatSidebar from "@/components/chat-sidebar/sidebar";
/* import Window from "@/components/chat-window/window"; */
import Window from "@/components/chat-conv/conv";
import Uploader from "@/components/document-uploader/uploader";
import { useState } from "react";

export default function Chat() {
  const [showUploader, setShowUploader] = useState(false);
  return (
    <>
      <div className="bg-black w-full h-screen flex flex-row relative">
        <ChatSidebar
          showUploader={showUploader}
          setShowUploader={setShowUploader}
        />
        {showUploader && (
          <Uploader
            showUploader={showUploader}
            setShowUploader={setShowUploader}
          />
        )}
        <Window />
      </div>
    </>
  );
}
