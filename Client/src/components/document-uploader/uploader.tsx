import { MdOutlineFileUpload } from "react-icons/md";
import { useDropzone } from "react-dropzone";
import { useCallback, useState } from "react";
import { IoMdClose } from "react-icons/io";
import toast from "react-hot-toast";
import axios from "axios";

export default function Uploader(props: {
  showUploader: boolean;
  setShowUploader: (show: boolean) => void;
  setReloadSidebar: (reload: boolean) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = useCallback(
    (files: File[]) => {
      const notebookID = window.location.pathname.split("/").pop();
      if (!notebookID) {
        toast.error("Notebook ID not found");
        return;
      }

      if (files.length === 0) return;
      
      // Set uploading state and show loading toast
      setIsUploading(true);
      const loadingToast = toast.loading(`Uploading ${files.length} file(s)...`);

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
          // Dismiss loading toast and show success
          toast.dismiss(loadingToast);
          toast.success("Files uploaded successfully");

          const size = files.length;
          const form = new FormData();
          form.append("source", size.toString());
          form.append("notebookID", notebookID);

          axios
            .post("http://localhost:8000/api/update-source", form)
            .then(() => {
              console.log("Source updated successfully");
              // Add this line to refresh the sidebar:
              props.setReloadSidebar(true);
            })
            .catch((error) => {
              console.error("Error updating source:", error);
              toast.error("Error updating source");
            });

          props.setShowUploader(false);
          props.setReloadSidebar(true);
          setIsUploading(false);
        })
        .catch((error) => {
          console.error("Error uploading files:", error);
          // Dismiss loading toast and show error
          toast.dismiss(loadingToast);
          toast.error("Error uploading files");
          setIsUploading(false);
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
            onClick={() => !isUploading && props.setShowUploader(false)}
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
            className={`w-full border-white border-2 border-dashed rounded-xl p-10 flex flex-col justify-center items-center ${
              isUploading ? 'opacity-50 pointer-events-none' : ''
            }`}
            {...getRootProps()}
          >
            <input {...getInputProps()} disabled={isUploading} />

            <MdOutlineFileUpload className="text-white text-5xl mb-4" />

            {isDragActive ? (
              <span className="text-white text-xl mb-6">
                Release to upload files
              </span>
            ) : isUploading ? (
              <span className="text-white text-xl mb-6">
                Uploading files...
              </span>
            ) : (
              <span className="text-white text-xl mb-6">Drop files here</span>
            )}

            <div className="flex items-center gap-4">
              <span className="text-gray-400">or</span>
              <button
                className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition duration-300 ease-in-out flex items-center ${
                  isUploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={openFileDialog}
                disabled={isUploading}
              >
                {isUploading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </span>
                ) : (
                  <>
                    <MdOutlineFileUpload className="mr-2" />
                    Choose files
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
