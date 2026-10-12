import { requireOwner } from "@/lib/studio/owner";
import { NewPostForm } from "./NewPostForm";

export const dynamic = "force-dynamic";

export default async function NewPost() {
  await requireOwner();
  return (
    <div className="mt-8">
      <h1 className="text-h2 font-semibold">New post</h1>
      <p className="mt-2 max-w-[70ch] text-ink-2">
        Write a post for your LinkedIn profile. It goes to review; nothing is published until you approve this exact version and then publish or
        schedule it.
      </p>
      <NewPostForm />
    </div>
  );
}
