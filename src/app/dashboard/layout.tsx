import DashboardContainer from "@/components/DashboardContainer";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SocketProvider } from "@/contexts/SocketContext";
import { AuthService } from "@/services/AuthService";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  
  if (!token) {
    redirect("/login");
  }

  let user = null;
  try {
    const userDoc = await AuthService.getAuthUser(token);
    if (userDoc) {
      user = {
        id: userDoc._id.toString(),
        name: userDoc.name,
        email: userDoc.email
      };
    }
  } catch (e) {
    console.error("Failed to fetch dashboard layout user:", e);
  }

  return (
    <SocketProvider>
      <DashboardContainer user={user}>
        {children}
      </DashboardContainer>
    </SocketProvider>
  );
}

