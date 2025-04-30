import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FaRegEye } from "react-icons/fa";
import { FaRegEyeSlash } from "react-icons/fa";
import { TbReload } from "react-icons/tb";
import { useRef, useState } from "react";

export function ResetForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const sendOTPIconRef = useRef<HTMLDivElement>(null);
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
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            Forgot your password? No sweat! Enter your email and we will send
            you an OTP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <div className="w-full h-4 mb-5 relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    required
                  />
                  <div
                    className="absolute right-2 top-1/2 cursor-pointer"
                    ref={sendOTPIconRef}
                    onMouseEnter={() => {
                      if (sendOTPIconRef.current) {
                        sendOTPIconRef.current.classList.add("animate-spin");
                      }
                    }}
                    onMouseLeave={() => {
                      if (sendOTPIconRef.current) {
                        sendOTPIconRef.current.classList.remove("animate-spin");
                      }
                    }}
                  >
                    <TbReload />
                  </div>
                </div>
              </div>
              <InputOTP maxLength={6} containerClassName="w-full">
                <InputOTPGroup>
                  <InputOTPSlot className="w-26 h-16 text-xl" index={0} />
                  <InputOTPSlot className="w-26 h-16 text-xl" index={1} />
                  <InputOTPSlot className="w-26 h-16 text-xl" index={2} />
                  <InputOTPSlot className="w-26 h-16 text-xl" index={3} />
                  <InputOTPSlot className="w-26 h-16 text-xl" index={4} />
                  <InputOTPSlot className="w-26 h-16 text-xl" index={5} />
                </InputOTPGroup>
              </InputOTP>
              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <div className="w-full h-4 mb-5 relative">
                  <Input
                    id="password"
                    type={passwordVisible ? "text" : "password"}
                    placeholder="********"
                    required
                    ref={passwordRef}
                  />
                  <div
                    className="absolute right-2 top-1/2 cursor-pointer"
                    onClick={togglePasswordVisibility}
                  >
                    {passwordVisible ? (
                      <FaRegEyeSlash className="text-gray-400" size={20} />
                    ) : (
                      <FaRegEye className="text-gray-400" size={20} />
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label htmlFor="password">Confirm Password</Label>
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
                <Button type="submit" className="w-full cursor-pointer">
                  Reset Password
                </Button>
              </div>
            </div>
            <div className="mt-4 text-center text-sm">
              Suddenly remember your password?{" "}
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
