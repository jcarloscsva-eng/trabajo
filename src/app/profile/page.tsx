import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/");

  return <ProfileForm />;
}
