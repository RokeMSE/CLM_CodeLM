import { IoIosAdd } from "react-icons/io";
import { RiEditBoxLine } from "react-icons/ri";
import { Input } from "@/components/ui/input";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function NotebookItem(props: {
  id: string;
  showEditTitle: boolean;
  setShowEditTitle: (showEditTitle: boolean) => void;
  title: string;
  createDate: string;
  source: number;
  selectedNotebook: string | null;
  setSelectedNotebook: (id: string | null) => void;
  onClick?: () => void;
  handleDelete?: () => void;
}) {
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.setSelectedNotebook(props.id);
    props.setShowEditTitle(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.handleDelete?.();
  };

  return (
    <div
      className="group w-60 h-60 cursor-pointer rounded-lg flex flex-col relative shadow-md transition duration-300 ease-in-out justify-between bg-gradient-to-br from-zinc-900 to-zinc-700 hover:from-black hover:to-zinc-800"
      onClick={props.onClick}
    >
      <div className="h-auto text-lg text-white m-2 rounded-lg px-3 py-1.5 font-medium flex flex-row items-center justify-between relative">
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
          <Pencil
            className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer hover:text-blue-300"
            onClick={handleEditClick}
          />
          <Trash2
            className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer hover:text-red-400"
            onClick={handleDeleteClick}
          />
        </div>
      </div>

      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-white text-2xl">{props.title}</div>
      </div>

      <div className="flex flex-row items-center justify-evenly mx-4 mb-4">
        <div className="text-white text-sm">{props.createDate}</div>{" "}
        <div className="w-1 h-1 rounded-full bg-white mx-2"></div>{" "}
        <div className="text-white text-sm">
          {" "}
          {props.source}{" "}
          {props.source === 1 || props.source === 0 ? "source" : "sources"}
        </div>
      </div>
    </div>
  );
}

function EditTitle(props: {
  showEditTitle: boolean;
  setShowEditTitle: (showEditTitle: boolean) => void;
  notebooks: ProcessedNotebook[];
  setNotebooks: React.Dispatch<React.SetStateAction<ProcessedNotebook[]>>;
  selectedNotebook: string | null;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const currentNotebook = props.notebooks.find(
    (nb) => nb.notebookID === props.selectedNotebook
  );
  const [newTitle, setNewTitle] = useState(currentNotebook?.title || "");

  useEffect(() => {
    const currentNb = props.notebooks.find(
      (nb) => nb.notebookID === props.selectedNotebook
    );
    setNewTitle(currentNb?.title || "");
  }, [props.selectedNotebook, props.notebooks]);

  function close() {
    props.setShowEditTitle(false);
  }

  function outsideClick(e: React.MouseEvent) {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      close();
    }
  }

  function confirmChange() {
    if (!newTitle.trim() || !props.selectedNotebook) {
      toast.error("Title cannot be empty.");
      return;
    }

    const originalTitle = currentNotebook?.title;

    props.setNotebooks((prevNotebooks) =>
      prevNotebooks.map((nb) =>
        nb.notebookID === props.selectedNotebook
          ? { ...nb, title: newTitle }
          : nb
      )
    );
    props.setShowEditTitle(false);

    const formData = new FormData();
    formData.append("title", newTitle);
    formData.append("notebookID", props.selectedNotebook);

    axios
      .post(`http://localhost:8000/api/update-title`, formData)
      .then(() => {
        toast.success("Notebook title updated successfully");
      })
      .catch((err) => {
        toast.error(`Failed to update title: ${err.message}`);
        props.setNotebooks((prevNotebooks) =>
          prevNotebooks.map((nb) =>
            nb.notebookID === props.selectedNotebook
              ? { ...nb, title: originalTitle || "Untitled" }
              : nb
          )
        );
      });
  }

  useEffect(() => {
    if (props.showEditTitle) {
      modalRef.current?.classList.remove("hidden");
      modalRef.current?.classList.add("flex");
    } else {
      modalRef.current?.classList.remove("flex");
      modalRef.current?.classList.add("hidden");
    }
  }, [props.showEditTitle]);

  return (
    <div
      className="w-full h-screen fixed top-0 left-0 bg-zinc-900/80 justify-center items-center select-none z-50 hidden"
      ref={modalRef}
      onClick={outsideClick}
    >
      <div className="w-11/12 mx-w-md h-auto bg-zinc-700 flex flex-col rounded-lg items-center justify-around p-6 space-y-4">
        <div className="w-full flex flex-row items-center justify-between">
          <h1 className="text-white text-lg font-bold">Edit notebook title</h1>
          <RiEditBoxLine className="text-white text-2xl" />
        </div>

        <Input
          className="bg-black text-white w-full focus:outline-none focus:border-blue-500 focus-visible:ring-blue-500 focus-visible:ring-2 border-zinc-600"
          placeholder="Enter new title"
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmChange();
          }}
        />

        <div className="flex flex-row w-full h-10 text-white text-md items-center justify-end space-x-3">
          <button
            className="px-4 py-2 bg-zinc-600 rounded-md cursor-pointer hover:bg-zinc-500 transition-colors"
            onClick={close}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 rounded-md cursor-pointer hover:bg-blue-700 transition-colors"
            onClick={confirmChange}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

interface RawNotebookData {
  _id: string;
  metadata?: {
    notebook_id?: string;
    owner?: string;
    name?: string;
    created_at?: string;
    "#_of_source"?: number;
    updated_at?: string;
  };
}

interface ProcessedNotebook {
  id: string;
  notebookID?: string;
  owner?: string;
  title: string;
  createdAt?: string;
  source: number;
  updatedAt?: string;
}

export default function Chats() {
  const [showEditTitle, setShowEditTitle] = useState(false);
  const [notebooks, setNotebooks] = useState<ProcessedNotebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  async function createNewNotebook() {
    const toastId = toast.loading("Creating new notebook...");
    axios
      .post(
        "http://localhost:8000/api/create-notebook",
        {},
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      )
      .then((res) => {
        toast.success("Notebook created!", { id: toastId });
        window.location.href = `/chat/${res.data.notebook_id}`;
      })
      .catch((err) => {
        console.error("Error creating notebook:", err);
        toast.error(`Failed to create notebook: ${err.message}`, {
          id: toastId,
        });
      });
  }

  async function deleteNotebook(notebookID: string | undefined) {
    if (!notebookID) return;

    const originalNotebooks = notebooks;
    setNotebooks((prev) => prev.filter((n) => n.notebookID !== notebookID));
    const toastId = toast.loading("Deleting notebook...");

    axios
      .delete(`http://localhost:8000/api/delete-notebook/${notebookID}`)
      .then(() => {
        toast.success("Notebook deleted successfully", { id: toastId });
      })
      .catch((err) => {
        console.error("Error deleting notebook:", err);
        toast.error(`Error deleting notebook: ${err.message}`, { id: toastId });
        // Revert UI update on failure
        setNotebooks(originalNotebooks);
      });
  }

  useEffect(() => {
    setLoading(true); // Start loading
    axios
      .get("http://localhost:8000/api/get-notebooks", {
        withCredentials: true,
      })
      .then((res) => {
        const rawNotebooks: RawNotebookData[] = res.data.notebooks || []; // Ensure it's an array
        const processedNotebooks = rawNotebooks.map(
          (notebook: RawNotebookData) => {
            const metadata = notebook.metadata;
            const formattedDate = metadata?.created_at
              ? new Date(metadata.created_at).toISOString().split("T")[0]
              : "Unknown Date";
            return {
              id: notebook._id,
              notebookID: metadata?.notebook_id,
              owner: metadata?.owner,
              title: metadata?.name || "Untitled",
              createdAt: formattedDate,
              source: metadata?.["#_of_source"] || 0,
              updatedAt: metadata?.updated_at,
            };
          }
        );
        setNotebooks(processedNotebooks);
      })
      .catch((err) => {
        toast.error(`Failed to fetch notebooks: ${err.message}`);
        setNotebooks([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <>
      {/* Main container with padding and centering */}
      <div className="bg-black w-full min-h-screen flex flex-col relative items-center overflow-y-auto">
        {/* Content wrapper with max-width and padding */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center container">
          <h1 className="text-white text-4xl md:text-5xl font-bold text-center">
            Welcome to CodeLM
          </h1>

          {/* Create Notebook Button */}
          <div
            className="text-white p-4 rounded-lg w-fit h-auto flex flex-row items-center bg-blue-600 cursor-pointer hover:bg-blue-700 transition duration-300 ease-in-out mt-8 shadow-md"
            onClick={createNewNotebook}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") createNewNotebook();
            }}
          >
            <span className="text-lg mr-2">Create new notebook</span>
            <IoIosAdd className="text-2xl" />
          </div>

          {/* Separator */}
          <div className="w-full h-px bg-zinc-700 mt-12 mb-8"></div>

          {/* Notebooks Grid Area */}
          <div className="w-full">
            {/* Loading State */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 justify-items-center">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="w-60 h-60 rounded-lg" />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && notebooks.length === 0 && (
              <div className="text-center text-zinc-400 mt-10 flex flex-col items-center space-y-4">
                <p className="text-lg">No notebooks found.</p>
                <p>Create one to get started!</p>
              </div>
            )}

            {/* Notebook Grid */}
            {!loading && notebooks.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-20 justify-items-center">
                {notebooks.map((notebook) => (
                  <NotebookItem
                    key={notebook.id} // Use unique notebook ID as key
                    id={notebook.notebookID || ""}
                    showEditTitle={showEditTitle}
                    setShowEditTitle={setShowEditTitle}
                    title={notebook.title}
                    createDate={notebook.createdAt || "Unknown Date"}
                    source={notebook.source || 0}
                    selectedNotebook={selectedNotebook}
                    setSelectedNotebook={setSelectedNotebook}
                    onClick={() => {
                      if (notebook.notebookID) {
                        window.location.href = `/chat/${notebook.notebookID}`;
                      } else {
                        toast.error("Cannot open notebook: Missing ID");
                      }
                    }}
                    handleDelete={() => deleteNotebook(notebook.notebookID)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>{" "}
        <EditTitle
          showEditTitle={showEditTitle}
          setShowEditTitle={setShowEditTitle}
          notebooks={notebooks}
          setNotebooks={setNotebooks}
          selectedNotebook={selectedNotebook}
        />
      </div>{" "}
    </>
  );
}
