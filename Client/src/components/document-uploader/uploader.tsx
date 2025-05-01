import { MdOutlineFileUpload } from "react-icons/md";
import { useDropzone } from "react-dropzone";
import { useCallback } from "react";
import { IoMdClose } from "react-icons/io";
import toast from "react-hot-toast";
import axios from "axios";

export default function Uploader(props: {
  showUploader: boolean;
  setShowUploader: (show: boolean) => void;
  setReloadSidebar: (reload: boolean) => void;
}) {
  function openFileDialog() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf, .docx, .txt"; // Add more file types as needed
    input.onchange = (event) => {
      const notebookID = window.location.pathname.split("/").pop();
      if (!notebookID) {
        toast.error("Notebook ID not found");
        return;
      }
      const formData = new FormData();
      formData.append("notebookID", notebookID);
      const files = (event.target as HTMLInputElement)?.files;
      if (files) {
        // Handle the selected files
        for (let i = 0; i < files.length; i++) {
          formData.append("files", files[i]);
        }
      }
      axios
        .post("http://localhost:8000/api/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .then((response) => {
          console.log("Files uploaded successfully:", response.data);
          toast.success("Files uploaded successfully");
          props.setShowUploader(false);
        })
        .catch((error) => {
          console.error("Error uploading files:", error);
          toast.error("Error uploading files");
        });
    };
    input.click();
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Handle the dropped files
    acceptedFiles.forEach((file) => {
      console.log("Dropped file:", file);
      // You can perform further actions with the file here
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDrop,
    noClick: true,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
    },
  });

  return (
    <>
      <div className="w-full h-screen absolute bg-zinc-800/80 flex justify-center items-center select-none z-50">
        <div className="absolute top-4 right-4 cursor-pointer">
          <IoMdClose
            className="text-white text-3xl"
            onClick={() => {
              props.setShowUploader(false);
            }}
          />
        </div>
        <div className="flex flex-col items-center w-5/6 h-5/6 rounded-xl">
          <div
            className="w-full h-full border-white border-2 border-dashed rounded-xl flex justify-center items-center"
            {...getRootProps()}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <span className="text-white text-xl">
                Drag and drop your files here
              </span>
            ) : (
              <span className="text-white text-xl">Drop your files here</span>
            )}
            <span className="text-white text-xl mx-4">OR</span>
            <span
              className="text-white text-xl cursor-pointer hover:bg-blue-900 transition duration-300 ease-in-out rounded-lg bg-blue-600 px-4 py-2"
              onClick={openFileDialog}
            >
              <MdOutlineFileUpload className="text-white text-2xl inline-block mr-2 rounded-4xl " />
              Choose files
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
