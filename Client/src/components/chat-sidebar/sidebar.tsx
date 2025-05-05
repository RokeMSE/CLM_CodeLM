import SidebarItem from "../sidebar-item/sidebar-item";
import { FaNoteSticky } from "react-icons/fa6";
import { IoIosArrowBack } from "react-icons/io";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import axios from "axios";
import toast from "react-hot-toast";

export interface FileMetadata {
  file_name: string;
  file_original_name: string;
  file_size: number;
  file_type: string;
  public_url: string;
}

export default function ChatSidebar(props: {
  showUploader: boolean;
  setShowUploader: (show: boolean) => void;
  reloadSidebar: boolean;
  setReloadSidebar: (reload: boolean) => void;
  minimized: boolean;
  setMinimized: (minimized: boolean) => void;
  excludedFiles: string[];
  setExcludedFiles: (excludedFiles: string[]) => void;
}) {
  const minimizeRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const {
    setShowUploader,
    reloadSidebar,
    setReloadSidebar,
    minimized,
    setMinimized,
    excludedFiles,
    setExcludedFiles,
  } = props;

  const openUploader = () => {
    setShowUploader(true);
  };

  const handleMinimize = () => {
    setMinimized(!minimized);
  };

  const fetchFiles = () => {
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
        console.log("Fetched files:", files);
        setFiles(files);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching files:", error);
        setLoading(false);
      });
  };

  // Fetch files when component mounts or when reloadSidebar changes
  useEffect(() => {
    if (reloadSidebar) {
      fetchFiles();
      setReloadSidebar(false);
    }
  }, [reloadSidebar, setReloadSidebar]);

  useEffect(() => {
    const notebookID = window.location.pathname.split("/").pop();
    if (!notebookID) {
      toast.error("Notebook ID not found");
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
        console.log("Fetched files:", files);
        setFiles(files);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching files:", error);
        setLoading(false);
        toast.error("Error fetching files");
      });
  }, []);

  return (
    <>
      <div
        className={`bg-black shadow-2xl border-zinc-800 border-r-2 relative overflow-hidden transition-all duration-500 ease-in-out ${
          minimized ? "w-0" : "w-full"
        }`}
        ref={sidebarRef}
      >
        <div className="flex flex-col items-center h-screen">
          <div className="h-8 hover:bg-zinc-800 transition duration-300 ease-in-out rounded-lg cursor-pointer mt-4 w-4/5 flex justify-center items-center">
            <h1
              className="text-white text-lg select-none whitespace-nowrap overflow-ellipsis"
              onClick={openUploader}
            >
              Upload documents
            </h1>
            <FaNoteSticky className="text-white text-lg ml-2" />
          </div>
          <div className="w-full mt-8 pb-16 overflow-y-auto">
            {loading ? (
              <>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="w-full h-12 mb-2">
                    <Skeleton className="h-full w-full rounded-lg" />
                  </div>
                ))}
              </>
            ) : files.length > 0 ? (
              files.map((file: FileMetadata, index: number) => (
                <div key={index} className="w-full mb-2">
                  <SidebarItem
                    file={file}
                    excludedFiles={excludedFiles}
                    setExcludedFiles={setExcludedFiles}
                    refreshFiles={() => setReloadSidebar(!reloadSidebar)}
                  />
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
        className={`w-8 h-8 rounded-full bg-black border border-zinc-800 absolute top-1/2 transform -translate-y-1/2 z-50 hover:bg-zinc-800 transition-all duration-500 ease-in-out cursor-pointer flex justify-center items-center ${
          minimized ? "left-2" : "left-[calc(20%-4px)] -translate-x-full"
        }`}
        ref={minimizeRef}
        onClick={handleMinimize}
        role="button"
        aria-label="Toggle Sidebar"
        tabIndex={0}
      >
        <IoIosArrowBack
          className={`text-white text-xl transition-transform duration-500 ${minimized ? "rotate-180" : ""}`}
        />
      </div>
    </>
  );
}
