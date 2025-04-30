import { FaFilePdf } from "react-icons/fa6";
import { Checkbox } from "@/components/ui/checkbox";

export default function ChatItem() {
  return (
    <div className="h-8 shadow-md mb-2 mx-4 rounded-lg cursor-pointer hover:bg-zinc-800 transition duration-300 ease-in-out">
      <div className="flex flex-row items-center h-full">
        <FaFilePdf className="text-red-600 ml-4" />
        <h1 className="text-white text-md ml-2 whitespace-nowrap overflow-ellipsis">
          PDF Title
        </h1>
        <Checkbox
          className="border-white
          text-white
          radix-state-checked:bg-white
          radix-state-checked:border-white
					ml-auto mr-4"
        />
      </div>
    </div>
  );
}
