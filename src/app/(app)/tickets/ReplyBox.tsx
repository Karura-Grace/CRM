"use client";
import { useState } from "react";

/** Reply textarea with a predefined-reply picker that fills the textarea. */
export default function ReplyBox({ replies }: { replies: { id: number; name: string; message: string }[] }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-2">
      {replies.length > 0 && (
        <select
          className="field-input"
          defaultValue=""
          onChange={(e) => {
            const r = replies.find((x) => String(x.id) === e.target.value);
            if (r) setText((t) => (t ? `${t}\n\n${r.message}` : r.message));
            e.target.value = "";
          }}
        >
          <option value="">Insert predefined reply…</option>
          {replies.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}
      <textarea name="message" rows={5} required className="field-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your reply…" />
    </div>
  );
}
