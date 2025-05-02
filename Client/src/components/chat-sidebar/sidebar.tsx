import DocumentItem from "../chat-item/item";
import { FaNoteSticky } from "react-icons/fa6";
import { IoIosArrowBack } from "react-icons/io";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import axios from "axios";

interface SidebarProps {
  isUploaderVisible: boolean;
  setUploaderVisible: (isVisible: boolean) => void;
  reloadSidebar: boolean;
  setReloadSidebar: (shouldReload: boolean) => void;
}

export default function DocumentSidebar({
  setUploaderVisible,
  reloadSidebar,
}: SidebarProps) {
  const toggleButtonRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [documentFiles, setDocumentFiles] = useState<string[]>([]);

  const handleOpenUploader = () => {
    setUploaderVisible(true);
  };

  const handleToggleSidebar = () => {
    if (toggleButtonRef.current) {
      sidebarRef.current?.classList.toggle("w-1/5");
      sidebarRef.current?.classList.toggle("w-0");
      toggleButtonRef.current?.classList.toggle("rotate-180");
      toggleButtonRef.current?.classList.toggle("-translate-x-72");
    }
  };

  useEffect(() => {
    const notebookID = window.location.pathname.split("/").pop();
    if (!notebookID) {
      console.error("Notebook ID not found");
      return;
    }

    setIsLoading(true);

    axios
      .get("http://localhost:8000/api/notebook_files", {
        params: { notebookID: notebookID },
      })
      .then((response) => {
        const files = response.data.files;
        setDocumentFiles(files);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching files:", error);
        setIsLoading(false);
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
              onClick={handleOpenUploader}
            >
              Upload documents
            </h1>
            <FaNoteSticky className="text-white text-lg ml-2" />
          </div>
          <div className="w-full mt-8">
            {isLoading ? (
              <>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="w-full h-12 mb-2">
                    <Skeleton className="h-full w-full rounded-lg" />
                  </div>
                ))}
              </>
            ) : documentFiles.length > 0 ? (
              documentFiles.map((file: string, index: number) => (
                <div key={index} className="w-full h-12 mb-2">
                  <DocumentItem filename={String(file)} />
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
        ref={toggleButtonRef}
        onClick={handleToggleSidebar}
      >
        <IoIosArrowBack className="text-white text-xl" />
      </div>
    </>
  );
}
