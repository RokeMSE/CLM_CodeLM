import { ResetForm } from "@/components/reset-form";

export default function Reset() {
  return (
    <>
      <div className="flex w-full h-screen items-center justify-center bg-gray-950">
        <div className="w-full max-w-2xl rounded-lg">
          <ResetForm />
        </div>
      </div>
    </>
  );
}