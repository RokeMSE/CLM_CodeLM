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

export function LoginForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	const passwordRef = useRef<HTMLInputElement>(null);
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
					<CardTitle>Login to your account</CardTitle>
					<CardDescription>
						Enter your email below to login to your account
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
									<a
										href="/reset"
										className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
									>
										Forgot your password?
									</a>
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
							<div className="flex flex-col gap-3">
								<Button
									type="submit"
									className="w-full cursor-pointer"
								>
									Login
								</Button>
							</div>
						</div>
						<div className="mt-4 text-center text-sm">
							Don&apos;t have an account?{" "}
							<a
								href="/register"
								className="underline underline-offset-4 cursor-pointer"
							>
								Sign up
							</a>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
