import { RegisterForm } from "../../components/register-form";

export default function Register() {
  return (
    <>
      <div className="flex w-full h-screen items-center justify-center bg-gray-950">
        <div className="w-full max-w-2xl rounded-lg">
          <RegisterForm />
        </div>
      </div>
    </>
  );
}