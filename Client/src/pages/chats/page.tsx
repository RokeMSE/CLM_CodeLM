import { IoIosAdd } from "react-icons/io";
import { RiEditBoxLine } from "react-icons/ri";
import { Input } from "@/components/ui/input";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";

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
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showTooltip) {
      tooltipRef.current?.classList.remove("hidden");
      tooltipRef.current?.classList.add("flex");
    } else {
      tooltipRef.current?.classList.remove("flex");
      tooltipRef.current?.classList.add("hidden");
    }
  }, [showTooltip]);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (
      tooltipRef.current?.contains(e.target as Node) ||
      headerRef.current?.contains(e.target as Node)
    ) {
      return;
    }
    props.onClick?.();
  };

  return (
    <div
      className="w-60 h-60 bg-zinc-900 cursor-pointer rounded-lg flex flex-col relative shadow-md hover:bg-black transition duration-300 ease-in-out justify-between"
      onClick={handleContainerClick}
    >
      {/* Tooltip */}
      <div
        className="absolute rounded-lg bg-zinc-600 text-white top-10 -right-20 hidden flex-col items-center mt-2 z-50"
        ref={tooltipRef}
      >
        <div
          className="w-full h-8 text-md bg-zinc-400/40 hover:bg-zinc-400/50 rounded-tl-lg rounded-tr-lg flex items-center justify-center cursor-pointer p-4"
          onClick={(e) => {
            e.stopPropagation();
            props.setSelectedNotebook(props.id);
            props.setShowEditTitle(true);
          }}
        >
          Edit title
        </div>
        <div
          className="w-full h-8 text-md bg-zinc-400/40 hover:bg-zinc-400/50 rounded-bl-lg rounded-br-lg flex items-center justify-center cursor-pointer p-4"
          onClick={(e) => {
            e.stopPropagation();
            props.handleDelete?.();
            setShowTooltip(false);
          }}
        >
          Delete notebook
        </div>
      </div>

      {/* Header */}
      <div
        ref={headerRef}
        className="h-8 text-lg text-white m-2 rounded-4xl px-2 font-medium bg-zinc-400/40 flex flex-row items-center justify-between cursor-pointer hover:bg-zinc-400/50 transition duration-300 ease-in-out"
        onClick={(e) => {
          e.stopPropagation();
          setShowTooltip(!showTooltip);
        }}
      >
        {props.title}
        <RiEditBoxLine />
      </div>
      <div className="flex flex-row items-center justify-evenly mx-4 mb-4">
        <div className="text-white text-md">{props.createDate}</div>
        <div className="w-1 h-1 rounded-4xl bg-white"></div>
        <div className="text-white text-md">
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
  titles: string[];
  setTitles: React.Dispatch<React.SetStateAction<string[]>>;
  index?: number;
  selectedNotebook: string | null;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [newTitle, setNewTitle] = useState(props.titles[props.index || 0]);
  function close() {
    props.setShowEditTitle(false);
  }

  function outsideClick(e: React.MouseEvent) {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      close();
    }
  }

  function confirmChange(newTitle: string) {
    props.setTitles((prevTitles) => {
      const newTitles = [...prevTitles];
      if (props.index !== undefined) {
        newTitles[props.index] = newTitle;
      }
      return newTitles;
    });
    props.setShowEditTitle(false);
    const formData = new FormData();
    formData.append("title", newTitle);
    formData.append("notebookID", props.selectedNotebook || "");
    axios
      .post(`http://localhost:8000/api/update-title`, formData)
      .then(() => {
        toast.success("Notebook title updated successfully");
      })
      .catch((err) => {
        toast.error("Failed to update notebook title", err.message);
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
      className="w-full h-screen absolute top-0 left-0 bg-zinc-900/80 flex justify-center items-center select-none z-50"
      ref={modalRef}
      onClick={outsideClick}
    >
      <div className="w-1/4 h-50 bg-zinc-700 flex flex-col rounded-lg items-center justify-around">
        <div className="w-5/6 h-8 relative p-2 flex flex-row items-center justify-between rounded-lg">
          <h1 className="text-white text-lg font-bold">Edit notebook title</h1>
          <RiEditBoxLine className="text-white text-3xl" />
        </div>
        <Input
          className="bg-black text-white w-5/6 focus:outline-none focus:border-ring-0 focus-visible:border-ring-0 focus:border-none border-none"
          placeholder="Enter new title"
          type="text"
          defaultValue={props.titles[props.index || 0]}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <div className="flex flex-row w-4/5 h-10 text-white text-md items-center justify-evenly">
          <div
            className="px-8 py-2 bg-red-600 rounded-4xl cursor-pointer hover:bg-red-800"
            onClick={close}
          >
            Cancel
          </div>
          <div
            className="px-8 py-2 bg-green-600 rounded-4xl cursor-pointer hover:bg-green-800"
            onClick={() => confirmChange(newTitle)}
          >
            Confirm
          </div>
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
  const [titles, setTitles] = useState<string[]>([]);
  const [notebooks, setNotebooks] = useState<ProcessedNotebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null);
  async function createNewNotebook() {
    axios
      .post(
        "http://localhost:8000/api/create-notebook",
        {},
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        },
      )
      .then((res) => {
        window.location.href = `/chat/${res.data.notebook_id}`;
      })
      .catch((err) => {
        console.log(err);
      });
  }

  async function deleteNotebook(notebookID: string) {
    axios
      .delete(`http://localhost:8000/api/delete-notebook/${notebookID}`)
      .then(() => {
        console.log("Notebook deleted successfully");
        toast.success("Notebook deleted successfully");
      })
      .catch((err) => {
        console.log(err);
        toast.error("Error deleting notebook", err.message);
      });
  }

  useEffect(() => {
    axios
      .get("http://localhost:8000/api/get-notebooks", {
        withCredentials: true,
      })
      .then((res) => {
        const notebooks = res.data.notebooks;
        const processedNotebooks = notebooks.map(
          (notebook: RawNotebookData) => {
            const metadata = notebook.metadata;
            const formattedDate = metadata?.created_at
              ? new Date(metadata.created_at).toISOString().split("T")[0]
              : "Unknown Date";
            return {
              id: notebook._id,
              notebookID: metadata!.notebook_id,
              owner: metadata!.owner,
              title: metadata!.name || "Untitled",
              createdAt: formattedDate,
              source: metadata!["#_of_source"] || 0,
              updatedAt: metadata!.updated_at,
            };
          },
        );
        setNotebooks(processedNotebooks);
        setTitles(
          processedNotebooks.map(
            (notebook: ProcessedNotebook) => notebook.title,
          ),
        );
      })
      .catch((err) => {
        toast.error("Failed to fetch notebooks", err.message);
      });
  }, []);

  return (
    <>
      <div className="bg-black w-full h-screen flex flex-col relative items-center overflow-y-scroll">
        <h1 className="text-white text-5xl font-bold mt-20">
          Welcome to Code LLM
        </h1>
        <div className="text-white p-4 rounded-2xl w-fit h-8 flex flex-row items-center bg-blue-500 cursor-pointer hover:bg-blue-600 transition duration-300 ease-in-out mt-10">
          <span className="text-xl" onClick={createNewNotebook}>
            Create new notebook
          </span>
          <IoIosAdd className="text-3xl" />
        </div>
        <div className="w-5/6 h-0.5 bg-zinc-400/50 mt-20"></div>
        <div className="grid w-5/6 bg-zinc-800 rounded-xl mt-10 mb-10 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4 shadow-md content-start">
          {notebooks.map((notebook, index) => (
            <NotebookItem
              key={index}
              id={notebook.notebookID || ""}
              showEditTitle={showEditTitle}
              setShowEditTitle={setShowEditTitle}
              title={titles[index]}
              createDate={notebook.createdAt || "Unknown Date"}
              source={notebook.source || 0}
              selectedNotebook={selectedNotebook}
              setSelectedNotebook={setSelectedNotebook}
              onClick={() => {
                window.location.href = `/chat/${notebook.notebookID}`;
              }}
              handleDelete={() => {
                deleteNotebook(notebook.notebookId!);
                setNotebooks((prev) =>
                  prev.filter((n) => n.notebookId !== notebook.notebookId),
                );
              }}
            />
          ))}
        </div>
        <EditTitle
          showEditTitle={showEditTitle}
          titles={titles}
          setTitles={setTitles}
          setShowEditTitle={setShowEditTitle}
          index={
            selectedNotebook
              ? notebooks.findIndex(
                  (notebook) => notebook.notebookID === selectedNotebook,
                )
              : undefined
          }
          selectedNotebook={selectedNotebook}
        />
      </div>
    </>
  );
}
