import { IoIosAdd } from "react-icons/io";
import { RiEditBoxLine } from "react-icons/ri";
import { Input } from "@/components/ui/input";
import { useEffect, useState, useRef } from "react";
import axios from "axios";

// Define interfaces for component props
interface NotebookCardProps {
  isEditModalOpen: boolean;
  openEditModal: (isOpen: boolean) => void;
  notebookTitle: string;
  updateNotebookTitle: (title: string) => void;
}

interface TitleEditModalProps {
  isOpen: boolean;
  onClose: (isOpen: boolean) => void;
  currentTitle: string;
  onTitleUpdate: (title: string) => void;
}

function NotebookCard({
  // isEditModalOpen,
  openEditModal,
  notebookTitle,
  // updateNotebookTitle,
}: NotebookCardProps) {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isTooltipVisible) {
      tooltipRef.current?.classList.remove("hidden");
      tooltipRef.current?.classList.add("flex");
    } else {
      tooltipRef.current?.classList.remove("flex");
      tooltipRef.current?.classList.add("hidden");
    }
  }, [isTooltipVisible]);

  return (
    <div className="w-60 h-60 cursor-pointer rounded-lg flex flex-col mt-4 ml-4 relative shadow-md transition duration-300 ease-in-out justify-between bg-gradient-to-br from-zinc-900 to-zinc-700 hover:from-black hover:to-zinc-800">
      <div
        className="absolute rounded-lg bg-zinc-600 text-white top-10 -right-20 hidden flex-col items-center mt-2"
        ref={tooltipRef}
      >
        <div
          className="w-full h-8 text-md bg-zinc-400/40 hover:bg-zinc-400/50 rounded-tl-lg rounded-tr-lg flex items-center justify-center cursor-pointer p-4"
          onClick={() => openEditModal(true)}
        >
          Edit title
        </div>
        <div className="w-full h-8 text-md bg-zinc-400/40 hover:bg-zinc-400/50 rounded-bl-lg rounded-br-lg flex items-center justify-center cursor-pointer p-4">
          Delete notebook
        </div>
      </div>
      {/* Top section with menu button */}
      <div className="h-8 flex justify-end m-2">
        <div
          className="w-8 h-8 text-lg text-white rounded-full flex items-center justify-center cursor-pointer bg-zinc-400/40 hover:bg-zinc-400/50 transition duration-300 ease-in-out"
          onClick={() => setIsTooltipVisible(!isTooltipVisible)}
        >
          <RiEditBoxLine />
        </div>
      </div>

      {/* Bottom section with title and metadata */}
      <div className="mt-auto">
        <div className="h-8 text-lg text-white mx-2 mb-2 rounded-4xl px-2 font-medium bg-zinc-400/40 flex flex-row items-center justify-between cursor-pointer hover:bg-zinc-400/50 transition duration-300 ease-in-out">
          {notebookTitle}
        </div>
        <div className="flex flex-row items-center justify-evenly mx-4 mb-4">
          <div className="text-white text-md">23 Apr, 2025</div>
          <div className="w-1 h-1 rounded-4xl bg-white"></div>
          <div className="text-white text-md">100 sources</div>
        </div>
      </div>
    </div>
  );
}

function TitleEditModal({
  isOpen,
  onClose,
  currentTitle,
  onTitleUpdate,
}: TitleEditModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [newTitle, setNewTitle] = useState(currentTitle);

  function handleClose() {
    onClose(false);
  }

  function handleOutsideClick(e: React.MouseEvent) {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  }

  function handleTitleUpdate() {
    onTitleUpdate(newTitle);
    onClose(false);
  }

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.classList.remove("hidden");
      modalRef.current?.classList.add("flex");
    } else {
      modalRef.current?.classList.remove("flex");
      modalRef.current?.classList.add("hidden");
    }
  }, [isOpen]);

  return (
    <div
      className="w-full h-screen absolute top-0 left-0 bg-zinc-900/80 flex justify-center items-center select-none z-50"
      ref={modalRef}
      onClick={handleOutsideClick}
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
          defaultValue={currentTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <div className="flex flex-row w-4/5 h-10 text-white text-md items-center justify-evenly">
          <div
            className="px-8 py-2 bg-red-600 rounded-4xl cursor-pointer hover:bg-red-800"
            onClick={handleClose}
          >
            Cancel
          </div>
          <div
            className="px-8 py-2 bg-green-600 rounded-4xl cursor-pointer hover:bg-green-800"
            onClick={handleTitleUpdate}
          >
            Confirm
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotebooksPage() {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [notebookTitle, setNotebookTitle] = useState("Chat title");

  async function createNewNotebook() {
    try {
      const response = await axios.post(
        "http://localhost:8000/api/create-notebook",
        {},
      );
      window.location.href = `/chat/${response.data.notebook_id}`;
    } catch (error) {
      console.error("Failed to create new notebook:", error);
    }
  }

  return (
    <div className="bg-gray-900 w-full h-screen">
      <div className="container mx-auto flex flex-col items-center justify-center">
        <h1 className="text-white text-5xl font-bold mt-20 self-start">
          Welcome to Code LLM
        </h1>
        <div className="text-white p-4 rounded-2xl w-fit h-8 flex flex-row items-center bg-blue-500 cursor-pointer hover:bg-blue-600 transition duration-300 ease-in-out mt-10">
          <span className="text-xl" onClick={createNewNotebook}>
            Create new notebook
          </span>
          <IoIosAdd className="text-3xl" />
        </div>
        <div className="grid w-full h-auto min-h-[30rem] rounded-xl mt-10 grid-cols-2 gap-4 py-4">
          <NotebookCard
            isEditModalOpen={isEditModalOpen}
            openEditModal={setIsEditModalOpen}
            notebookTitle={notebookTitle}
            updateNotebookTitle={setNotebookTitle}
          />
        </div>
        <TitleEditModal
          isOpen={isEditModalOpen}
          onClose={setIsEditModalOpen}
          currentTitle={notebookTitle}
          onTitleUpdate={setNotebookTitle}
        />
      </div>
    </div>
  );
}
