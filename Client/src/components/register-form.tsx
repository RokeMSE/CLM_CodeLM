import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FaRegEye } from "react-icons/fa";
import { FaRegEyeSlash } from "react-icons/fa";
import { useRef, useState } from "react";

export function RegisterForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	const passwordRef = useRef<HTMLInputElement>(null);
	const confirmPasswordRef = useRef<HTMLInputElement>(null);
	const [passwordVisible, setPasswordVisible] = useState(false);
	const togglePasswordVisibility = () => {
		if (passwordRef.current) {
			setPasswordVisible(!passwordVisible);
		}
	};
	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card className="bg-black text-white">
				<CardHeader>
					<CardTitle>Sign up</CardTitle>
					<CardDescription>
						Sign up to access our exclusive content and services.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form>
						<div className="flex flex-col gap-6">
							<div className="grid gap-3">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									type="email"
									placeholder="user@example.com"
									required
								/>
							</div>
							<div className="grid gap-3">
								<div className="flex items-center">
									<Label htmlFor="password">Password</Label>
								</div>
								<div className="w-full h-4 mb-5 relative">
									<Input
										id="password"
										type={
											passwordVisible
												? "text"
												: "password"
										}
										placeholder="********"
										required
										ref={passwordRef}
									/>
									<div
										className="absolute right-2 top-1/2 cursor-pointer"
										onClick={togglePasswordVisibility}
									>
										{passwordVisible ? (
											<FaRegEyeSlash
												className="text-gray-400"
												size={20}
											/>
										) : (
											<FaRegEye
												className="text-gray-400"
												size={20}
											/>
										)}
									</div>
								</div>
							</div>
							<div className="grid gap-3">
								<div className="flex items-center">
									<Label htmlFor="password">
										Confirm Password
									</Label>
								</div>
								<Input
									id="confirmPassword"
									type={passwordVisible ? "text" : "password"}
									placeholder="********"
									required
									ref={confirmPasswordRef}
								/>
							</div>
							<div className="flex flex-col gap-3">
								<Button
									type="submit"
									className="w-full cursor-pointer"
								>
									Register
								</Button>
							</div>
						</div>
						<div className="mt-4 text-center text-sm">
							Already have an account?{" "}
							<a
								href="/"
								className="underline underline-offset-4 cursor-pointer"
							>
								Sign in here
							</a>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
