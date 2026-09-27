import { redirect } from "next/navigation";

// Old path — signup now lives at /signup (chooser → buyer | seller).
export default function RegisterPage() {
  redirect("/signup");
}
