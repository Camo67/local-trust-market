import { useHandleSignInCallback } from "@logto/react";
import { useNavigate } from "react-router-dom";

// Landing point for Logto's redirect-back-with-code flow (registered as the
// app's redirect URI in Logto). @logto/react exchanges the code for tokens,
// then we bounce the user into the app.
const CallbackPage = () => {
  const navigate = useNavigate();
  const { isLoading } = useHandleSignInCallback(() => {
    navigate("/", { replace: true });
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      {isLoading && <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
    </div>
  );
};

export default CallbackPage;
