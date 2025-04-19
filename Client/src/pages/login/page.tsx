import { LoginForm } from "../../components/login-form";

export default function Login() {
	return (
		<>
			<div className="flex w-full h-screen items-center justify-center bg-gray-950">
				<div className="w-full max-w-2xl rounded-lg">
					<LoginForm />
				</div>
			</div>
		</>
	);
}
