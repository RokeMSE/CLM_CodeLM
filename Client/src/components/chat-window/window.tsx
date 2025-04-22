import { Input } from "@/components/ui/input";
import { useRef } from "react";
import { LoremIpsum } from "react-lorem-ipsum";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatWindow() {
	const inputRef = useRef<HTMLInputElement>(null);
	const chatWindowRef = useRef<HTMLDivElement>(null);
	return (
		<>
			<div
				className="w-full h-screen bg-zinc-900 flex flex-col items-center transition-all duration-500 ease-in-out"
				ref={chatWindowRef}
			>
				<div className="w-full h-7/8 bg-zinc-900 flex flex-col justify-center items-center">
					<div className="w-full h-full bg-zinc-900 rounded-xl flex flex-col overflow-scroll [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none][scrollbar-width:none]">
						<div className="w-fit max-w-1/2 h-fit text-white ml-auto bg-zinc-800 p-4 rounded-4xl">
							<LoremIpsum p={3} />
						</div>
						<Skeleton className="h-96 m-8 box-border bg-red-500" />
					</div>
				</div>
				<div className="w-7/8 h-1/8 bg-zinc-900 flex flex-col justify-center items-end">
					<span className="text-white ml-4">100 sources</span>
					<Input
						className="text-white w-full"
						ref={inputRef}
						onKeyDown={(e) => {
							if (e.key === "Enter" && inputRef.current) {
								const inputValue = inputRef.current.value;
								if (inputValue.trim() !== "") {
									console.log("Input value:", inputValue);
									// Handle the input value here
									inputRef.current.value = ""; // Clear the input after submission
								}
							}
						}}
					/>
				</div>
			</div>
		</>
	);
}
