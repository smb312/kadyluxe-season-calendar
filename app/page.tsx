import { redirect } from "next/navigation";

// The workhorse view is the list; send people there by default.
export default function Home() {
  redirect("/list");
}
