import { FaFilePdf } from "react-icons/fa6";
import { Checkbox } from "@/components/ui/checkbox";
import { FileMetadata } from "../chat-sidebar/sidebar";

export default function SidebarItem(props: {
  file: FileMetadata;
  selectedFiles: string[];
  setSelectedFiles: (selectedFiles: string[]) => void;
  toggleFileSelection: (filename: string) => void;
}) {
  const { selectedFiles, setSelectedFiles, toggleFileSelection } = props;
  const isSelected = selectedFiles.includes(props.file.file_name);
  const filename = props.file.file_name;
  const handleCheckboxChange = () => {
    if (isSelected) {
      setSelectedFiles(selectedFiles.filter((file) => file !== filename));
    } else {
      setSelectedFiles([...selectedFiles, filename]);
    }
  };
  const handleItemClick = () => {
    toggleFileSelection(filename);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the click event from bubbling up to the item
    handleCheckboxChange();
  };

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleItemClick();
    }
  };

  const handleCheckboxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCheckboxChange();
    }
  };

  return (
    <div
      className="h-8 shadow-md mb-2 mx-4 rounded-lg cursor-pointer hover:bg-zinc-800 transition duration-300 ease-in-out"
      onClick={handleItemClick}
      onKeyDown={handleItemKeyDown}
    >
      <div className="flex flex-row items-center h-full">
        <FaFilePdf className="text-red-600 ml-4" />
        <h1 className="text-white text-md ml-2 whitespace-nowrap overflow-ellipsis">
          {props.file.file_original_name}
        </h1>
        <Checkbox
          className="border-white
          text-white
          radix-state-checked:bg-white
          radix-state-checked:border-white
					ml-auto mr-4"
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
          onClick={handleCheckboxClick}
          onKeyDown={handleCheckboxKeyDown}
          aria-label="Select file"
        />
      </div>
    </div>
  );
}
