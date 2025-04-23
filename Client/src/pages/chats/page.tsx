import { IoIosAdd } from "react-icons/io";
import { RiEditBoxLine } from "react-icons/ri";
import { Input } from "@/components/ui/input";
import { useEffect, useState, useRef } from "react";
import axios from "axios";

function Item(props: {
	showEditTitle: boolean;
	setShowEditTitle: (showEditTitle: boolean) => void;
	title: string;
	setTitle: (title: string) => void;
}) {
	const [showTooltip, setShowTooltip] = useState(false);
	const tooltipRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (showTooltip) {
			tooltipRef.current?.classList.remove("hidden");
			tooltipRef.current?.classList.add("flex");
		} else {
			tooltipRef.current?.classList.remove("flex");
			tooltipRef.current?.classList.add("hidden");
		}
	}, [showTooltip]);
	return (
		<div className="w-60 h-60 bg-zinc-900 cursor-pointer rounded-lg flex flex-col mt-4 ml-4 relative shadow-md hover:bg-black transition duration-300 ease-in-out justify-between">
			<div
				className="absolute rounded-lg bg-zinc-600 text-white top-10 -right-20 hidden flex-col items-center mt-2"
				ref={tooltipRef}
			>
				<div
					className="w-full h-8 text-md bg-zinc-400/40 hover:bg-zinc-400/50 rounded-tl-lg rounded-tr-lg flex items-center justify-center cursor-pointer p-4"
					onClick={() => props.setShowEditTitle(true)}
				>
					Edit title
				</div>
				<div className="w-full h-8 text-md bg-zinc-400/40 hover:bg-zinc-400/50 rounded-bl-lg rounded-br-lg flex items-center justify-center cursor-pointer p-4">
					Delete notebook
				</div>
			</div>
			<div
				className="h-8 text-lg text-white m-2 rounded-4xl px-2 font-medium bg-zinc-400/40 flex flex-row items-center justify-between cursor-pointer hover:bg-zinc-400/50 transition duration-300 ease-in-out"
				onClick={() => setShowTooltip(!showTooltip)}
			>
				{props.title}
				<RiEditBoxLine />
			</div>
			<div className="flex flex-row items-center justify-evenly mx-4 mb-4">
				<div className="text-white text-md">23 Apr, 2025</div>
				<div className="w-1 h-1 rounded-4xl bg-white"></div>
				<div className="text-white text-md">100 sources</div>
			</div>
		</div>
	);
}

function EditTitle(props: {
	showEditTitle: boolean;
	setShowEditTitle: (showEditTitle: boolean) => void;
	title: string;
	setTitle: (title: string) => void;
}) {
	const modalRef = useRef<HTMLDivElement>(null);
	const [newTitle, setNewTitle] = useState(props.title);
	function close() {
		props.setShowEditTitle(false);
	}

	function outsideClick(e: React.MouseEvent) {
		if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
			close();
		}
	}

	function confirmChange(newTitle: string) {
		props.setTitle(newTitle);
		props.setShowEditTitle(false);
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
					<h1 className="text-white text-lg font-bold">
						Edit notebook title
					</h1>
					<RiEditBoxLine className="text-white text-3xl" />
				</div>
				<Input
					className="bg-black text-white w-5/6 focus:outline-none focus:border-ring-0 focus-visible:border-ring-0 focus:border-none border-none"
					placeholder="Enter new title"
					type="text"
					defaultValue={"Chat title"}
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

export default function Chats() {
	const [showEditTitle, setShowEditTitle] = useState(false);
	const [title, setTitle] = useState("Chat title");
	async function createNewNotebook() {
		// Logic to create a new notebook
			axios.post("http://localhost:8000/api/create-notebook",{})
	}
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
				<div className="grid w-5/6 h-auto min-h-[30rem] bg-zinc-800 rounded-xl mt-10 grid-cols-2 gap-4 p-4 shadow-md">
					<Item
						showEditTitle={showEditTitle}
						setShowEditTitle={setShowEditTitle}
						title={title}
						setTitle={setTitle}
					/>
				</div>
				<EditTitle
					showEditTitle={showEditTitle}
					setShowEditTitle={setShowEditTitle}
					title={title}
					setTitle={setTitle}
				/>
			</div>
		</>
	);
}
