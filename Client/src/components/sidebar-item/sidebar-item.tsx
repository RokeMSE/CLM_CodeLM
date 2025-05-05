import { FaFilePdf } from "react-icons/fa6";
import { Checkbox } from "@/components/ui/checkbox";
import { FileMetadata } from "../chat-sidebar/sidebar";
import { useRef, useState, useEffect } from "react";
import { BiDotsVerticalRounded } from "react-icons/bi";
import { MdOutlineEdit, MdOutlineDelete } from "react-icons/md";
import axios from "axios";
import toast from "react-hot-toast";

export default function SidebarItem(props: {
  file: FileMetadata;
  excludedFiles: string[];
  setExcludedFiles: (excludedFiles: string[]) => void;
  refreshFiles: () => void;
}) {
  const { excludedFiles, setExcludedFiles } = props;
  const filename = props.file.file_name;
  const isExcluded = excludedFiles.includes(filename);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [newName, setNewName] = useState(props.file.file_original_name);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Toggle file exclusion (checkbox)
  const toggleFileExclusion = () => {
    if (isExcluded) {
      setExcludedFiles(excludedFiles.filter((file) => file !== filename));
    } else {
      setExcludedFiles([...excludedFiles, filename]);
    }
  };

  // Handle checkbox click
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFileExclusion();
  };

  // Handle menu click
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltip(!showTooltip);
  };

  // Remove file
  const handleRemoveFile = () => {
    const notebookID = window.location.pathname.split("/").pop();
    if (!notebookID) {
      toast.error("Notebook ID not found");
      return;
    }

    const formData = new FormData();
    formData.append("files", filename);
    formData.append("notebookID", notebookID);

    axios
      .post("http://localhost:8000/api/delete-files", formData)
      .then(() => {
        // Update source count
        const form = new FormData();
        form.append("source", "-1");
        form.append("notebookID", notebookID);

        axios
          .post("http://localhost:8000/api/update-source", form)
          .then(() => {
            toast.success("File removed successfully");
            props.refreshFiles();
          })
          .catch((error) => {
            console.error("Error updating source:", error);
            toast.error("Error updating source");
          });
      })
      .catch((error) => {
        console.error("Error removing file:", error);
        toast.error("Error removing file");
      });

    setShowTooltip(false);
  };

  // Rename file
  const handleRenameFile = () => {
    toast.success(`File renamed to: ${newName}`);
    setShowRenameInput(false);
    setShowTooltip(false);
  };

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="h-10 shadow-md mb-2 mx-4 rounded-lg cursor-pointer hover:bg-zinc-800 transition duration-300 ease-in-out flex items-center justify-between relative">
      <div className="flex flex-row items-center h-full overflow-hidden">
        {/* Menu button */}
        <div
          ref={menuRef}
          className="p-1 hover:bg-zinc-700 rounded-full ml-2 z-10"
          onClick={handleMenuClick}
        >
          <BiDotsVerticalRounded className="text-white text-xl" />
        </div>

        {/* File icon */}
        <FaFilePdf className="text-red-600 ml-3 flex-shrink-0" />

        {/* File name */}
        <h1 className="text-white text-md ml-2 truncate">
          {props.file.file_original_name}
        </h1>
      </div>

      {/* Checkbox - still on the right */}
      <div className="flex-shrink-0 mr-3">
        <Checkbox
          className="border-white text-white flex-shrink-0"
          checked={!isExcluded}
          onCheckedChange={toggleFileExclusion}
          onClick={handleCheckboxClick}
          aria-label="Include file in requests"
        />
      </div>

      {/* Tooltip moved outside the button */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute left-10 top-0 bg-zinc-900 rounded-lg shadow-lg overflow-hidden z-50 w-40"
        >
          {showRenameInput ? (
            <div className="p-2">
              <input
                type="text"
                className="w-full bg-zinc-800 text-white p-1 rounded text-sm mb-1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end mt-1">
                <button
                  className="text-zinc-400 text-xs mr-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRenameInput(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="text-blue-500 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRenameFile();
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className="flex items-center p-2 text-white hover:bg-zinc-800"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRenameInput(true);
                }}
              >
                <MdOutlineEdit className="mr-2" />
                <span className="text-sm">Rename source</span>
              </div>
              <div
                className="flex items-center p-2 text-white hover:bg-zinc-800"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile();
                }}
              >
                <MdOutlineDelete className="mr-2" />
                <span className="text-sm">Remove source</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
