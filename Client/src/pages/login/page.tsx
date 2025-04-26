import { LoginForm } from "../../components/login-form";
import logo from "../../assets/CodeLM.svg"

export default function Login() {
	return (
		<>
			<div className="flex w-full h-screen items-center justify-center bg-gray-950">
				<div className="w-full max-w-2xl rounded-lg">
					<img alt='logo' style={{ width: 1400, height: 220 }} src={String(logo)} />
					<LoginForm />
				</div>
			</div>
		</>
	);
}
