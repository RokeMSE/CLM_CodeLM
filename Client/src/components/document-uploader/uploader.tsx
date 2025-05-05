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
  const uploadFiles = (files: File[]) => {
    const notebookID = window.location.pathname.split("/").pop();
    if (!notebookID) {
      toast.error("Notebook ID not found");
      return;
    }

    if (files.length === 0) return;

    const formData = new FormData();
    formData.append("notebookID", notebookID);

    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
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

        const size = files.length;
        const form = new FormData();
        form.append("source", size.toString());
        form.append("notebookID", notebookID);

        axios
          .post("http://localhost:8000/api/update-source", form)
          .then(() => {
            console.log("Source updated successfully");
          })
          .catch((error) => {
            console.error("Error updating source:", error);
            toast.error("Error updating source");
          });

        props.setShowUploader(false);
        props.setReloadSidebar(true);
      })
      .catch((error) => {
        console.error("Error uploading files:", error);
        toast.error("Error uploading files");
      });
  };

  function openFileDialog() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "*";
    input.onchange = (event) => {
      const files = (event.target as HTMLInputElement)?.files;
      if (files) {
        uploadFiles(Array.from(files));
      }
    };
    input.click();
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    uploadFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDrop,
    noClick: true,
    accept: {},
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
                Release to upload files
              </span>
            ) : (
              <span className="text-white text-xl">Drop any files here</span>
            )}
            <span className="text-white text-xl mx-4">OR</span>
            <span
              className="text-white text-xl cursor-pointer hover:bg-blue-900 transition duration-300 ease-in-out rounded-lg bg-blue-600 px-4 py-2"
              onClick={openFileDialog}
            >
              <MdOutlineFileUpload className="text-white text-2xl inline-block mr-2 rounded-4xl" />
              Choose files
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
