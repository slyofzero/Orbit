// Every app page sits in AppFrame (the rail, or no rail before a plan is loaded) over the fixed Backdrop
// canvas, and can show toasts.
import { Backdrop } from "@/components/background/Backdrop";
import { AppFrame } from "@/components/app/AppFrame";
import { LaunchProvider } from "@/components/app/Launch";
import { ToastProvider } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Backdrop>
      <ToastProvider>
        <LaunchProvider>
          <AppFrame>{children}</AppFrame>
        </LaunchProvider>
      </ToastProvider>
    </Backdrop>
  );
}
