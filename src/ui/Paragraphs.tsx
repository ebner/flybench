/** Multi-line text: blank lines separate paragraphs, single line breaks are just wrapping. */
export function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((p, i) => (
        <p key={i}>{p.replace(/\s*\n\s*/g, " ")}</p>
      ))}
    </>
  );
}
