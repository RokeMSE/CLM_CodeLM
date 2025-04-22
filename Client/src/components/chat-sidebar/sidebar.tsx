import ChatItem from "../chat-item/item";
import { FaNoteSticky } from "react-icons/fa6";
import { IoIosArrowBack } from "react-icons/io";
import { useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatSidebar(props: {
	showUploader: boolean;
	setShowUploader: (show: boolean) => void;
}) {
	const minimizeRef = useRef<HTMLDivElement>(null);
	const sidebarRef = useRef<HTMLDivElement>(null);
	const { setShowUploader } = props;
	const openUploader = () => {
		setShowUploader(true);
		console.log("open uploader");
	};
	const handleMinimize = () => {
		if (minimizeRef.current) {
			sidebarRef.current?.classList.toggle("w-1/5");
			sidebarRef.current?.classList.toggle("w-0");
			minimizeRef.current?.classList.toggle("rotate-180");
			minimizeRef.current?.classList.toggle("-translate-x-72");
		}
	};
	return (
		<>
			<div
				className="bg-black shadow-2xl border-zinc-800 border-r-2 w-1/5 h-screen relative overflow-hidden transition-all duration-500 ease-in-out"
				ref={sidebarRef}
			>
				<div className="flex flex-col items-center h-full">
					<div className="h-8 hover:bg-zinc-800 transition duration-300 ease-in-out rounded-lg cursor-pointer mt-4 w-4/5 flex justify-center items-center">
						<h1
							className="text-white text-lg select-none whitespace-nowrap overflow-ellipsis"
							onClick={openUploader}
						>
							Upload documents
						</h1>
						<FaNoteSticky className="text-white text-lg ml-2" />
					</div>
					<div className="w-full mt-8">
						<ChatItem />
						<ChatItem />
						<ChatItem />
						<ChatItem />
						<ChatItem />
						<Skeleton className="w-10/12 h-8 bg-zinc-800 mb-4 ml-6 rounded-full" />
						<Skeleton className="w-10/12 h-8 bg-zinc-800 mb-4 ml-6 rounded-full" />
						<Skeleton className="w-10/12 h-8 bg-zinc-800 mb-4 ml-6 rounded-full" />
						<Skeleton className="w-10/12 h-8 bg-zinc-800 mb-4 ml-6 rounded-full" />
						<Skeleton className="w-10/12 h-8 bg-zinc-800 mb-4 ml-6 rounded-full" />
						<Skeleton className="w-10/12 h-8 bg-zinc-800 mb-4 ml-6 rounded-full" />
						<Skeleton className="w-10/12 h-8 bg-zinc-800 mb-4 ml-6 rounded-full" />
					</div>
				</div>
			</div>
			<div
				className="w-8 h-8 rounded-4xl absolute left-72 top-1/2 z-50 hover:bg-zinc-800 transition-all duration-500 ease-in-out cursor-pointer flex justify-center items-center"
				ref={minimizeRef}
				onClick={handleMinimize}
			>
				<IoIosArrowBack className="text-white text-xl" />
			</div>
		</>
	);
}
