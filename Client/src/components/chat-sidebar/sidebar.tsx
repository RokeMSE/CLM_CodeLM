import ChatItem from "../chat-item/item";
import { FaNoteSticky } from "react-icons/fa6";
import { IoIosArrowBack } from "react-icons/io";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import axios from "axios";

export default function ChatSidebar(props: {
  showUploader: boolean;
  setShowUploader: (show: boolean) => void;
  reloadSidebar: boolean;
  setReloadSidebar: (reload: boolean) => void;
}) {
  const minimizeRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<string[]>([]);
  const { setShowUploader, reloadSidebar } = props;
  const openUploader = () => {
    setShowUploader(true);
    console.log("open uploader");
  };
  const handleMinimize = () => {
    if (minimizeRef.current) {
      sidebarRef.current?.classList.toggle("w-1/5");
      sidebarRef.current?.classList.toggle("w-0");
      minimizeRef.current?.classList.toggle("rotate-180");
      minimizeRef.current?.classList.toggle("-translate-x-72");
    }
  };
  useEffect(() => {
    const notebookID = window.location.pathname.split("/").pop();
    if (!notebookID) {
      console.error("Notebook ID not found");
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append("notebookID", notebookID);
    axios
      .post("http://localhost:8000/api/fetch-files", formData, {
        withCredentials: true,
      })
      .then((response) => {
        const files = response.data.files;
        setFiles(files);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching files:", error);
        setLoading(false);
      });
  }, [reloadSidebar]);
  return (
    <>
      <div
        className="bg-black shadow-2xl border-zinc-800 border-r-2 w-1/5 h-screen relative overflow-hidden transition-all duration-500 ease-in-out"
        ref={sidebarRef}
      >
        <div className="flex flex-col items-center h-full">
          <div className="h-8 hover:bg-zinc-800 transition duration-300 ease-in-out rounded-lg cursor-pointer mt-4 w-4/5 flex justify-center items-center">
            <h1
              className="text-white text-lg select-none whitespace-nowrap overflow-ellipsis"
              onClick={openUploader}
            >
              Upload documents
            </h1>
            <FaNoteSticky className="text-white text-lg ml-2" />
          </div>
          <div className="w-full mt-8">
            {loading ? (
              <>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="w-full h-12 mb-2">
                    <Skeleton className="h-full w-full rounded-lg" />
                  </div>
                ))}
              </>
            ) : files.length > 0 ? (
              files.map((file: string, index: number) => (
                <div key={index} className="w-full h-12 mb-2">
                  <ChatItem filename={String(file)} />
                </div>
              ))
            ) : (
              <div className="flex justify-center items-center h-32">
                <p className="text-zinc-500">No files found</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        className="w-8 h-8 rounded-4xl absolute left-72 top-1/2 z-50 hover:bg-zinc-800 transition-all duration-500 ease-in-out cursor-pointer flex justify-center items-center"
        ref={minimizeRef}
        onClick={handleMinimize}
        role="button"
        aria-label="Toggle Sidebar"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleMinimize();
          }
        }}
      >
        <IoIosArrowBack className="text-white text-xl" />
      </div>
    </>
  );
}
