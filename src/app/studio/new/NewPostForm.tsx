"use client";
import { useActionState, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { createPostAction, type NewPostState } from "../actions";

const field = "mt-1 w-full border border-line-strong bg-card p-3 text-sm focus:border-ink focus:outline-none";
const MAX = 3000;

export function NewPostForm() {
  const [state, action, pending] = useActionState<NewPostState, FormData>(createPostAction, { error: null, text: "", target: "", note: "" });
  const [text, setText] = useState(state.text);
  return (
    <form action={action} className="mt-6 grid max-w-3xl gap-5">
      {state.error && (
        <p role="alert" className="border border-alert bg-alert-soft p-4 text-sm text-alert">
          {state.error}
        </p>
      )}
      <label className="text-sm font-medium">
        Post text
        <textarea
          name="text"
          required
          rows={12}
          maxLength={MAX}
          defaultValue={state.text}
          onChange={(e) => setText(e.target.value)}
          className={`${field} font-sans leading-relaxed`}
        />
        <span className={`tabular mt-1 block text-xs ${text.length > MAX - 200 ? "text-alert" : "text-ink-3"}`}>
          {text.length} / {MAX} characters
        </span>
      </label>
      <label className="text-sm font-medium">
        Planned time (Riyadh), optional
        <input name="target_at" type="datetime-local" defaultValue={state.target} className={field} />
        <span className="mt-1 block text-xs text-ink-3">Needed for scheduling. Approval refuses a time that has passed.</span>
      </label>
      <label className="text-sm font-medium">
        Note for yourself, optional
        <input name="note" maxLength={300} defaultValue={state.note} className={field} />
      </label>
      <fieldset className="grid gap-3 border border-line p-4">
        <legend className="px-1 text-sm font-medium">Attachment, optional</legend>
        <label className="text-sm">
          One image (PNG, JPEG, GIF, WebP) or one PDF, up to 4 MB
          <input name="file" type="file" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" className="mt-1 block w-full text-sm" />
        </label>
        <label className="text-sm">
          Document title (PDFs only; shown on LinkedIn)
          <input name="file_title" maxLength={200} className={field} />
        </label>
        <span className="text-xs text-ink-3">Stored privately and checked by checksum. The approval covers the file exactly as uploaded.</span>
      </fieldset>
      <p className="text-xs text-ink-3">Nothing is published from this page.</p>
      <div className="flex flex-wrap gap-3">
        <button name="intent" value="review" className={buttonClass("primary")} disabled={pending}>
          Submit for review
        </button>
        <button name="intent" value="draft" className={buttonClass("secondary")} disabled={pending}>
          Save as draft
        </button>
      </div>
    </form>
  );
}
