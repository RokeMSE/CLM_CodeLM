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
  const uploadFiles = useCallback(
    (files: File[]) => {
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
    },
    [props],
  );

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

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      uploadFiles(acceptedFiles);
    },
    [uploadFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDrop,
    noClick: true,
    accept: {},
  });

  return (
    <>
      {/* Full screen backdrop */}
      <div className="fixed inset-0 bg-zinc-900/90 backdrop-blur-sm z-50 flex items-center justify-center">
        {/* Close button */}
        <div className="absolute top-4 right-4 cursor-pointer">
          <IoMdClose
            className="text-white text-3xl"
            onClick={() => props.setShowUploader(false)}
          />
        </div>

        {/* Main content container - 80% of backdrop */}
        <div className="w-4/5 max-w-4xl bg-zinc-800 rounded-xl p-8 flex flex-col items-center">
          {/* Logo and title */}
          <div className="mb-6 flex flex-col items-center">
            <img
              src="/CodeLM.svg"
              alt="CodeLM Logo"
              className="w-20 h-20 mb-2"
            />
            <h1 className="text-white text-3xl font-bold">CodeLM</h1>
          </div>

          {/* Description */}
          <div className="text-center mb-8">
            <h2 className="text-white text-xl font-bold mb-2">Add sources</h2>
            <p className="text-gray-300">
              Sources let our model analyze information that is most important
              to you.
            </p>
          </div>

          {/* Dropzone */}
          <div
            className="w-full border-white border-2 border-dashed rounded-xl p-10 flex flex-col justify-center items-center"
            {...getRootProps()}
          >
            <input {...getInputProps()} />

            <MdOutlineFileUpload className="text-white text-5xl mb-4" />

            {isDragActive ? (
              <span className="text-white text-xl mb-6">
                Release to upload files
              </span>
            ) : (
              <span className="text-white text-xl mb-6">Drop files here</span>
            )}

            <div className="flex items-center gap-4">
              <span className="text-gray-400">or</span>
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition duration-300 ease-in-out flex items-center"
                onClick={openFileDialog}
              >
                <MdOutlineFileUpload className="mr-2" />
                Choose files
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
