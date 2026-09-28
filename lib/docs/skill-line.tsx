"use client";

// User-owned: the "Agent skill" strip for .mdx doc pages, the React twin of the
// raw-HTML strip in the Xtrace .md pages (same classes, styled in
// app/theme.css). Clicking the chip copies "/<name>".
import { useState } from "react";

export function SkillLine({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const skill = `/${name}`;
  return (
    <div className="skill-line">
      <strong>Agent skill</strong>
      <button
        type="button"
        className={`skill-chip${copied ? " is-copied" : ""}`}
        title="Copy to clipboard"
        onClick={() => {
          void navigator.clipboard.writeText(skill);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
      >
        <code>{skill}</code>
      </button>
    </div>
  );
}

/** Agent view: the skill name as text. */
export function SkillLineText({ name }: { name: string }) {
  return (
    <p>
      Agent skill: <code>/{name}</code>
    </p>
  );
}
